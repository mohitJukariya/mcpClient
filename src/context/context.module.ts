import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { ContextUserService } from './context-user.service';
import { ContextStorageService } from './context-storage.service';
import { ContextGraphService } from './context-graph.service';
import { ContextController } from './context.controller';

@Module({
  imports: [EmbeddingsModule],
  providers: [
    ContextUserService,
    ContextStorageService,
    ContextGraphService,
  ],
  controllers: [ContextController],
  exports: [
    ContextUserService,
    ContextStorageService,
    ContextGraphService,
  ],
})
export class ContextModule { }
