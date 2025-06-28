import { Injectable, Logger, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpService, McpTool } from '../mcp/mcp.service';
import { LlmService, LLMMessage } from '../llm/llm.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { FailsafeQAService } from '../failsafe/failsafe-qa.service';
import { ContextStorageService } from '../context/context-storage.service';
import { ContextUserService } from '../context/context-user.service';
import { ChatResponseDto } from './dto/chat.dto';

interface ChatSession {
    sessionId: string;
    messages: LLMMessage[];
    createdAt: Date;
    lastActivity: Date;
    messageCount: number;
}

@Injectable()
export class ChatService implements OnModuleInit {
    private readonly logger = new Logger(ChatService.name);
    private readonly sessions = new Map<string, ChatSession>();

    constructor(
        private readonly configService: ConfigService,
        private readonly mcpService: McpService,
        private readonly llmService: LlmService,
        private readonly embeddingsService: EmbeddingsService,
        private readonly failsafeService: FailsafeQAService,
        private readonly contextStorage: ContextStorageService,
        private readonly contextUserService: ContextUserService,
    ) { }

    async onModuleInit() {
        // Initialize MCP service
        await this.mcpService.initialize();
        this.logger.log('ChatService initialized with MCP connection and Hugging Face LLM');
    }

    async processMessage(message: string, sessionId?: string, userId?: string): Promise<ChatResponseDto> {
        try {
            // Generate session ID if not provided
            const actualSessionId = sessionId || this.generateSessionId();

            // Get or create session
            const session = this.getOrCreateSession(actualSessionId);

            // Store embedding for user message
            const userMessageIndex = session.messageCount;
            try {
                await this.embeddingsService.storeMessageEmbedding(
                    actualSessionId,
                    'user',
                    message,
                    userMessageIndex
                );
                this.logger.debug(`Stored user message embedding for session ${actualSessionId}`);
            } catch (embeddingError) {
                this.logger.warn(`Failed to store user message embedding: ${embeddingError.message}`);
            }

            // Store user context if userId provided
            if (userId) {
                try {
                    const user = await this.contextUserService.getUserById(userId);
                    if (user) {
                        const contextEntry = {
                            id: `ctx-${userId}-${Date.now()}`,
                            userId,
                            type: 'query' as const,
                            content: message,
                            metadata: {
                                timestamp: new Date().toISOString(),
                                toolsUsed: [],
                                confidence: 0.9,
                                relatedEntries: []
                            }
                        };
                        await this.contextStorage.storeUserContext(user, contextEntry);
                    }
                } catch (contextError) {
                    this.logger.warn(`Failed to store user context: ${contextError.message}`);
                }
            }

            // Fetch relevant context from previous conversations
            let contextMessages: string[] = [];
            try {
                const similarMessages = await this.embeddingsService.searchSimilarMessages(
                    message,
                    userId || undefined, // Search user-specific context if userId provided
                    5, // Top 5 most similar messages
                    0.75 // Minimum similarity score
                );

                if (similarMessages.length > 0) {
                    contextMessages = similarMessages.map(msg =>
                        `[${msg.messageType.toUpperCase()}]: ${msg.content}`
                    );
                    this.logger.debug(`Found ${similarMessages.length} relevant context messages`);
                }
            } catch (contextError) {
                this.logger.warn(`Failed to fetch context: ${contextError.message}`);
            }

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

            // Prepare messages for LLM with context if available
            let messagesForLLM = [...session.messages];
            if (contextMessages.length > 0) {
                // Insert context before the latest user message
                const contextPrompt = `Based on previous relevant conversations:\n${contextMessages.join('\n')}\n\nNow addressing the current query:`;

                messagesForLLM = [
                    ...session.messages.slice(0, -1), // All messages except the last user message
                    {
                        role: 'system',
                        content: contextPrompt
                    },
                    session.messages[session.messages.length - 1] // The latest user message
                ];
            }

            // Generate initial response from LLM
            const llmResponse = await this.llmService.generateResponse(
                messagesForLLM,
                tools,
            );

            console.log("initial response", llmResponse);

            const toolsUsed: Array<{ name: string; arguments: any; result: any }> = [];
            let finalResponse = llmResponse.content;

            // Handle tool calls if any
            if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
                for (const toolCall of llmResponse.toolCalls) {
                    try {
                        this.logger.log(`Calling tool: ${toolCall.name}`, toolCall.arguments);

                        const toolResult = await this.mcpService.callTool(toolCall.name, toolCall.arguments);

                        console.log("tool result", toolResult);

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
                                content: `I'll get that information using ${toolCall.name}.`
                            },
                            {
                                role: 'user',
                                content: `Tool result: ${JSON.stringify(toolResult)}. Give me only a clean, direct answer in under 30 words. Be concise.`
                            },
                        ];

                        const followUpResponse = await this.llmService.generateResponse(followUpMessages, []);
                        finalResponse = this.convertHexToDecimal(followUpResponse.content);
                        console.log("final follow up response after tool call", finalResponse);

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

            // Store embedding for assistant message
            const assistantMessageIndex = session.messageCount + 1;
            const toolsUsedNames = toolsUsed.map(tool => tool.name);

            try {
                await this.embeddingsService.storeMessageEmbedding(
                    actualSessionId,
                    'assistant',
                    finalResponse,
                    assistantMessageIndex,
                    toolsUsedNames
                );
                this.logger.debug(`Stored assistant message embedding for session ${actualSessionId}`);
            } catch (embeddingError) {
                this.logger.warn(`Failed to store assistant message embedding: ${embeddingError.message}`);
            }

            // Update session activity and message count
            session.lastActivity = new Date();
            session.messageCount += 2; // User message + assistant message

            // Keep session manageable (last 10 messages)
            if (session.messages.length > 10) {
                session.messages = session.messages.slice(-10);
            }

            // Cache successful response for failsafe
            try {
                await this.failsafeService.cacheSuccessfulResponse(message, finalResponse);
            } catch (cacheError) {
                this.logger.warn(`Failed to cache response: ${cacheError.message}`);
            }

            return {
                response: finalResponse || 'I apologize, but I couldn\'t generate a response.',
                sessionId: actualSessionId,
                toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
            };

        } catch (error) {
            this.logger.error('Error processing message:', error);

            // Use failsafe system
            try {
                const failsafeResponse = await this.failsafeService.handleFailure(message, error, sessionId);

                if (failsafeResponse.success) {
                    this.logger.log(`Using failsafe response (${failsafeResponse.fallbackLevel}): ${failsafeResponse.response.substring(0, 100)}...`);

                    return {
                        response: failsafeResponse.response,
                        sessionId: sessionId || this.generateSessionId(),
                        toolsUsed: undefined,
                        metadata: {
                            fallback: true,
                            fallbackLevel: failsafeResponse.fallbackLevel,
                            confidence: failsafeResponse.confidence
                        }
                    };
                }
            } catch (failsafeError) {
                this.logger.error('Failsafe system also failed:', failsafeError);
            }

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
                messageCount: 0,
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

    private convertHexToDecimal(content: string): string {
        // Convert hex values to decimal, but preserve identifiers (hashes, addresses)
        return content.replace(/0x([0-9a-fA-F]+)/g, (match, hex) => {
            // Preserve transaction hashes (64 chars), block hashes (64 chars), addresses (40 chars)
            if (hex.length === 64 || hex.length === 40) {
                return match; // Keep as hex
            }

            // Convert shorter hex values (likely numbers) to decimal
            if (hex.length <= 16) { // Up to 16 hex chars = reasonable number range
                const decimal = parseInt(hex, 16);
                return decimal.toString();
            }

            // For very long hex values that aren't standard hashes/addresses, keep as hex
            return match;
        });
    }
}
