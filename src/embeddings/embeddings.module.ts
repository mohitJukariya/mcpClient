import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingsController } from './embeddings.controller';

@Module({
  imports: [ConfigModule],
  controllers: [EmbeddingsController],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule implements OnModuleInit {
  constructor(private embeddingsService: EmbeddingsService) {}

  async onModuleInit() {
    try {
      if (this.embeddingsService.isEnabled()) {
        await this.embeddingsService.initializeIndex();
      }
    } catch (error) {
      console.error('Failed to initialize embeddings:', error);
      // Don't throw here to allow app to start even if embeddings fail
    }
  }
}
