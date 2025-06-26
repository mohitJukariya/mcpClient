import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HfInference } from '@huggingface/inference';

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
    private hf: HfInference;
    private model: string;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('HUGGINGFACE_API_KEY');
        if (!apiKey) {
            this.logger.warn('HUGGINGFACE_API_KEY not found, Hugging Face integration will be disabled');
            return;
        }

        this.hf = new HfInference(apiKey);
        // Default to a good conversational model that works with Inference API
        this.model = this.configService.get<string>('HUGGINGFACE_MODEL') || 'HuggingFaceH4/zephyr-7b-beta';

        this.logger.log(`Initialized LLM service with model: ${this.model}`);
    }

    async generateResponse(
        messages: LLMMessage[],
        tools: LLMTool[] = []
    ): Promise<LLMResponse> {
        if (!this.hf) {
            throw new Error('Hugging Face client not initialized. Please check your HUGGINGFACE_API_KEY.');
        }

        try {
            // Use Chat Completion API for instruct models like Mistral
            const systemPrompt = this.buildSystemPrompt(tools);

            this.logger.log(`Generating response with model: ${this.model}`);

            // Convert messages to proper chat format
            const chatMessages = this.convertToChatFormat(messages, systemPrompt);

            const response = await this.hf.chatCompletion({
                model: this.model,
                messages: chatMessages,
                max_tokens: 500,
                temperature: 0.7,
                top_p: 0.9,
                stream: false,
            });

            const content = response.choices[0].message.content.trim();
            this.logger.log(`Generated response: ${content.substring(0, 100)}...`);

            // Parse tool calls if any
            const toolCalls = this.extractToolCalls(content, tools);

            return {
                content: this.cleanResponse(content),
                toolCalls,
            };
        } catch (error) {
            this.logger.error('Error generating response:', error);

            // Check if it's a model availability issue
            if (error.message.includes('No Inference Provider available')) {
                throw new Error(`Model ${this.model} is not available with your Hugging Face account. Please upgrade to Pro or try a different model.`);
            }

            // Check if it's a task mismatch issue
            if (error.message.includes('not supported for task')) {
                throw new Error(`Model ${this.model} doesn't support text generation. Trying chat completion API instead.`);
            }

            throw new Error(`Failed to generate response: ${error.message}`);
        }
    }

    private buildSystemPrompt(tools: LLMTool[]): string {
        let prompt = 'You are a helpful AI assistant for Arbitrum blockchain analytics.';

        if (tools.length > 0) {
            prompt += ' You can call tools to get real-time blockchain data.';
            prompt += '\n\nAvailable tools:\n';
            tools.forEach(tool => {
                prompt += `- ${tool.name}: ${tool.description}\n`;
                if (tool.input_schema?.properties) {
                    const props = Object.keys(tool.input_schema.properties).join(', ');
                    prompt += `  Parameters: ${props}\n`;
                }
            });
            prompt += '\nTo use a tool, include this exact format in your response:';
            prompt += '\nTOOL_CALL:tool_name:{"parameter":"value"}';
            prompt += '\nExample: TOOL_CALL:get_token_price:{"token":"ETH","network":"arbitrum"}';
            prompt += '\nAlways explain what you are doing when calling tools.';
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

    private extractToolCalls(content: string, tools: LLMTool[]): Array<{ name: string; arguments: any }> {
        const toolCalls = [];
        const toolCallPattern = /TOOL_CALL:(\w+):(.*?)(?=\n|$)/g;
        let match;

        while ((match = toolCallPattern.exec(content)) !== null) {
            const toolName = match[1];
            const argsString = match[2];

            // Check if the tool exists
            const tool = tools.find(t => t.name === toolName);
            if (tool) {
                try {
                    const toolArguments = JSON.parse(argsString);
                    toolCalls.push({ name: toolName, arguments: toolArguments });
                    this.logger.log(`Extracted tool call: ${toolName} with args:`, toolArguments);
                } catch (error) {
                    this.logger.warn(`Failed to parse tool arguments for ${toolName}: ${argsString}`);
                    // Try with empty arguments if parsing fails
                    toolCalls.push({ name: toolName, arguments: {} });
                }
            }
        }

        return toolCalls;
    }

    private cleanResponse(content: string): string {
        // Remove tool calls from the visible response
        let cleaned = content.replace(/TOOL_CALL:.*?(?=\n|$)/g, '').trim();

        // Remove common prefixes that models sometimes add
        cleaned = cleaned.replace(/^(Assistant:|AI:|Bot:)\s*/i, '');

        // Remove chat template tokens
        cleaned = cleaned.replace(/<\|[^|]+\|>/g, '').trim();

        return cleaned || 'I can help you with Arbitrum blockchain analytics. What would you like to know?';
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
}
