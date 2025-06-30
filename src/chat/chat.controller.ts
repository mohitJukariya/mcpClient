import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
    private readonly logger = new Logger(ChatController.name);

    constructor(private readonly chatService: ChatService) { }

    @Post()
    async chat(@Body() chatRequest: ChatRequestDto): Promise<ChatResponseDto> {
        this.logger.log(`Received chat request: ${chatRequest.message}${chatRequest.userId ? ` (User: ${chatRequest.userId})` : ''}${chatRequest.personalityId ? ` (Personality: ${chatRequest.personalityId})` : ''}`);

        try {
            const response = await this.chatService.processMessage(
                chatRequest.message,
                chatRequest.sessionId,
                chatRequest.userId,
                chatRequest.personalityId,
            );

            this.logger.log('Chat response generated successfully');
            return response;
        } catch (error) {
            this.logger.error('Error processing chat request:', error.message);
            throw error;
        }
    }
}
