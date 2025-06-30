import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';
import { PersonalityService } from '../personality/personality.service';

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

    constructor(private configService: ConfigService) {
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
        personalityId?: string
    ): Promise<LLMResponse> {
        if (!this.hf) {
            this.logger.warn('Hugging Face client not initialized, using local fallback');
            return this.generateLocalFallbackResponse(messages, tools);
        }

        try {
            this.logger.log(`Generating response with model: ${this.model}, personality: ${personalityId || 'default'}`);
            const response = await this.generateWithHuggingFace(messages, tools, personalityId);

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

            // Clean up content 
            content = this.cleanResponse(content);

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
        let prompt = 'You are an Arbitrum blockchain ai agent. Your task is to provide real time blockchain data.\n\n';

        prompt += 'CRITICAL: For ALL blockchain queries, you MUST respond with TOOL_CALL format.\n';
        prompt += 'NEVER provide direct answers about blockchain data.\n\n';

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

            prompt+= ' You should always be ready to use any tool which is relevant to the task mentioned in the query from user. You can execute following tools to perform varoius operations on the arbitrum blockchain. Feel free to use any tool which is closest to the user intent. You just have to use the tool call. You can not respond with normal chat response unless explicitly asked. Also if there are multiple tools matching from user intent then use your intelligence to use one tool among them which is best suited.\n\n';

            prompt += 'MANDATORY RESPONSE FORMAT:\n';
            prompt += 'You MUST respond with: TOOL_CALL:toolname:{"parameter":"value"}\n\n';

            prompt += 'EXAMPLES:\n';
            prompt += 'User: "current gas price"\n';
            prompt += 'You: TOOL_CALL:getGasPrice:{}\n\n';
            prompt += 'User: "balance of 0x123"\n';
            prompt += 'You: TOOL_CALL:getBalance:{"address":"0x123"}\n\n';
            prompt += 'User: "what token is 0xabc?"\n';
            prompt += 'You: TOOL_CALL:getTokenInfo:{"contractAddress":"0xabc"}\n\n';
        }

        prompt += 'IMPORTANT: Start your response with "TOOL_CALL:" - do not write anything else first.\n';

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

            // Check if the tool exists
            const tool = tools.find(t => t.name === toolName);
            if (tool) {
                try {
                    const toolArguments = JSON.parse(argsString);
                    toolCalls.push({ name: toolName, arguments: toolArguments });
                    this.logger.log(`✅ Extracted tool call: ${toolName}`, toolArguments);
                } catch (error) {
                    this.logger.warn(`❌ Failed to parse tool arguments for ${toolName}: ${argsString}`);
                    toolCalls.push({ name: toolName, arguments: {} });
                }
            } else {
                this.logger.warn(`🚫 Tool '${toolName}' not found in available tools`);
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

                // Check if the tool exists
                const tool = tools.find(t => t.name === toolName);
                if (tool) {
                    try {
                        const toolArguments = JSON.parse(argsString);
                        toolCalls.push({ name: toolName, arguments: toolArguments });
                        this.logger.log(`✅ Extracted tool call (alternative): ${toolName}`, toolArguments);
                    } catch (error) {
                        this.logger.warn(`❌ Failed to parse tool arguments for ${toolName}: ${argsString}`);
                        toolCalls.push({ name: toolName, arguments: {} });
                    }
                } else {
                    this.logger.warn(`🚫 Tool '${toolName}' not found in available tools`);
                }
            }
        }

        this.logger.debug(`🔍 Total tool calls extracted: ${toolCalls.length}`);
        return toolCalls;
    }

    private cleanResponse(content: string): string {
        let cleaned = content;

        // Log original content for debugging
        console.log("logging original content before cleanup:", content);
        this.logger.debug(`Original response length: ${content.length}`);

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

        // Only use fallback if there's truly no meaningful content
        if (!cleaned || cleaned.length < 5 || cleaned.match(/^[\s\n]*$/)) {
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

}
