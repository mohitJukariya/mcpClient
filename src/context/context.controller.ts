import { Controller, Get, Post, Delete, Param, Query, Body } from '@nestjs/common';
import { ContextUserService, TestUser, UserContextEntry } from './context-user.service';
import { ContextStorageService } from './context-storage.service';
import { ContextGraphService } from './context-graph.service';

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
  constructor(
    private contextUserService: ContextUserService,
    private contextStorageService: ContextStorageService,
    private contextGraphService: ContextGraphService
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
        for (const toolName of frontendContextData.toolsUsed) {
          await this.contextStorageService.storeToolUsage(contextId, toolName);
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

}
