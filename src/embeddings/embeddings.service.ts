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

interface ModelPerformance {
  model: string;
  averageResponseTime: number;
  successCount: number;
  failureCount: number;
  lastSuccessTime: number;
  isWarmedUp: boolean;
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private pinecone: Pinecone;
  private hf: InferenceClient;
  private indexName: string;
  private embeddingModels: string[];
  private embeddingDimension: number;
  private modelPerformance: Map<string, ModelPerformance> = new Map();
  private embeddingCache: Map<string, { embedding: number[]; timestamp: number }> = new Map();
  private isInitialized = false;

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

    // Optimized embedding models - fast and reliable 384d models
    this.embeddingModels = [
      'sentence-transformers/all-MiniLM-L6-v2',          // Fast, reliable
      'sentence-transformers/multi-qa-MiniLM-L6-cos-v1', // Good for Q&A
      'sentence-transformers/all-MiniLM-L12-v2',         // More accurate
      'intfloat/e5-small-v2',                           // Alternative
      'BAAI/bge-small-en-v1.5',                         // Good performance
    ];

    this.embeddingDimension = parseInt(this.configService.get<string>('EMBEDDING_DIMENSION') || '384');

    // Initialize model performance tracking
    this.initializeModelPerformance();

    this.logger.log(`Initialized Embeddings Service with ${this.embeddingModels.length} models`);

