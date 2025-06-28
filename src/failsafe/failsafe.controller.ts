import { Controller, Get, Post, Body, Param, Query, Delete } from '@nestjs/common';
import { FailsafeQAService } from './failsafe-qa.service';

@Controller('failsafe')
export class FailsafeController {
  constructor(private failsafeService: FailsafeQAService) { }

  @Post('handle-failure')
  async handleFailure(@Body() body: {
    query: string;
    error: string;
    userId?: string;
  }) {
    const error = new Error(body.error);
    return this.failsafeService.handleFailure(body.query, error, body.userId);
  }

  @Post('cache-response')
  async cacheResponse(@Body() body: {
    query: string;
    response: string;
    confidence?: number;
  }) {
    await this.failsafeService.cacheSuccessfulResponse(
      body.query,
      body.response,
      body.confidence
    );
    return { success: true, cached: true };
  }

  @Get('stats')
  async getFailsafeStats() {
    return this.failsafeService.getFailsafeStats();
  }

  @Get('cache/stats')
  async getCacheStats() {
    return this.failsafeService.getCacheStats();
  }

  @Delete('cache')
  async clearCache() {
    await this.failsafeService.clearCache();
    return { success: true, cleared: true };
  }

  @Get('test-fallback')
  async testFallback(@Query('query') query: string, @Query('errorType') errorType: string = 'general') {
    const error = new Error(`Test error: ${errorType}`);
    return this.failsafeService.handleFailure(query, error);
  }
}
