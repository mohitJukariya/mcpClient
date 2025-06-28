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
  private embeddingModel: string;
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
    this.embeddingModel = this.configService.get<string>('EMBEDDING_MODEL') || 'sentence-transformers/all-MiniLM-L6-v2';
    this.embeddingDimension = parseInt(this.configService.get<string>('EMBEDDING_DIMENSION') || '384');

    this.logger.log(`Initialized Embeddings Service with model: ${this.embeddingModel}`);
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

    try {
      this.logger.debug(`Generating embedding for text (${text.length} chars)`);

      // Clean and truncate text if too long
      const cleanText = text.trim().substring(0, 8000); // Most embedding models have token limits

      const response = await this.hf.featureExtraction({
        model: this.embeddingModel,
        inputs: cleanText
      });

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

      this.logger.debug(`Generated embedding with dimension: ${embedding.length}`);
      return embedding;
    } catch (error) {
      this.logger.error('Error generating embedding:', error);
      throw error;
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

      this.logger.log(`Stored embedding for ${messageType} message: ${recordId}`);
      return recordId;
    } catch (error) {
      this.logger.error('Error storing message embedding:', error);
      throw error;
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

  isEnabled(): boolean {
    return !!this.pinecone;
  }
}
