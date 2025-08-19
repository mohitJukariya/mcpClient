import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';
import { PersonalityService } from '../personality/personality.service';
import { KVCacheService, OptimizedPromptContext } from '../cache/kv-cache.service';

export interface LLMMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface LLMTool {
    name: string;
    description: string;
    input_schema: any;
}

export interface LLMResponse {
    content: string;
    toolCalls?: Array<{
        name: string;
        arguments: any;
    }>;
}

@Injectable()
export class LlmService {
    private readonly logger = new Logger(LlmService.name);
    private hf: InferenceClient;
    private model: string;
    private personalityService: PersonalityService;

    constructor(
        private configService: ConfigService,
        private kvCacheService: KVCacheService
    ) {
        const apiKey = this.configService.get<string>('HUGGINGFACE_API_KEY');
        if (!apiKey) {
            this.logger.warn('HUGGINGFACE_API_KEY not found, Hugging Face integration will be disabled');
            return;
        }

        this.hf = new InferenceClient(apiKey);
        // Only support Mistral-7B-Instruct-v0.3
        this.model = 'mistralai/Mistral-7B-Instruct-v0.3';
        this.personalityService = new PersonalityService();

        this.logger.log(`Initialized LLM service with model: ${this.model}`);
    }

    async generateResponse(
        messages: LLMMessage[],
        tools: LLMTool[] = [],
        personalityId?: string,
        conversationId?: string
    ): Promise<LLMResponse> {
        if (!this.hf) {
            this.logger.warn('Hugging Face client not initialized, using local fallback');
            return this.generateLocalFallbackResponse(messages, tools);
        }

        try {
            this.logger.log(`🔥 FULL SYSTEM PROMPT MODE - Generating response with model: ${this.model}, personality: ${personalityId || 'default'}`);
            this.logger.log(`🛠️  Available tools: ${tools.length} tools (${tools.map(t => t.name).join(', ')})`);
            const response = await this.generateWithHuggingFace(messages, tools, personalityId);

            // 🔧 CRITICAL: Resolve entity references in tool arguments for non-cached flow
            if (response.toolCalls && response.toolCalls.length > 0 && conversationId) {
                this.logger.debug('🔧 Resolving entity references in non-cached flow');
                response.toolCalls = await this.resolveEntityReferences(response.toolCalls, conversationId);
            }

            // Log the raw response for debugging
            this.logger.debug(`Raw LLM response length: ${response.content.length}`);
            this.logger.debug(`Tool calls found: ${response.toolCalls?.length || 0}`);

            return response;
        } catch (error) {
            this.logger.error('Error generating response with Hugging Face:', error.message);
            this.logger.log('Falling back to local response generation');
            return this.generateLocalFallbackResponse(messages, tools);
        }
    }

    private async generateWithHuggingFace(
        messages: LLMMessage[],
        tools: LLMTool[],
        personalityId?: string
    ): Promise<LLMResponse> {
        try {
            const systemPrompt = this.buildSystemPrompt(tools, personalityId);
            this.logger.debug('🔧 System prompt:', systemPrompt);
            console.log('🔧 SYSTEM PROMPT BEING SENT:', systemPrompt);

            // Use chat completion API for Mistral-7B-Instruct-v0.3
            const chatMessages = this.convertToChatFormat(messages, systemPrompt);
            this.logger.debug('📝 Chat messages for Mistral:', chatMessages);

            const response = await this.hf.chatCompletion({
                model: this.model,
                messages: chatMessages,
                max_tokens: 256,
                temperature: 0.1,
                top_p: 0.9,
                stream: false
            });

            console.log('🤖 FULL HF RESPONSE:', JSON.stringify(response, null, 2));

            let content = response.choices?.[0]?.message?.content?.trim() || '';
            this.logger.debug('🤖 Raw Mistral response:', content);
            console.log('🤖 RAW LLM RESPONSE:', content);

            if (!content) {
                console.log('❌ EMPTY RESPONSE FROM LLM!');
                console.log('Response object:', response);
            }

            // Extract tool calls
            const toolCalls = this.extractToolCalls(content, tools);

            // Clean up content - pass hasToolCalls flag
            content = this.cleanResponse(content, toolCalls.length > 0);

            this.logger.debug('✨ Final response:', { content, toolCalls });
            console.log('✨ FINAL LLM SERVICE RESPONSE:', {
                contentLength: content?.length || 0,
                content: content,
                toolCallsCount: toolCalls?.length || 0,
                toolCalls: toolCalls
            });

            return {
                content,
                toolCalls
            };

        } catch (error) {
            this.logger.error('Error generating response:', error);

            // Check if it's a model availability issue
            if (error.message.includes('No Inference Provider available')) {
                throw new Error(`Model ${this.model} is not available with your Hugging Face account. Please upgrade to Pro or try a different model.`);
            }

            // Check if it's a task mismatch issue
            if (error.message.includes('not supported for task')) {
                throw new Error(`Model ${this.model} doesn't support the requested task. Please try a different model.`);
            }

            // Check for rate limiting
            if (error.message.includes('rate limit') || error.status === 429) {
                throw new Error(`Rate limit exceeded for model ${this.model}. Please wait before trying again.`);
            }

            throw new Error(`Failed to generate response: ${error.message}`);
        }
    }

