import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) { }

  @Get('stats')
  async getEmbeddingStats(@Query('timeRange') timeRange: 'day' | 'week' | 'month' = 'week') {
    return this.analyticsService.getEmbeddingStats(timeRange);
  }

  @Get('usage-patterns')
  async getUsagePatterns(@Query('timeRange') timeRange: 'day' | 'week' | 'month' = 'week') {
    return this.analyticsService.getUsagePatterns(timeRange);
  }

  @Get('search-analytics')
  async getSearchAnalytics(@Query('timeRange') timeRange: 'day' | 'week' | 'month' = 'week') {
    return this.analyticsService.getSearchAnalytics(timeRange);
  }

  @Get('health')
  async getSystemHealth() {
    return this.analyticsService.getSystemHealth();
  }

  @Get('overview')
  async getAnalyticsOverview(@Query('timeRange') timeRange: 'day' | 'week' | 'month' = 'week') {
    return this.analyticsService.getCompleteAnalytics(timeRange);
  }
}
