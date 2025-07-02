import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import { InferenceClient } from '@huggingface/inference';
import { v4 as uuidv4 } from 'uuid';

export interface EmbeddingRecord {
  id: string;
  sessionId: string;
  messageType: 'user' | 'assistant';
  content: string;
  embedding: number[];
  metadata: {
    timestamp: string;
    toolsUsed?: string[];
    messageIndex: number;
    contentLength: number;
  };
}

export interface ContextResult {
  id: string;
  content: string;
  messageType: 'user' | 'assistant';
  score: number;
  timestamp: string;
  toolsUsed: string[];
  sessionId: string;
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private pinecone: Pinecone;
  private hf: InferenceClient;
  private indexName: string;
  private embeddingModels: string[];
  private embeddingDimension: number;

  constructor(private configService: ConfigService) {
    // Initialize Pinecone
    const pineconeApiKey = this.configService.get<string>('PINECONE_API_KEY');
    if (!pineconeApiKey) {
      this.logger.warn('PINECONE_API_KEY not found. Embedding functionality will be disabled.');
      return;
    }

    this.pinecone = new Pinecone({
      apiKey: pineconeApiKey,
    });

    // Initialize Hugging Face for embeddings
    const hfApiKey = this.configService.get<string>('HUGGINGFACE_API_KEY');
    if (!hfApiKey) {
      throw new Error('HUGGINGFACE_API_KEY is required for embeddings');
    }

    this.hf = new InferenceClient(hfApiKey);
    this.indexName = this.configService.get<string>('PINECONE_INDEX_NAME') || 'arbitrum-chat-embeddings';

    // Multiple embedding models as fallbacks - ALL 384 dimensions for compatibility
    this.embeddingModels = [
      'sentence-transformers/multi-qa-MiniLM-L6-cos-v1',     // Primary (384d) - Working ✅
      'sentence-transformers/all-MiniLM-L6-v2', // Fallback 1 (384d) - Compatible ✅
    ];

    this.embeddingDimension = parseInt(this.configService.get<string>('EMBEDDING_DIMENSION') || '384');

    this.logger.log(`Initialized Embeddings Service with ${this.embeddingModels.length} fallback models`);
  }

