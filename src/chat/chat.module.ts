import { Module } from '@nestjs/common';
import { McpModule } from '../mcp/mcp.module';
import { LlmModule } from '../llm/llm.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { FailsafeModule } from '../failsafe/failsafe.module';
import { ContextModule } from '../context/context.module';
import { CacheModule } from '../cache/cache.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
    imports: [McpModule, LlmModule, EmbeddingsModule, FailsafeModule, ContextModule, CacheModule],
    controllers: [ChatController],
    providers: [ChatService],
})
export class ChatModule { }