    private buildSystemPrompt(tools: LLMTool[], personalityId?: string): string {
        this.logger.log('🔧 BUILDING FULL SYSTEM PROMPT with all tool descriptions');
        this.logger.log(`🛠️  Including ${tools.length} tools in system prompt`);

        let prompt = 'You are an Arbitrum blockchain AI agent. Your task is to provide real time blockchain data.\n\n';

        prompt += '🚨 CRITICAL INSTRUCTION: For BLOCKCHAIN-RELATED queries, you MUST respond with TOOL_CALL format.\n';
        prompt += '🚨 NEVER provide direct answers about blockchain data - ALWAYS use tools for blockchain queries.\n';
        prompt += '🚨 However, for simple greetings (hi, hello, etc.) or general conversation, respond normally without tools.\n';
        prompt += '🚨 Only use tools when the user is asking for specific blockchain data like balances, transactions, gas prices, etc.\n\n';

        if (tools.length > 0) {
            prompt += 'AVAILABLE TOOLS:\n';
            prompt += '1. getBalance - Get ETH balance (Required: address)\n';
            prompt += '2. getTokenBalance - Get token balance (Required: contractAddress, address)\n';
            prompt += '3. getTransaction - Get transaction details (Required: txHash)\n';
            prompt += '4. getTransactionReceipt - Get transaction receipt (Required: txHash)\n';
            prompt += '5. getBlock - Get block information (Optional: blockNumber)\n';
            prompt += '6. getLatestBlock - Get latest block number (No parameters)\n';
            prompt += '7. getTransactionHistory - Get transaction history (Required: address)\n';
            prompt += '8. getContractAbi - Get contract ABI (Required: address)\n';
            prompt += '9. getGasPrice - Get current gas price (No parameters)\n';
            prompt += '10. getEthSupply - Get total ETH supply (No parameters)\n';
            prompt += '11. validateAddress - Validate address format (Required: address)\n';
            prompt += '12. getMultiBalance - Get ETH balances for multiple addresses (Required: addresses array)\n';
            prompt += '13. getERC20Transfers - Get ERC-20 token transfers (Required: address)\n';
            prompt += '14. getERC721Transfers - Get ERC-721 NFT transfers (Required: address)\n';
            prompt += '15. getInternalTransactions - Get internal transactions (Required: address)\n';
            prompt += '16. getContractSource - Get verified contract source code (Required: address)\n';
            prompt += '17. getTokenInfo - Get detailed token information (Required: contractAddress)\n';
            prompt += '18. getGasOracle - Get gas price recommendations (No parameters)\n';
            prompt += '19. getTransactionStatus - Get transaction status and receipt (Required: txHash)\n';
            prompt += '20. getContractCreation - Get contract creation details (Required: contractAddresses array)\n';
            prompt += '21. getAddressType - Check if address is contract or EOA (Required: address)\n\n';

            prompt += 'CRITICAL GAS COST CALCULATION:\n';
            prompt += 'Formula: Cost = Gas Price (Gwei) × Gas Used × 0.000000001 × ETH Price (USD)\n';
            prompt += 'Current ETH ≈ $3,500. Example: 0.01 Gwei × 21,000 = 0.00021 ETH ≈ $0.07\n';
            prompt += 'Be CONCISE - show final cost only, not calculation steps to user.\n';
            prompt += 'Gas limits: Transfer=21k, ERC-20=50k-100k, Complex=200k+\n\n';

            prompt += '🚨 MANDATORY: You MUST use tools for BLOCKCHAIN queries. NO EXCEPTIONS.\n';
            prompt += '🚨 For blockchain data, ALWAYS start with "TOOL_CALL:" - NEVER provide direct answers.\n';
            prompt += '🚨 For greetings (hi, hello, hey) respond naturally as Alice without tools.\n';
            prompt += '🚨 If you need blockchain data like balance, use getBalance tool - do NOT guess values.\n\n';

            prompt += 'MANDATORY RESPONSE FORMAT FOR BLOCKCHAIN QUERIES:\n';
            prompt += 'You MUST respond with: TOOL_CALL:toolname:{"parameter":"value"}\n\n';

            prompt += 'EXAMPLES:\n';
            prompt += 'User: "hi" → You: "Hi! I\'m Alice, your DeFi trading assistant. How can I help with your blockchain analytics today?"\n';
            prompt += 'User: "hello" → You: "Hello! Ready to analyze some Arbitrum data?"\n';
            prompt += 'User: "current gas price" → You: TOOL_CALL:getGasPrice:{}\n';
            prompt += 'User: "balance of 0x123" → You: TOOL_CALL:getBalance:{"address":"0x123"}\n';
            prompt += 'User: "what token is 0xabc?" → You: TOOL_CALL:getTokenInfo:{"contractAddress":"0xabc"}\n';
            prompt += 'User: "eth balance of 0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174" → You: TOOL_CALL:getBalance:{"address":"0x5616CAABa92cdf656E7d1bA36Fe1bd878E51c174"}\n\n';
        }

        prompt += '🚨 CRITICAL: For BLOCKCHAIN data requests, start with "TOOL_CALL:" - do not provide direct answers.\n';
        prompt += '🚨 For greetings and general conversation, respond naturally without tools.\n';

        if (personalityId) {
            const personalityPrompt = this.personalityService.getPersonalitySystemPrompt(personalityId, prompt);
            return personalityPrompt;
        }

        return prompt;
    }

