import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';

export class StoreEmbeddingDto {
  sessionId: string;
  messageType: 'user' | 'assistant';
  content: string;
  messageIndex: number;
  toolsUsed?: string[];
}

export class SearchSimilarDto {
  query: string;
  sessionId?: string;
  topK?: number;
  minScore?: number;
}

@Controller('embeddings')
export class EmbeddingsController {
  constructor(private embeddingsService: EmbeddingsService) { }

  @Post('store')
  async storeEmbedding(@Body() dto: StoreEmbeddingDto) {
    try {
      if (!this.embeddingsService.isEnabled()) {
        return {
          success: false,
          message: 'Embeddings service is disabled (missing PINECONE_API_KEY)',
          embeddingId: null
        };
      }

      const embeddingId = await this.embeddingsService.storeMessageEmbedding(
        dto.sessionId,
        dto.messageType,
        dto.content,
        dto.messageIndex,
        dto.toolsUsed || []
      );

      return {
        success: true,
        embeddingId,
        message: 'Embedding stored successfully'
      };
    } catch (error) {
      throw new HttpException(
        `Failed to store embedding: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('search')
  async searchSimilar(@Body() dto: SearchSimilarDto) {
    try {
      if (!this.embeddingsService.isEnabled()) {
        return {
          success: false,
          message: 'Embeddings service is disabled',
          results: []
        };
      }

      const results = await this.embeddingsService.searchSimilarMessages(
        dto.query,
        dto.sessionId,
        dto.topK || 5,
        dto.minScore || 0.7
      );

      return {
        success: true,
        results,
        count: results.length
      };
    } catch (error) {
      throw new HttpException(
        `Failed to search embeddings: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('context/:query')
  async getContextForQuery(
    @Param('query') query: string,
    @Query('sessionId') sessionId?: string,
    @Query('limit') limit?: string,
    @Query('minScore') minScore?: string
  ) {
    try {
      if (!this.embeddingsService.isEnabled()) {
        return {
          success: false,
          context: '',
          message: 'Embeddings service is disabled'
        };
      }

      const topK = limit ? parseInt(limit) : 3;
      const scoreThreshold = minScore ? parseFloat(minScore) : 0.7;

      const similarMessages = await this.embeddingsService.searchSimilarMessages(
        decodeURIComponent(query),
        sessionId,
        topK,
        scoreThreshold
      );

      const context = this.embeddingsService.buildContextFromSimilarMessages(
        similarMessages,
        2000
      );

      return {
        success: true,
        context,
        similarMessages,
        count: similarMessages.length
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get context: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('history/:sessionId')
  async getSessionHistory(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string
  ) {
    try {
      if (!this.embeddingsService.isEnabled()) {
        return {
          success: false,
          history: [],
          message: 'Embeddings service is disabled'
        };
      }

      const historyLimit = limit ? parseInt(limit) : 10;
      const history = await this.embeddingsService.getSessionHistory(
        sessionId,
        historyLimit
      );

      return {
        success: true,
        history,
        count: history.length,
        sessionId
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get session history: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('session/:sessionId')
  async deleteSessionEmbeddings(@Param('sessionId') sessionId: string) {
    try {
      if (!this.embeddingsService.isEnabled()) {
        return {
          success: false,
          message: 'Embeddings service is disabled'
        };
      }

      const deleted = await this.embeddingsService.deleteSessionEmbeddings(sessionId);

      return {
        success: deleted,
        sessionId,
        message: deleted ? 'Session embeddings deleted' : 'Failed to delete embeddings'
      };
    } catch (error) {
      throw new HttpException(
        `Failed to delete session embeddings: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('stats')
  async getIndexStats() {
    try {
      if (!this.embeddingsService.isEnabled()) {
        return {
          success: false,
          message: 'Embeddings service is disabled',
          stats: { disabled: true }
        };
      }

      const stats = await this.embeddingsService.getIndexStats();

      return {
        success: true,
        stats,
        indexName: process.env.PINECONE_INDEX_NAME || 'arbitrum-chat-embeddings'
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get index stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('generate')
  async generateEmbedding(@Body() body: { text: string }) {
    try {
      if (!this.embeddingsService.isEnabled()) {
        return {
          success: false,
          message: 'Embeddings service is disabled',
          embedding: null
        };
      }

      const embedding = await this.embeddingsService.generateEmbedding(body.text);

      return {
        success: true,
        embedding,
        dimension: embedding.length,
        textLength: body.text.length
      };
    } catch (error) {
      throw new HttpException(
        `Failed to generate embedding: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('health')
  async healthCheck() {
    const isEnabled = this.embeddingsService.isEnabled();

    return {
      enabled: isEnabled,
      model: process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
      indexName: process.env.PINECONE_INDEX_NAME || 'arbitrum-chat-embeddings',
      dimension: parseInt(process.env.EMBEDDING_DIMENSION || '384'),
      status: isEnabled ? 'active' : 'disabled (missing PINECONE_API_KEY)'
    };
  }
}