  async initializeIndex(): Promise<void> {
    if (!this.pinecone) {
      this.logger.warn('Pinecone not initialized. Skipping index initialization.');
      return;
    }

    try {
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        this.logger.log(`Creating Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: this.embeddingDimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        await this.waitForIndexReady();
      }

      this.logger.log(`Pinecone index ${this.indexName} is ready`);
    } catch (error) {
      this.logger.error('Error initializing Pinecone index:', error);
      throw error;
    }
  }

  private async waitForIndexReady(): Promise<void> {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const indexStats = await this.pinecone.index(this.indexName).describeIndexStats();
        if (indexStats) {
          this.logger.log('Index is ready');
          return;
        }
      } catch (error) {
        // Index not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
    }

    throw new Error('Index creation timeout');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.hf) {
      throw new Error('Hugging Face client not initialized');
    }

    const cleanText = text.trim().substring(0, 8000);

    // Try each model in sequence until one works
    for (let i = 0; i < this.embeddingModels.length; i++) {
      const model = this.embeddingModels[i];

      try {
        this.logger.debug(`Attempting embedding generation with model ${i + 1}/${this.embeddingModels.length}: ${model}`);

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Embedding generation timeout after 30s')), 30000)
        );

        const embeddingPromise = this.hf.featureExtraction({
          model: model,
          inputs: cleanText
        });

        const response = await Promise.race([embeddingPromise, timeoutPromise]);

        // Handle different response formats
        let embedding: number[];
        if (Array.isArray(response)) {
          if (Array.isArray(response[0])) {
            embedding = response[0] as number[];
          } else {
            embedding = response as number[];
          }
        } else {
          throw new Error('Unexpected embedding response format');
        }

        if (!Array.isArray(embedding) || embedding.length === 0) {
          throw new Error('Invalid embedding response');
        }

        // Verify dimension consistency with Pinecone index
        if (embedding.length !== this.embeddingDimension) {
          throw new Error(`Model ${model} returned ${embedding.length}d vectors, but Pinecone index expects ${this.embeddingDimension}d vectors`);
        }

        this.logger.debug(`✅ Successfully generated embedding with model: ${model} (dimension: ${embedding.length})`);

        // If this is not the primary model, log the fallback usage
        if (i > 0) {
          this.logger.warn(`⚠️  Using fallback embedding model ${i + 1}: ${model}`);
        }

        return embedding;

      } catch (error) {
        this.logger.error(`❌ Model ${i + 1}/${this.embeddingModels.length} (${model}) failed:`, error.message);

        // If this is the last model, throw the error
        if (i === this.embeddingModels.length - 1) {
          this.logger.error('🚨 All embedding models failed! Chat will continue but context search may be affected.');
          throw new Error(`All ${this.embeddingModels.length} embedding models failed. Last error: ${error.message}`);
        }

        // Otherwise, continue to next model
        this.logger.warn(`🔄 Trying next fallback model...`);
        continue;
      }
    }
  }

  async storeMessageEmbedding(
    sessionId: string,
    messageType: 'user' | 'assistant',
    content: string,
    messageIndex: number,
    toolsUsed: string[] = []
  ): Promise<string> {
    if (!this.pinecone) {
      this.logger.warn('Pinecone not initialized. Skipping embedding storage.');
      return 'disabled';
    }

    try {
      const embedding = await this.generateEmbedding(content);
      const recordId = `${sessionId}-${messageType}-${messageIndex}-${uuidv4().substring(0, 8)}`;

      const record: EmbeddingRecord = {
        id: recordId,
        sessionId,
        messageType,
        content,
        embedding,
        metadata: {
          timestamp: new Date().toISOString(),
          toolsUsed,
          messageIndex,
          contentLength: content.length
        }
      };

      const index = this.pinecone.index(this.indexName);
      await index.upsert([{
        id: record.id,
        values: record.embedding,
        metadata: {
          sessionId: record.sessionId,
          messageType: record.messageType,
          content: record.content,
          timestamp: record.metadata.timestamp,
          toolsUsed: JSON.stringify(record.metadata.toolsUsed),
          messageIndex: record.metadata.messageIndex,
          contentLength: record.metadata.contentLength
        }
      }]);

      this.logger.log(`✅ Stored embedding for ${messageType} message: ${recordId}`);
      return recordId;
    } catch (error) {
      this.logger.error('❌ Error storing message embedding:', error);

      // Don't throw - let chat continue even if embeddings fail
      this.logger.warn('⚠️  Embedding storage failed, but chat will continue normally');
      return 'failed';
    }
  }

  async searchSimilarMessages(
    query: string,
    sessionId?: string,
    topK: number = 5,
    minScore: number = 0.7
  ): Promise<ContextResult[]> {
    if (!this.pinecone) {
      this.logger.warn('Pinecone not initialized. Returning empty context.');
      return [];
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const index = this.pinecone.index(this.indexName);

      const queryRequest: any = {
        vector: queryEmbedding,
        topK,
        includeMetadata: true
      };

      // Optionally filter by session
      if (sessionId) {
        queryRequest.filter = { sessionId: { $eq: sessionId } };
      }

      const queryResponse = await index.query(queryRequest);

      const results = queryResponse.matches?.map(match => ({
        id: match.id || '',
        score: match.score || 0,
        content: (match.metadata?.content as string) || '',
        messageType: (match.metadata?.messageType as 'user' | 'assistant') || 'user',
        timestamp: (match.metadata?.timestamp as string) || '',
        toolsUsed: JSON.parse((match.metadata?.toolsUsed as string) || '[]'),
        sessionId: (match.metadata?.sessionId as string) || ''
      })).filter(result => result.score >= minScore) || [];

      this.logger.debug(`Found ${results.length} similar messages with score >= ${minScore}`);
      return results;
    } catch (error) {
      this.logger.error('Error searching similar messages:', error);
      return [];
    }
  }

  async getSessionHistory(
    sessionId: string,
    limit: number = 10
  ): Promise<Array<{
    content: string;
    messageType: 'user' | 'assistant';
    timestamp: string;
    toolsUsed: string[];
    messageIndex: number;
  }>> {
    if (!this.pinecone) {
      this.logger.warn('Pinecone not initialized. Returning empty history.');
      return [];
    }

    try {
      const index = this.pinecone.index(this.indexName);

      // Query with session filter to get all session messages
      const queryResponse = await index.query({
        vector: new Array(this.embeddingDimension).fill(0), // Dummy vector
        topK: Math.min(limit * 2, 100), // Get more than needed to account for filtering
        filter: { sessionId: { $eq: sessionId } },
        includeMetadata: true
      });

      const messages = queryResponse.matches?.map(match => ({
        content: (match.metadata?.content as string) || '',
        messageType: (match.metadata?.messageType as 'user' | 'assistant') || 'user',
        timestamp: (match.metadata?.timestamp as string) || '',
        toolsUsed: JSON.parse((match.metadata?.toolsUsed as string) || '[]'),
        messageIndex: (match.metadata?.messageIndex as number) || 0
      })) || [];

      // Sort by messageIndex descending and return latest messages
      return messages
        .sort((a, b) => b.messageIndex - a.messageIndex)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Error getting session history:', error);
      return [];
    }
  }

  async deleteSessionEmbeddings(sessionId: string): Promise<boolean> {
    if (!this.pinecone) {
      this.logger.warn('Pinecone not initialized. Cannot delete embeddings.');
      return false;
    }

    try {
      const index = this.pinecone.index(this.indexName);

      // First, get all vectors for this session
      const queryResponse = await index.query({
        vector: new Array(this.embeddingDimension).fill(0),
        topK: 1000, // High number to get all session vectors
        filter: { sessionId: { $eq: sessionId } },
        includeMetadata: false
      });

      if (queryResponse.matches && queryResponse.matches.length > 0) {
        const idsToDelete = queryResponse.matches.map(match => match.id).filter(id => id) as string[];

        if (idsToDelete.length > 0) {
          await index.deleteMany(idsToDelete);
          this.logger.log(`Deleted ${idsToDelete.length} embeddings for session ${sessionId}`);
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error deleting session embeddings:', error);
      return false;
    }
  }

  async getIndexStats(): Promise<any> {
    if (!this.pinecone) {
      return { disabled: true };
    }

    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();
      return stats;
    } catch (error) {
      this.logger.error('Error getting index stats:', error);
      return { error: error.message };
    }
  }

  // Helper method to build context from similar messages
  buildContextFromSimilarMessages(
    similarMessages: ContextResult[],
    maxContextLength: number = 2000
  ): string {
    if (similarMessages.length === 0) {
      return '';
    }

    let context = 'Relevant previous conversations:\n\n';
    let currentLength = context.length;

    for (const message of similarMessages) {
      const messageContext = `[${message.messageType}]: ${message.content}\n`;

      if (currentLength + messageContext.length > maxContextLength) {
        break;
      }

      context += messageContext;
      currentLength += messageContext.length;
    }

    return context.trim();
  }

  // Add method to check embedding model health
  async checkEmbeddingModelsHealth(): Promise<{
    working: string[];
    failed: string[];
    recommended: string;
  }> {
    const working: string[] = [];
    const failed: string[] = [];
    const testText = "test embedding generation";

    for (const model of this.embeddingModels) {
      try {
        await this.hf.featureExtraction({
          model: model,
          inputs: testText
        });
        working.push(model);
        this.logger.debug(`✅ Model ${model} is working`);
      } catch (error) {
        failed.push(model);
        this.logger.debug(`❌ Model ${model} failed: ${error.message}`);
      }
    }

    this.logger.log(`Embedding models health check: ${working.length}/${this.embeddingModels.length} working`);

    return {
      working,
      failed,
      recommended: working.length > 0 ? working[0] : 'none available'
    };
  }

  isEnabled(): boolean {
    return !!this.pinecone;
  }
}
