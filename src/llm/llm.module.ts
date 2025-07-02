import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { CacheModule } from '../cache/cache.module';

@Module({
    imports: [CacheModule],
    providers: [LlmService],
    exports: [LlmService],
})
export class LlmModule { }
