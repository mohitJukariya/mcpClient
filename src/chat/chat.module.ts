import { Module } from '@nestjs/common';
import { McpModule } from '../mcp/mcp.module';
import { LlmModule } from '../llm/llm.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
    imports: [McpModule, LlmModule],
    controllers: [ChatController],
    providers: [ChatService],
})
export class ChatModule { }
