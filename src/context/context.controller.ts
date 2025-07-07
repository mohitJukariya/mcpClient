import { Controller, Get, Post, Delete, Param, Query, Body, Logger } from '@nestjs/common';
import { ContextUserService, TestUser, UserContextEntry } from './context-user.service';
import { ContextStorageService } from './context-storage.service';
import { ContextGraphService } from './context-graph.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

// Frontend-compatible interfaces
interface FrontendContextData {
  query: string;
  toolsUsed?: string[];
  addressesInvolved?: string[];
  insights?: Array<{
    content: string;
    confidence: number;
  }>;
  metadata?: {
    sessionId?: string;
    timestamp?: string;
    confidence?: number;
    personality?: string;
  };
}

interface FrontendContextResponse {
  success: boolean;
  contextId: string;
  message: string;
  stored?: {
    query: boolean;
    tools: boolean;
    addresses: boolean;
    insights: boolean;
  };
}

@Controller('context')
export class ContextController {
  private readonly logger = new Logger(ContextController.name);

  constructor(
    private contextUserService: ContextUserService,
    private contextStorageService: ContextStorageService,
    private contextGraphService: ContextGraphService,
    private embeddingsService: EmbeddingsService
  ) { }

  @Get('users')
  async getAllUsers(): Promise<TestUser[]> {
    return this.contextUserService.getAllUsers();
  }

  @Get('users/:userId')
  async getUserById(@Param('userId') userId: string): Promise<TestUser | null> {
    return this.contextUserService.getUserById(userId);
  }

  @Post('users/:userId/context')
  async addUserContext(
    @Param('userId') userId: string,
    @Body() frontendContextData: FrontendContextData
  ): Promise<FrontendContextResponse> {
    try {
      // Generate unique context ID
      const contextId = `ctx-${userId}-${Date.now()}`;

      // Convert frontend format to backend format
      const contextEntry: UserContextEntry = {
        id: contextId,
        userId: userId,
        type: 'query',
        content: frontendContextData.query,
        metadata: {
          timestamp: frontendContextData.metadata?.timestamp || new Date().toISOString(),
          toolsUsed: frontendContextData.toolsUsed || [],
          confidence: frontendContextData.metadata?.confidence || 0.8,
          relatedEntries: [],
          sessionId: frontendContextData.metadata?.sessionId,
          personality: frontendContextData.metadata?.personality,
          addressesInvolved: frontendContextData.addressesInvolved || [],
          insights: frontendContextData.insights || []
        }
      };

      // Ensure user exists (get or create)
      let user = await this.contextUserService.getUserById(userId);
      if (!user) {
        // Create user if doesn't exist
        user = await this.contextUserService.createUser(userId, frontendContextData.metadata?.personality);
      }

      // Store context in graph database
      const storedContext = await this.contextStorageService.storeUserContext(user, contextEntry);

      // Add to user's context history
      await this.contextUserService.addContextEntry(userId, contextEntry);

      // Store insights if provided
      if (frontendContextData.insights && frontendContextData.insights.length > 0) {
        for (const insight of frontendContextData.insights) {
          await this.contextStorageService.storeInsight(contextId, insight.content, insight.confidence);
        }
      }

      // Store tool usage relationships
      if (frontendContextData.toolsUsed && frontendContextData.toolsUsed.length > 0) {
        for (const toolEntry of frontendContextData.toolsUsed) {
          // Validate and extract tool name - handle both string and object cases
          let toolName: string;

          if (typeof toolEntry === 'string') {
            toolName = toolEntry;
          } else if (typeof toolEntry === 'object' && toolEntry !== null) {
            // Handle case where frontend sends tool objects instead of strings
            this.logger.warn('Frontend sent tool object instead of string:', JSON.stringify(toolEntry));

            // Try to extract name from various object structures
            if ((toolEntry as any).name) {
              toolName = (toolEntry as any).name;
            } else if ((toolEntry as any).tool) {
              toolName = (toolEntry as any).tool;
            } else if ((toolEntry as any).type) {
              toolName = (toolEntry as any).type;
            } else {
              this.logger.warn('Unable to extract tool name from object:', toolEntry);
              continue; // Skip invalid entries
            }
          } else {
            this.logger.warn('Invalid tool entry type:', typeof toolEntry, toolEntry);
            continue; // Skip invalid entries
          }

          // Ensure toolName is a valid string and not a complex object
          if (typeof toolName === 'string' && toolName.length > 0 && !toolName.includes('{') && !toolName.includes('[')) {
            try {
              await this.contextStorageService.storeToolUsage(contextId, toolName);
            } catch (error) {
              this.logger.error(`Failed to store tool usage for ${toolName}:`, error.message);
              // Continue with other tools even if one fails
            }
          } else {
            this.logger.warn('Skipping invalid tool name:', toolName);
          }
        }
      }

      // Store address relationships
      if (frontendContextData.addressesInvolved && frontendContextData.addressesInvolved.length > 0) {
        for (const address of frontendContextData.addressesInvolved) {
          await this.contextStorageService.storeAddressRelationship(contextId, address);
        }
      }

      return {
        success: true,
        contextId: contextId,
        message: 'Context stored successfully',
        stored: {
          query: true,
          tools: (frontendContextData.toolsUsed?.length || 0) > 0,
          addresses: (frontendContextData.addressesInvolved?.length || 0) > 0,
          insights: (frontendContextData.insights?.length || 0) > 0
        }
      };

    } catch (error) {
      console.error('Error storing context:', error);
      return {
        success: false,
        contextId: '',
        message: `Failed to store context: ${error.message}`
      };
    }
  }