    private extractToolCalls(content: string, tools: LLMTool[]): Array<{ name: string; arguments: any }> {
        const toolCalls = [];

        this.logger.debug(`🔍 Extracting tool calls from content: ${content.substring(0, 200)}...`);

        // Primary pattern: TOOL_CALL:toolname:{"param":"value"}
        const toolCallPattern = /TOOL_CALL:(\w+):\s*({.*?}|\{\})/g;

        // Alternative pattern: toolname:toolname:{} (what we're getting)
        const alternativePattern = /(\w+):(\w+):\s*({.*?}|\{\})/g;

        let match;

        // Try primary pattern first
        while ((match = toolCallPattern.exec(content)) !== null) {
            const toolName = match[1];
            const argsString = match[2];

            this.logger.debug(`🔍 Found tool call (primary): ${toolName} with args: ${argsString}`);

            // Check if the tool exists - be more flexible about tool validation
            const tool = tools.find(t => t.name === toolName);
            const isKnownTool = this.isKnownBlockchainTool(toolName);

            if (tool || isKnownTool) {
                try {
                    const toolArguments = JSON.parse(argsString);
                    toolCalls.push({ name: toolName, arguments: toolArguments });
                    this.logger.log(`✅ Extracted tool call: ${toolName}`, toolArguments);
                } catch (error) {
                    this.logger.warn(`❌ Failed to parse tool arguments for ${toolName}: ${argsString}`);
                    toolCalls.push({ name: toolName, arguments: {} });
                }
            } else {
                this.logger.warn(`🚫 Tool '${toolName}' not found in available tools (provided: ${tools.map(t => t.name).join(', ')})`);
            }
        }

        // If no primary pattern found, try alternative pattern
        if (toolCalls.length === 0) {
            while ((match = alternativePattern.exec(content)) !== null) {
                const toolName1 = match[1];
                const toolName2 = match[2];
                const argsString = match[3];

                // Use the first tool name if they match, or try both
                const toolName = toolName1 === toolName2 ? toolName1 : toolName1;

                this.logger.debug(`🔍 Found tool call (alternative): ${toolName} with args: ${argsString}`);

                // Check if the tool exists - be more flexible about tool validation
                const tool = tools.find(t => t.name === toolName);
                const isKnownTool = this.isKnownBlockchainTool(toolName);

                if (tool || isKnownTool) {
                    try {
                        const toolArguments = JSON.parse(argsString);
                        toolCalls.push({ name: toolName, arguments: toolArguments });
                        this.logger.log(`✅ Extracted tool call (alternative): ${toolName}`, toolArguments);
                    } catch (error) {
                        this.logger.warn(`❌ Failed to parse tool arguments for ${toolName}: ${argsString}`);
                        toolCalls.push({ name: toolName, arguments: {} });
                    }
                } else {
                    this.logger.warn(`🚫 Tool '${toolName}' not found in available tools (provided: ${tools.map(t => t.name).join(', ')})`);
                }
            }
        }

        this.logger.debug(`🔍 Total tool calls extracted: ${toolCalls.length}`);
        return toolCalls;
    }

