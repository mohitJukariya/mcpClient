import { Controller, Get, Post, Delete, Param, Query, Body } from '@nestjs/common';
import { ContextUserService, TestUser, UserContextEntry } from './context-user.service';
import { ContextStorageService } from './context-storage.service';
import { ContextGraphService } from './context-graph.service';

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
    @Body() contextEntry: UserContextEntry
  ): Promise<{ success: boolean; storedContext: any }> {
    const user = await this.contextUserService.getUserById(userId);
    if (!user) {
      return { success: false, storedContext: null };
    }

    const storedContext = await this.contextStorageService.storeUserContext(user, contextEntry);
    await this.contextUserService.addContextEntry(userId, contextEntry);

    return { success: true, storedContext };
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
}