  @Get('graph/visualization')
  async getGraphVisualization(@Query('userId') userId?: string) {
    return this.contextGraphService.generateVisualization(userId);
  }

  @Get('graph/insights/:userId')
  async getContextInsights(@Param('userId') userId: string) {
    return this.contextGraphService.getContextInsights(userId);
  }

  @Get('graph/stats')
  async getGraphStats() {
    return this.contextGraphService.getGraphStats();
  }

  @Get('storage/health')
  async getStorageHealth() {
    return this.contextStorageService.getStorageHealth();
  }

  @Get('kv/:key')
  async getFromKV(@Param('key') key: string) {
    const data = await this.contextStorageService.getFromKV(key);
    return { key, data, found: data !== null };
  }

  @Post('kv/:key')
  async storeInKV(
    @Param('key') key: string,
    @Body() body: { data: any; ttl?: number }
  ) {
    await this.contextStorageService.storeInKV(key, body.data, body.ttl);
    return { success: true, key };
  }

  @Delete('kv/:key')
  async deleteFromKV(@Param('key') key: string) {
    const deleted = await this.contextStorageService.deleteFromKV(key);
    return { success: deleted, key };
  }

  @Post('graph/query')
  async queryGraph(@Body() body: { cypher: string; parameters?: Record<string, any> }) {
    const results = await this.contextStorageService.queryGraph(body.cypher, body.parameters);
    return { results, count: results.length };
  }

  @Get('search/vector')
  async searchVector(
    @Query('query') query: string,
    @Query('userId') userId?: string
  ) {
    const results = await this.contextStorageService.searchVector(query, userId);
    return { query, results, count: results.length };
  }

  @Delete('database/clear')
  async clearDatabase() {
    const neo4jResult = await this.contextStorageService.clearDatabase();
    const redisResult = await this.contextStorageService.clearRedisKV();

    return {
      neo4j: neo4jResult,
      redis: redisResult,
      success: neo4jResult.success && redisResult.success,
      message: neo4jResult.success && redisResult.success
        ? 'All databases cleared successfully'
        : 'Some databases failed to clear'
    };
  }

  @Get('health')
  async getSystemHealth() {
    const storageHealth = await this.contextStorageService.getStorageHealth();
    const embeddingHealth = await this.embeddingsService.checkEmbeddingModelsHealth();
    const embeddingPerformance = this.embeddingsService.getModelPerformanceStats();

    return {
      storage: storageHealth,
      embeddings: {
        ready: this.embeddingsService.isReady(),
        models: embeddingHealth,
        performance: embeddingPerformance
      },
      timestamp: new Date().toISOString(),
      overall: storageHealth.redis !== 'down' &&
        storageHealth.neo4j !== 'down' &&
        storageHealth.pinecone !== 'down' &&
        this.embeddingsService.isReady() ? 'healthy' : 'degraded'
    };
  }

  @Get('health/embeddings')
  async getEmbeddingHealth() {
    const health = await this.embeddingsService.checkEmbeddingModelsHealth();
    const performance = this.embeddingsService.getModelPerformanceStats();

    return {
      ready: this.embeddingsService.isReady(),
      models: health,
      performance,
      timestamp: new Date().toISOString()
    };
  }

  @Post('health/embeddings/test')
  async testEmbedding(@Body() body: { text?: string }) {
    const testText = body.text || "This is a test embedding to check performance.";

    try {
      const startTime = Date.now();
      const embedding = await this.embeddingsService.generateEmbedding(testText);
      const duration = Date.now() - startTime;

      return {
        success: true,
        text: testText,
        dimension: embedding.length,
        duration,
        performance: duration < 5000 ? 'excellent' :
          duration < 15000 ? 'good' :
            duration < 30000 ? 'slow' : 'very_slow',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

}