    /**
     * Resolve entity references in tool arguments
     * Converts placeholders like 'addr1', '<YOUR_ADDRESS>' to actual addresses
     */
    private async resolveEntityReferences(toolCalls: Array<{ name: string; arguments: any }>, conversationId: string): Promise<Array<{ name: string; arguments: any }>> {
        if (!toolCalls || toolCalls.length === 0) {
            return toolCalls;
        }

        // Get entity references from KV cache
        const kvCacheData = await this.kvCacheService.getConversationCache(conversationId);
        if (!kvCacheData?.tokenOptimization?.entityReferences) {
            this.logger.debug('No entity references found in cache, returning tool calls as-is');
            return toolCalls;
        }

        const entityReferences = kvCacheData.tokenOptimization.entityReferences;
        this.logger.debug(`📋 Resolving entity references:`, entityReferences);

        const resolvedToolCalls = toolCalls.map(toolCall => {
            const resolvedArguments = this.resolveArgumentReferences(toolCall.arguments, entityReferences);

            if (JSON.stringify(resolvedArguments) !== JSON.stringify(toolCall.arguments)) {
                this.logger.log(`🔧 Resolved entity references for ${toolCall.name}:`, {
                    original: toolCall.arguments,
                    resolved: resolvedArguments
                });
            }

            return {
                ...toolCall,
                arguments: resolvedArguments
            };
        });

        return resolvedToolCalls;
    }

    /**
     * Recursively resolve entity references in any object structure
     */
    private resolveArgumentReferences(args: any, entityReferences: Record<string, string>): any {
        if (typeof args === 'string') {
            // Direct entity reference (e.g., "addr1" -> "0x123...")
            if (entityReferences[args]) {
                return entityReferences[args];
            }

            // Handle placeholders like "<YOUR_ADDRESS>"
            if (args === '<YOUR_ADDRESS>') {
                // Find the first available address in entity references
                const firstAddress = Object.keys(entityReferences).find(key => key.startsWith('addr'));
                if (firstAddress && entityReferences[firstAddress]) {
                    return entityReferences[firstAddress];
                }
            }

            // CRITICAL FIX: If the argument is already a full address, don't convert it to a reference
            // Only convert references to addresses, not addresses to references
            if (args.startsWith('0x') && args.length === 42) {
                // This is already a full address, don't convert it
                return args;
            }

            return args;
        }

        if (Array.isArray(args)) {
            return args.map(item => this.resolveArgumentReferences(item, entityReferences));
        }

        if (typeof args === 'object' && args !== null) {
            const resolved = {};
            for (const [key, value] of Object.entries(args)) {
                resolved[key] = this.resolveArgumentReferences(value, entityReferences);
            }
            return resolved;
        }

        return args;
    }

    /**
     * Synchronous version of entity reference resolution using pre-fetched references
     */
    private resolveEntityReferencesSync(toolCalls: Array<{ name: string; arguments: any }>, entityReferences: Record<string, string>): Array<{ name: string; arguments: any }> {
        if (!toolCalls || toolCalls.length === 0) {
            return toolCalls;
        }

        this.logger.debug(`📋 Resolving entity references (sync):`, entityReferences);

        const resolvedToolCalls = toolCalls.map(toolCall => {
            const resolvedArguments = this.resolveArgumentReferences(toolCall.arguments, entityReferences);

            if (JSON.stringify(resolvedArguments) !== JSON.stringify(toolCall.arguments)) {
                this.logger.log(`🔧 Resolved entity references for ${toolCall.name}:`, {
                    original: toolCall.arguments,
                    resolved: resolvedArguments
                });
            }

            return {
                ...toolCall,
                arguments: resolvedArguments
            };
        });

        return resolvedToolCalls;
    }