    // Start async initialization
    this.initializeAsync();
  }

  private initializeModelPerformance(): void {
    this.embeddingModels.forEach(model => {
      this.modelPerformance.set(model, {
        model,
        averageResponseTime: 0,
        successCount: 0,
        failureCount: 0,
        lastSuccessTime: 0,
        isWarmedUp: false
      });
    });
  }

  private async initializeAsync(): Promise<void> {
    try {
      await this.initializeIndex();
      await this.warmUpModels();
      this.isInitialized = true;
      this.logger.log('✅ Embeddings service fully initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize embeddings service:', error);
    }
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

  private async warmUpModels(): Promise<void> {
    this.logger.log('🔥 Warming up embedding models...');
    const warmupText = "initialization test";

    // Warm up models in parallel but with staggered timing to avoid rate limits
    const warmupPromises = this.embeddingModels.map(async (model, index) => {
      try {
        // Stagger requests by 500ms each
        await new Promise(resolve => setTimeout(resolve, index * 500));

        const startTime = Date.now();
        await this.hf.featureExtraction({
          model: model,
          inputs: warmupText
        });
        const duration = Date.now() - startTime;

        const perf = this.modelPerformance.get(model)!;
        perf.isWarmedUp = true;
        perf.averageResponseTime = duration;
        perf.successCount = 1;
        perf.lastSuccessTime = Date.now();

        this.logger.debug(`✅ Warmed up model: ${model} (${duration}ms)`);
      } catch (error) {
        this.logger.warn(`⚠️  Failed to warm up model ${model}: ${error.message}`);
        const perf = this.modelPerformance.get(model)!;
        perf.failureCount = 1;
      }
    });

    await Promise.allSettled(warmupPromises);

    const warmedCount = Array.from(this.modelPerformance.values())
      .filter(p => p.isWarmedUp).length;

    this.logger.log(`🔥 Warmed up ${warmedCount}/${this.embeddingModels.length} models`);
  }

  private getSortedModelsByPerformance(): string[] {
    return this.embeddingModels.sort((a, b) => {
      const perfA = this.modelPerformance.get(a)!;
      const perfB = this.modelPerformance.get(b)!;

      // Prioritize warmed up models
      if (perfA.isWarmedUp && !perfB.isWarmedUp) return -1;
      if (!perfA.isWarmedUp && perfB.isWarmedUp) return 1;

      // Then by success rate
      const successRateA = perfA.successCount / (perfA.successCount + perfA.failureCount + 1);
      const successRateB = perfB.successCount / (perfB.successCount + perfB.failureCount + 1);

      if (successRateA !== successRateB) {
        return successRateB - successRateA;
      }

      // Then by average response time (lower is better)
      return perfA.averageResponseTime - perfB.averageResponseTime;
    });
  }

  private updateModelPerformance(model: string, duration: number, success: boolean): void {
    const perf = this.modelPerformance.get(model)!;

    if (success) {
      perf.successCount++;
      perf.lastSuccessTime = Date.now();
      perf.isWarmedUp = true;

      // Update average response time with weighted average
      if (perf.averageResponseTime === 0) {
        perf.averageResponseTime = duration;
      } else {
        perf.averageResponseTime = (perf.averageResponseTime * 0.7) + (duration * 0.3);
      }
    } else {
      perf.failureCount++;
    }
  }

  private getCachedEmbedding(text: string): number[] | null {
    const cacheKey = this.generateCacheKey(text);
    const cached = this.embeddingCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
      return cached.embedding;
    }

    return null;
  }

  private setCachedEmbedding(text: string, embedding: number[]): void {
    const cacheKey = this.generateCacheKey(text);
    this.embeddingCache.set(cacheKey, {
      embedding,
      timestamp: Date.now()
    });

    // Clean old cache entries periodically
    if (this.embeddingCache.size > 1000) {
      this.cleanCache();
    }
  }

  private generateCacheKey(text: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private cleanCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, value] of this.embeddingCache.entries()) {
      if (now - value.timestamp > 300000) { // Older than 5 minutes
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.embeddingCache.delete(key));
    this.logger.debug(`🧹 Cleaned ${toDelete.length} old cache entries`);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.hf) {
      throw new Error('Hugging Face client not initialized');
    }

    const cleanText = text.trim().substring(0, 8000);

    // Check cache first
    const cached = this.getCachedEmbedding(cleanText);
    if (cached) {
      this.logger.debug('📋 Using cached embedding');
      return cached;
    }

    // Get models sorted by performance
    const sortedModels = this.getSortedModelsByPerformance();

    // Try each model with retry logic
    for (let i = 0; i < sortedModels.length; i++) {
      const model = sortedModels[i];
      const maxRetries = i === 0 ? 2 : 1; // More retries for best model

      for (let retry = 0; retry <= maxRetries; retry++) {
        try {
          this.logger.debug(`Attempting embedding with ${model} (attempt ${retry + 1}/${maxRetries + 1})`);

          const startTime = Date.now();

          // Progressive timeout: first model gets longer timeout
          const timeout = i === 0 ? 30000 : 15000;
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeout / 1000}s`)), timeout)
          );

          const embeddingPromise = this.hf.featureExtraction({
            model: model,
            inputs: cleanText
          });

          const response = await Promise.race([embeddingPromise, timeoutPromise]);
          const duration = Date.now() - startTime;

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

          // Verify dimension consistency
          if (embedding.length !== this.embeddingDimension) {
            throw new Error(`Model ${model} returned ${embedding.length}d vectors, expected ${this.embeddingDimension}d`);
          }

          // Update performance tracking
          this.updateModelPerformance(model, duration, true);

          // Cache the result
          this.setCachedEmbedding(cleanText, embedding);

          this.logger.debug(`✅ Generated embedding with ${model} in ${duration}ms`);

          if (i > 0) {
            this.logger.warn(`⚠️  Used fallback model ${i + 1}: ${model}`);
          }

          return embedding;

        } catch (error) {
          const duration = Date.now() - Date.now();
          this.updateModelPerformance(model, duration, false);

          this.logger.error(`❌ Model ${model} attempt ${retry + 1} failed: ${error.message}`);

          if (retry === maxRetries) {
            // This was the last retry for this model
            if (i === sortedModels.length - 1) {
              // This was the last model
              this.logger.error('🚨 All embedding models failed!');
              throw new Error(`All ${sortedModels.length} embedding models failed. Last error: ${error.message}`);
            }
            // Try next model
            break;
          }

          // Wait before retry with exponential backoff
          const waitTime = Math.min(1000 * Math.pow(2, retry), 5000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error('Unexpected error in embedding generation');
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
    performance: Array<{ model: string; avgTime: number; successRate: number; isWarmedUp: boolean }>;
  }> {
    const working: string[] = [];
    const failed: string[] = [];
    const testText = "test embedding generation";
    const performance: Array<{ model: string; avgTime: number; successRate: number; isWarmedUp: boolean }> = [];

    for (const model of this.embeddingModels) {
      const perf = this.modelPerformance.get(model)!;
      const successRate = perf.successCount / (perf.successCount + perf.failureCount + 1);

      performance.push({
        model,
        avgTime: Math.round(perf.averageResponseTime),
        successRate: Math.round(successRate * 100) / 100,
        isWarmedUp: perf.isWarmedUp
      });

      try {
        const startTime = Date.now();
        await Promise.race([
          this.hf.featureExtraction({
            model: model,
            inputs: testText
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);

        const duration = Date.now() - startTime;
        working.push(model);
        this.updateModelPerformance(model, duration, true);
        this.logger.debug(`✅ Model ${model} is working (${duration}ms)`);
      } catch (error) {
        failed.push(model);
        this.updateModelPerformance(model, 0, false);
        this.logger.debug(`❌ Model ${model} failed: ${error.message}`);
      }
    }

    this.logger.log(`Embedding models health check: ${working.length}/${this.embeddingModels.length} working`);

    return {
      working,
      failed,
      recommended: working.length > 0 ? this.getSortedModelsByPerformance()[0] : 'none available',
      performance
    };
  }

  isReady(): boolean {
    return this.isInitialized && !!this.pinecone && !!this.hf;
  }

  getModelPerformanceStats(): Array<{ model: string; avgTime: number; successRate: number; isWarmedUp: boolean }> {
    return Array.from(this.modelPerformance.entries()).map(([model, perf]) => ({
      model,
      avgTime: Math.round(perf.averageResponseTime),
      successRate: Math.round((perf.successCount / (perf.successCount + perf.failureCount + 1)) * 100) / 100,
      isWarmedUp: perf.isWarmedUp
    }));
  }

  isEnabled(): boolean {
    return !!this.pinecone;
  }
}
