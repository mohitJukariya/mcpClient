import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';

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

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('HUGGINGFACE_API_KEY');
        if (!apiKey) {
            this.logger.warn('HUGGINGFACE_API_KEY not found, Hugging Face integration will be disabled');
            return;
        }

        this.hf = new InferenceClient(apiKey);
        // Only support Mistral-7B-Instruct-v0.3
        this.model = 'mistralai/Mistral-7B-Instruct-v0.3';

        this.logger.log(`Initialized LLM service with model: ${this.model}`);
    }

    async generateResponse(
        messages: LLMMessage[],
        tools: LLMTool[] = []
    ): Promise<LLMResponse> {
        if (!this.hf) {
            this.logger.warn('Hugging Face client not initialized, using local fallback');
            return this.generateLocalFallbackResponse(messages, tools);
        }

        try {
            this.logger.log(`Generating response with model: ${this.model}`);
            const response = await this.generateWithHuggingFace(messages, tools);

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
        tools: LLMTool[]
    ): Promise<LLMResponse> {
        try {
            const systemPrompt = this.buildSystemPrompt(tools);
            this.logger.debug('🔧 System prompt:', systemPrompt);

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

            let content = response.choices?.[0]?.message?.content?.trim() || '';
            this.logger.debug('🤖 Raw Mistral response:', content);

            // Extract tool calls
            const toolCalls = this.extractToolCalls(content, tools);

            // Clean up content 
            content = this.cleanResponse(content);

            this.logger.debug('✨ Final response:', { content, toolCalls });

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

    private buildSystemPrompt(tools: LLMTool[]): string {
        let prompt = 'You are an Arbitrum blockchain analytics assistant.\n\n';

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

            prompt += '\nDECISION PROCESS:\n';
            prompt += 'Step 1: Read the user query carefully\n';
            prompt += 'Step 2: Check if query contains specific data (address, hash, block number)\n';
            prompt += 'Step 3: If specific data provided, find matching tool from list above\n';
            prompt += 'Step 4: If no specific data, answer as general knowledge\n';

            prompt += '\nTOOL USAGE RULES:\n';
            prompt += '• Use tools ONLY when user provides specific data to retrieve\n';
            prompt += '• Format: TOOL_CALL:toolname:{"parameter":"value"}\n';
            prompt += '• For general questions, provide educational answers without tools\n';

            prompt += '\nBALANCE INTERPRETATION RULES:\n';
            prompt += '• getBalance returns the actual ETH balance already converted\n';
            prompt += '• getTokenBalance returns the actual token balance already converted\n';
            prompt += '• Use the balance value directly from the tool response\n';
            prompt += '• Present balances with appropriate units (ETH for getBalance, token symbol for getTokenBalance)\n';
            prompt += '• NO manual conversion needed - balances are ready to display\n';

            prompt += '\nRESPONSE FORMATTING RULES:\n';
            prompt += '• Give direct, concise answers without disclaimers\n';
            prompt += '• NO "Note:" statements or AI disclaimers\n';
            prompt += '• NO "This response is generated by an AI" messages\n';
            prompt += '• NO "real-time data" warnings\n';
            prompt += '• NO "simulated conversation" notes\n';
            prompt += '• When using tools, present results as factual data\n';
            prompt += '• Be confident and direct in your responses\n';

            prompt += '\nEXAMPLES:\n';
            prompt += 'Query: "ETH balance of 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"\n';
            prompt += 'Response: TOOL_CALL:getBalance:{"address":"0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"}\n';
            prompt += 'After tool result: "The balance is [balance value] ETH."\n';
            prompt += '\nQuery: "Is 0x742d35Cc6634C0532925a3b8D0A81C3e02e40890 a valid address?"\n';
            prompt += 'Response: TOOL_CALL:validateAddress:{"address":"0x742d35Cc6634C0532925a3b8D0A81C3e02e40890"}\n';
            prompt += '\nQuery: "What is Arbitrum?"\n';
            prompt += 'Response: Arbitrum is a Layer 2 scaling solution for Ethereum that uses optimistic rollups...\n';
            prompt += '\nQuery: "Current gas price"\n';
            prompt += 'Response: TOOL_CALL:getGasPrice:{}\n';
            prompt += 'After tool result: "The current gas price is [gas price value] Gwei."\n';
        }

        return prompt;
    }

    private formatMessages(messages: LLMMessage[], systemPrompt: string): string {
        let formatted = `<|system|>\n${systemPrompt}\n`;

        // Keep only the last few messages to avoid token limits
        const recentMessages = messages.slice(-4);

        recentMessages.forEach(message => {
            if (message.role === 'user') {
                formatted += `<|user|>\n${message.content}\n`;
            } else if (message.role === 'assistant') {
                formatted += `<|assistant|>\n${message.content}\n`;
            }
        });

        formatted += '<|assistant|>\n';
        return formatted;
    }

    private formatMessagesForT5(messages: LLMMessage[], systemPrompt: string): string {
        // T5 models work better with simple, direct prompts
        let formatted = `${systemPrompt}\n\n`;

        // Keep only the most recent message for T5 to avoid confusion
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
            formatted += `Question: ${lastMessage.content}\nAnswer:`;
        }

        return formatted;
    }

    private formatConversationForGeneration(messages: LLMMessage[], systemPrompt: string): string {
        // Format conversation for DialoGPT text generation
        let formatted = '';

        if (systemPrompt) {
            formatted += `System: ${systemPrompt}\n`;
        }

        // Add conversation history
        for (const message of messages) {
            if (message.role === 'user') {
                formatted += `Human: ${message.content}\n`;
            } else if (message.role === 'assistant') {
                formatted += `Assistant: ${message.content}\n`;
            }
        }

        // Add prompt for assistant response
        formatted += 'Assistant:';

        return formatted;
    }

    private extractToolCalls(content: string, tools: LLMTool[]): Array<{ name: string; arguments: any }> {
        const toolCalls = [];

        this.logger.debug(`🔍 Extracting tool calls from content: ${content.substring(0, 200)}...`);

        // Primary pattern: TOOL_CALL:toolname:{"param":"value"}
        const toolCallPattern = /TOOL_CALL:(\w+):\s*({.*?}|\{\})/g;

        let match;
        while ((match = toolCallPattern.exec(content)) !== null) {
            const toolName = match[1];
            const argsString = match[2];

            this.logger.debug(`🔍 Found tool call: ${toolName} with args: ${argsString}`);

            // Check if the tool exists
            const tool = tools.find(t => t.name === toolName);
            if (tool) {
                try {
                    const toolArguments = JSON.parse(argsString);
                    toolCalls.push({ name: toolName, arguments: toolArguments });
                    this.logger.log(`✅ Extracted tool call: ${toolName}`, toolArguments);
                } catch (error) {
                    this.logger.warn(`❌ Failed to parse tool arguments for ${toolName}: ${argsString}`);
                    // Use empty arguments if parsing fails but tool exists
                    toolCalls.push({ name: toolName, arguments: {} });
                }
            } else {
                this.logger.warn(`🚫 Tool '${toolName}' not found in available tools`);
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
        if (toolCallMatches) {
            this.logger.debug(`Found ${toolCallMatches.length} tool calls: ${toolCallMatches.join(', ')}`);
        }
        cleaned = cleaned.replace(/TOOL_CALL:[^\n]*\n?/g, '');

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

}