    private cleanResponse(content: string, hasToolCalls: boolean = false): string {
        let cleaned = content;

        // Log original content for debugging
        console.log("logging original content before cleanup:", content);
        this.logger.debug(`Original response length: ${content.length}, hasToolCalls: ${hasToolCalls}`);

        // Handle DeepSeek thinking patterns - remove <think>...</think>
        if (cleaned.includes('<think>')) {
            const beforeCleaning = cleaned.length;
            cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
            this.logger.debug(`Removed thinking tags, length changed: ${beforeCleaning} -> ${cleaned.length}`);

            // Handle unclosed <think> tags
            const thinkStart = cleaned.indexOf('<think>');
            if (thinkStart !== -1) {
                cleaned = cleaned.substring(0, thinkStart);
                this.logger.debug(`Removed unclosed think tag from position ${thinkStart}`);
            }
        }

        console.log("after cleanup of think tag:", cleaned);

        // Remove tool calls from the visible response but log them
        const toolCallMatches = cleaned.match(/TOOL_CALL:[^\n]*/g);
        const alternativeMatches = cleaned.match(/\w+:\w+:\s*\{.*?\}/g);

        if (toolCallMatches) {
            this.logger.debug(`Found ${toolCallMatches.length} tool calls: ${toolCallMatches.join(', ')}`);
        }
        if (alternativeMatches) {
            this.logger.debug(`Found ${alternativeMatches.length} alternative format tool calls: ${alternativeMatches.join(', ')}`);
        }

        // Remove both formats from visible response
        cleaned = cleaned.replace(/TOOL_CALL:[^\n]*\n?/g, '');
        cleaned = cleaned.replace(/\w+:\w+:\s*\{.*?\}\n?/g, '');

        // Remove assistant prefixes only at the very beginning
        cleaned = cleaned.replace(/^(Assistant:|AI:|Bot:)\s*/i, '');

        // Remove disclaimers and AI notes
        cleaned = cleaned.replace(/\s*\(Note:.*?\)/gi, '');
        cleaned = cleaned.replace(/\s*Note:.*?$/gmi, '');
        cleaned = cleaned.replace(/\s*\(This response is generated by.*?\)/gi, '');
        cleaned = cleaned.replace(/\s*This response is generated by.*?$/gmi, '');
        cleaned = cleaned.replace(/\s*Always check.*?before making transactions.*?$/gmi, '');
        cleaned = cleaned.replace(/\s*This is a simulated conversation.*?$/gmi, '');
        cleaned = cleaned.replace(/\s*The tool used.*?is not actually implemented.*?$/gmi, '');
        cleaned = cleaned.replace(/\s*does not have real-time data.*?$/gmi, '');

        // Clean up weird token symbols and characters
        cleaned = cleaned.replace(/[✅❌⚡🚀💰]/g, '');
        cleaned = cleaned.replace(/0xUSD₮0/g, 'USDT');
        cleaned = cleaned.replace(/\$ARB AIRDROP/g, 'ARB AIRDROP');

        // Clean up excessive whitespace
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

        this.logger.debug(`Final cleaned response length: ${cleaned.length}`);

        console.log("final cleaned response:", cleaned);

        // If we have tool calls, we should return empty content to let the tool results be shown
        if (hasToolCalls && (!cleaned || cleaned.length < 5 || cleaned.match(/^[\s\n]*$/))) {
            this.logger.debug('Response was empty after cleaning but tool calls are present, returning empty content');
            return '';
        }

        // Only use fallback if there's truly no meaningful content AND no tool calls
        if (!hasToolCalls && (!cleaned || cleaned.length < 5 || cleaned.match(/^[\s\n]*$/))) {
            this.logger.warn('Response was empty after cleaning, using fallback');
            return 'I can help you with Arbitrum blockchain analytics. What would you like to know?';
        }

        return cleaned;
    }

