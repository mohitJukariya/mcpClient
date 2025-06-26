import { Injectable, Logger, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpService, McpTool } from '../mcp/mcp.service';
import { LlmService, LLMMessage } from '../llm/llm.service';
import { ChatResponseDto } from './dto/chat.dto';

interface ChatSession {
    sessionId: string;
    messages: LLMMessage[];
    createdAt: Date;
    lastActivity: Date;
}

@Injectable()
export class ChatService implements OnModuleInit {
    private readonly logger = new Logger(ChatService.name);
    private readonly sessions = new Map<string, ChatSession>();

    constructor(
        private readonly configService: ConfigService,
        private readonly mcpService: McpService,
        private readonly llmService: LlmService,
    ) { }

    async onModuleInit() {
        // Initialize MCP service
        await this.mcpService.initialize();
        this.logger.log('ChatService initialized with MCP connection and Hugging Face LLM');
    }

    async processMessage(message: string, sessionId?: string): Promise<ChatResponseDto> {
        try {
            // Generate session ID if not provided
            const actualSessionId = sessionId || this.generateSessionId();

            // Get or create session
            const session = this.getOrCreateSession(actualSessionId);

            // Add user message to session
            session.messages.push({
                role: 'user',
                content: message,
            });

            // Get available tools from MCP server
            const mcpTools = await this.mcpService.getAvailableTools();
            const tools = mcpTools.map((tool: McpTool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema,
            }));

            this.logger.log(`Processing message with ${tools.length} available tools`);

            // Generate initial response from LLM
            const llmResponse = await this.llmService.generateResponse(
                session.messages,
                tools,
            );

            const toolsUsed: Array<{ name: string; arguments: any; result: any }> = [];
            let finalResponse = llmResponse.content;

            // Handle tool calls if any
            if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
                for (const toolCall of llmResponse.toolCalls) {
                    try {
                        this.logger.log(`Calling tool: ${toolCall.name}`, toolCall.arguments);

                        const toolResult = await this.mcpService.callTool(toolCall.name, toolCall.arguments);

                        toolsUsed.push({
                            name: toolCall.name,
                            arguments: toolCall.arguments,
                            result: toolResult,
                        });

                        // Add tool result context and generate follow-up response
                        const followUpMessages: LLMMessage[] = [
                            ...session.messages,
                            {
                                role: 'assistant',
                                content: `I'll use the ${toolCall.name} tool to get that information for you.`
                            },
                            {
                                role: 'user',
                                content: `Here's the result from ${toolCall.name}: ${JSON.stringify(toolResult)}. Please provide a helpful analysis of this data.`
                            },
                        ];

                        const followUpResponse = await this.llmService.generateResponse(followUpMessages, []);
                        finalResponse = followUpResponse.content;

                    } catch (toolError) {
                        this.logger.error(`Tool execution failed for ${toolCall.name}:`, toolError.message);
                        finalResponse += `\n\nI encountered an error while using the ${toolCall.name} tool: ${toolError.message}`;
                    }
                }
            }

            // Add assistant's final response to session
            session.messages.push({
                role: 'assistant',
                content: finalResponse,
            });

            // Update session activity
            session.lastActivity = new Date();

            // Keep session manageable (last 10 messages)
            if (session.messages.length > 10) {
                session.messages = session.messages.slice(-10);
            }

            return {
                response: finalResponse || 'I apologize, but I couldn\'t generate a response.',
                sessionId: actualSessionId,
                toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
            };

        } catch (error) {
            this.logger.error('Error processing message:', error);
            throw new HttpException(
                `Failed to process message: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }

    private getOrCreateSession(sessionId: string): ChatSession {
        let session = this.sessions.get(sessionId);

        if (!session) {
            session = {
                sessionId,
                messages: [],
                createdAt: new Date(),
                lastActivity: new Date(),
            };
            this.sessions.set(sessionId, session);
        }

        // Clean up old sessions (older than 1 hour)
        this.cleanupOldSessions();

        return session;
    }

    private cleanupOldSessions(): void {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.lastActivity < oneHourAgo) {
                this.sessions.delete(sessionId);
                this.logger.log(`Cleaned up expired session: ${sessionId}`);
            }
        }
    }
}