    private convertToChatFormat(messages: LLMMessage[], systemPrompt: string): Array<{ role: string; content: string }> {
        const chatMessages = [];

        // Add system message first
        if (systemPrompt) {
            chatMessages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // Convert messages to chat format
        for (const message of messages) {
            chatMessages.push({
                role: message.role,
                content: message.content
            });
        }

        return chatMessages;
    }

    private generateLocalFallbackResponse(messages: LLMMessage[], tools: LLMTool[]): LLMResponse {
        this.logger.log('Generating local fallback response');

        // This will trigger the failsafe system in the chat service
        throw new Error('LLM service unavailable - falling back to failsafe system');
    }

    private getPersonalityTemperature(personalityId?: string): number {
        if (!personalityId) return 0.1;

        const personality = this.personalityService.getPersonality(personalityId);
        if (!personality) return 0.1;

        // Different personalities get different temperatures
        switch (personalityId) {
            case 'alice': return 0.1; // More focused, analytical
            case 'bob': return 0.15;  // Slightly more technical variation
            case 'charlie': return 0.2; // More creative in analysis
            default: return 0.1;
        }
    }

    // Helper method to get personality info
    getPersonalityInfo(personalityId: string) {
        return this.personalityService.getPersonality(personalityId);
    }

    // Helper method to get all personalities
    getAllPersonalities() {
        return this.personalityService.getAllPersonalities();
    }

    // ===========================================
    // KV CACHE OPTIMIZED METHODS
    // ===========================================

    async generateResponseWithCache(
        messages: LLMMessage[],
        tools: LLMTool[] = [],
        personalityId?: string,
        conversationId?: string,
        isFirstMessage: boolean = false
    ): Promise<LLMResponse> {
        if (!this.hf) {
            this.logger.warn('Hugging Face client not initialized, using local fallback');
            return this.generateLocalFallbackResponse(messages, tools);
        }

        if (!conversationId) {
            // No conversation ID, fall back to regular generation
            return this.generateResponse(messages, tools, personalityId, conversationId);
        }

        // CRITICAL FIX: For the first message in a conversation, always use full system prompt
        // This ensures the LLM gets all tool descriptions and complete context
        if (isFirstMessage) {
            this.logger.log('🎯 FIRST MESSAGE DETECTED - Using FULL system prompt with all tool descriptions');
            this.logger.log(`🔧 Tools available: ${tools.length} tools will be included in system prompt`);
            return this.generateResponse(messages, tools, personalityId, conversationId);
        }

        try {
            // Get optimized context from KV cache
            const optimizedContext = await this.kvCacheService.getOptimizedPromptContext(conversationId);

            if (optimizedContext) {
                this.logger.log(`🚀 Using KV cache optimization (${optimizedContext.estimatedTokens} tokens vs ~500+ traditional)`);
                return this.generateWithOptimizedContext(messages, optimizedContext, personalityId);
            } else {
                this.logger.log('📝 No cache context available, using full generation');
                return this.generateResponse(messages, tools, personalityId, conversationId);
            }
        } catch (error) {
            this.logger.error('Error with cached generation, falling back:', error.message);
            return this.generateResponse(messages, tools, personalityId, conversationId);
        }
    }

    private async generateWithOptimizedContext(
        messages: LLMMessage[],
        optimizedContext: OptimizedPromptContext,
        personalityId?: string
    ): Promise<LLMResponse> {
        try {
            this.logger.log('⚡ COMPRESSED PROMPT MODE - Using KV cache optimized context');

            // Build compressed system prompt using cached context
            const compressedSystemPrompt = this.buildCompressedSystemPrompt(
                optimizedContext,
                personalityId
            );

            this.logger.debug('🔧 Compressed system prompt:', compressedSystemPrompt);
            this.logger.debug(`📊 Token optimization: ${optimizedContext.estimatedTokens} tokens (estimated)`);

            // Only use the latest user message for processing
            const latestMessage = messages[messages.length - 1];
            const optimizedMessages = [
                { role: 'system', content: compressedSystemPrompt },
                latestMessage
            ] as LLMMessage[];

            const chatMessages = this.convertToChatFormat(optimizedMessages, compressedSystemPrompt);

            const response = await this.hf.chatCompletion({
                model: this.model,
                messages: chatMessages,
                max_tokens: 256,
                temperature: this.getPersonalityTemperature(personalityId),
                top_p: 0.9,
                stream: false
            });

            let content = response.choices?.[0]?.message?.content?.trim() || '';

            // Create proper tool objects for extraction - use all known tools
            const tools = this.getAllKnownBlockchainTools();

            let toolCalls = this.extractToolCalls(content, tools);

            // 🔧 CRITICAL: Resolve entity references in tool arguments
            if (optimizedContext.entityReferences && Object.keys(optimizedContext.entityReferences).length > 0) {
                toolCalls = this.resolveEntityReferencesSync(toolCalls, optimizedContext.entityReferences);
            }

            content = this.cleanResponse(content, toolCalls.length > 0);

            this.logger.debug('✨ Optimized response generated');

            return {
                content,
                toolCalls
            };

        } catch (error) {
            this.logger.error('Error with optimized generation:', error.message);
            throw error;
        }
    }

    private buildCompressedSystemPrompt(
        optimizedContext: OptimizedPromptContext,
        personalityId?: string
    ): string {
        this.logger.log('⚡ BUILDING COMPRESSED SYSTEM PROMPT from KV cache');
        this.logger.log(`🗜️  Using cached context with ${optimizedContext.relevantTools.length} relevant tools`);

        // 🚨 CRITICAL: Start with tool enforcement for blockchain queries only
        let prompt = 'Arbitrum blockchain AI agent.\n\n';
        prompt += 'CRITICAL: For BLOCKCHAIN queries, you MUST respond with TOOL_CALL format.\n';
        prompt += 'For greetings or general conversation, respond normally without tools.\n';
        prompt += 'Only use tools for specific blockchain data requests.\n\n';

        // Add compressed context
        prompt += `Context: ${optimizedContext.compressedContext}\n\n`;

        // 🚨 CRITICAL: Add ALL available tools, not just relevant ones to prevent context drift
        prompt += 'AVAILABLE TOOLS:\n';
        prompt += '1. getBalance - Get ETH balance (Required: address)\n';
        prompt += '2. getTokenBalance - Get token balance (Required: contractAddress, address)\n';
        prompt += '3. getTransaction - Get transaction details (Required: txHash)\n';
        prompt += '4. getTransactionReceipt - Get transaction receipt (Required: txHash)\n';
        prompt += '5. getBlock - Get block information (Optional: blockNumber)\n';
        prompt += '6. getLatestBlock - Get latest block number (No parameters)\n';
        prompt += '7. getTransactionHistory - Get transaction history (Required: address)\n';
        prompt += '8. getContractAbi - Get contract ABI (Required: address)\n';
        prompt += '9. getGasPrice - Get current gas price (No parameters)\n';
        prompt += '10. getEthSupply - Get total ETH supply (No parameters)\n';
        prompt += '11. validateAddress - Validate address format (Required: address)\n';
        prompt += '12. getMultiBalance - Get ETH balances for multiple addresses (Required: addresses array)\n';
        prompt += '13. getERC20Transfers - Get ERC-20 token transfers (Required: address)\n';
        prompt += '14. getERC721Transfers - Get ERC-721 NFT transfers (Required: address)\n';
        prompt += '15. getInternalTransactions - Get internal transactions (Required: address)\n';
        prompt += '16. getContractSource - Get verified contract source code (Required: address)\n';
        prompt += '17. getTokenInfo - Get detailed token information (Required: contractAddress)\n';
        prompt += '18. getGasOracle - Get gas price recommendations (No parameters)\n';
        prompt += '19. getTransactionStatus - Get transaction status and receipt (Required: txHash)\n';
        prompt += '20. getContractCreation - Get contract creation details (Required: contractAddresses array)\n';
        prompt += '21. getAddressType - Check if address is contract or EOA (Required: address)\n\n';

        // 🚨 CRITICAL: Add comprehensive examples for different tool categories
        prompt += 'MANDATORY RESPONSE FORMAT:\n';
        prompt += 'You MUST respond with: TOOL_CALL:toolname:{"parameter":"value"}\n\n';

        prompt += 'EXAMPLES:\n';
        // Balance examples
        prompt += 'User: "balance of 0x123" → You: TOOL_CALL:getBalance:{"address":"0x123"}\n';
        prompt += 'User: "balances of multiple addresses" → You: TOOL_CALL:getMultiBalance:{"addresses":["0x123","0x456"]}\n';
        // Gas examples
        prompt += 'User: "current gas price" → You: TOOL_CALL:getGasPrice:{}\n';
        prompt += 'User: "gas recommendations" → You: TOOL_CALL:getGasOracle:{}\n';
        // Transaction examples
        prompt += 'User: "transaction 0xabc" → You: TOOL_CALL:getTransaction:{"txHash":"0xabc"}\n';
        prompt += 'User: "transaction history of 0x123" → You: TOOL_CALL:getTransactionHistory:{"address":"0x123"}\n';
        // Token examples
        prompt += 'User: "what token is 0xdef" → You: TOOL_CALL:getTokenInfo:{"contractAddress":"0xdef"}\n';
        prompt += 'User: "token balance" → You: TOOL_CALL:getTokenBalance:{"contractAddress":"0xabc","address":"0x123"}\n';
        // Block examples
        prompt += 'User: "latest block" → You: TOOL_CALL:getLatestBlock:{}\n';
        prompt += 'User: "block 1000" → You: TOOL_CALL:getBlock:{"blockNumber":"1000"}\n\n';

        // Entity references for shorter addresses
        if (Object.keys(optimizedContext.entityReferences).length > 0) {
            prompt += 'Entity refs: ';
            Object.entries(optimizedContext.entityReferences).forEach(([short, full]) => {
                prompt += `${short}=${full} `;
            });
            prompt += '\n\n';
        }

        // 🚨 CRITICAL: Balanced enforcement - tools for blockchain, natural for greetings
        prompt += 'IMPORTANT: For blockchain queries, start with "TOOL_CALL:" - for greetings, respond naturally.\n\n';

        // 🚨 CRITICAL: Add FULL personality context, not just traits
        if (personalityId) {
            const personalityPrompt = this.personalityService.getPersonalitySystemPrompt(personalityId, '');
            // Extract just the personality section without the tools
            const personalityMatch = personalityPrompt.match(/PERSONALITY CONTEXT:(.*?)(?:\n\n|$)/s);
            if (personalityMatch) {
                prompt += 'PERSONALITY CONTEXT:\n';
                prompt += personalityMatch[1].trim() + '\n\n';
            } else {
                // Fallback to full personality context if pattern doesn't match
                prompt += 'PERSONALITY CONTEXT:\n';
                prompt += this.personalityService.getPersonalitySystemPrompt(personalityId, '').replace(/You are an Arbitrum blockchain ai agent.*?\n\n/s, '').trim() + '\n\n';
            }
        }

        return prompt;
    }

    async updateCacheWithToolResult(
        conversationId: string,
        toolName: string,
        params: Record<string, any>,
        result: any
    ): Promise<void> {
        if (!conversationId) return;

        try {
            // Update conversation cache with tool usage
            await this.kvCacheService.updateConversationWithToolUsage(
                conversationId,
                toolName,
                params,
                result
            );

            // Store tool result in cache for future use
            await this.kvCacheService.storeToolResult(toolName, params, result);

            this.logger.debug(`📝 Updated cache with tool result: ${toolName}`);
        } catch (error) {
            this.logger.warn(`Failed to update cache: ${error.message}`);
        }
    }

    async initializeConversationCache(
        conversationId: string,
        userId: string,
        personalityId: string,
        initialQuery: string
    ): Promise<void> {
        try {
            await this.kvCacheService.initializeConversationCache(
                conversationId,
                userId,
                personalityId,
                initialQuery
            );

            this.logger.debug(`🏗️ Initialized conversation cache: ${conversationId}`);
        } catch (error) {
            this.logger.warn(`Failed to initialize conversation cache: ${error.message}`);
        }
    }

    async getCachedToolResult(
        toolName: string,
        params: Record<string, any>
    ): Promise<any | null> {
        try {
            const cached = await this.kvCacheService.getCachedToolResult(toolName, params);

            if (cached) {
                this.logger.debug(`🔧 Using cached tool result: ${toolName}`);
                return cached.result;
            }

            return null;
        } catch (error) {
            this.logger.warn(`Failed to get cached tool result: ${error.message}`);
            return null;
        }
    }

    /**
     * Check if a tool name is a known blockchain tool
     * This helps when the tools array might be incomplete but we know the tool exists
     */
    private isKnownBlockchainTool(toolName: string): boolean {
        const knownTools = [
            'getBalance', 'getTokenBalance', 'getTransaction', 'getTransactionReceipt',
            'getBlock', 'getLatestBlock', 'getTransactionHistory', 'getContractAbi',
            'getGasPrice', 'getEthSupply', 'validateAddress', 'getMultiBalance',
            'getERC20Transfers', 'getERC721Transfers', 'getInternalTransactions',
            'getContractSource', 'getTokenInfo', 'getGasOracle', 'getTransactionStatus',
            'getContractCreation', 'getAddressType'
        ];

        return knownTools.includes(toolName);
    }

    /**
     * Get all known blockchain tools as proper LLMTool objects
     */
    private getAllKnownBlockchainTools(): LLMTool[] {
        return [
            { name: 'getBalance', description: 'Get ETH balance', input_schema: {} },
            { name: 'getTokenBalance', description: 'Get token balance', input_schema: {} },
            { name: 'getTransaction', description: 'Get transaction details', input_schema: {} },
            { name: 'getTransactionReceipt', description: 'Get transaction receipt', input_schema: {} },
            { name: 'getBlock', description: 'Get block information', input_schema: {} },
            { name: 'getLatestBlock', description: 'Get latest block number', input_schema: {} },
            { name: 'getTransactionHistory', description: 'Get transaction history', input_schema: {} },
            { name: 'getContractAbi', description: 'Get contract ABI', input_schema: {} },
            { name: 'getGasPrice', description: 'Get current gas price', input_schema: {} },
            { name: 'getEthSupply', description: 'Get total ETH supply', input_schema: {} },
            { name: 'validateAddress', description: 'Validate address format', input_schema: {} },
            { name: 'getMultiBalance', description: 'Get ETH balances for multiple addresses', input_schema: {} },
            { name: 'getERC20Transfers', description: 'Get ERC-20 token transfers', input_schema: {} },
            { name: 'getERC721Transfers', description: 'Get ERC-721 NFT transfers', input_schema: {} },
            { name: 'getInternalTransactions', description: 'Get internal transactions', input_schema: {} },
            { name: 'getContractSource', description: 'Get verified contract source code', input_schema: {} },
            { name: 'getTokenInfo', description: 'Get detailed token information', input_schema: {} },
            { name: 'getGasOracle', description: 'Get gas price recommendations', input_schema: {} },
            { name: 'getTransactionStatus', description: 'Get transaction status and receipt', input_schema: {} },
            { name: 'getContractCreation', description: 'Get contract creation details', input_schema: {} },
            { name: 'getAddressType', description: 'Check if address is contract or EOA', input_schema: {} }
        ];
    }

}
