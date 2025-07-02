import { Controller, Get, Delete, Param, Post, Body } from '@nestjs/common';
import { KVCacheService } from './kv-cache.service';

@Controller('cache')
export class CacheController {
    constructor(private kvCacheService: KVCacheService) { }

    @Get('stats')
    async getCacheStats() {
        return this.kvCacheService.getCacheStats();
    }

    @Get('conversation/:conversationId')
    async getConversationCache(@Param('conversationId') conversationId: string) {
        const cache = await this.kvCacheService.getConversationCache(conversationId);
        return { conversationId, cache };
    }

    @Delete('conversation/:conversationId')
    async clearConversationCache(@Param('conversationId') conversationId: string) {
        await this.kvCacheService.clearConversationCache(conversationId);
        return { success: true, message: `Cleared cache for conversation: ${conversationId}` };
    }

    @Delete('all')
    async flushAllCaches() {
        await this.kvCacheService.flushAllCaches();
        return { success: true, message: 'All caches flushed' };
    }

    @Post('conversation/init')
    async initializeConversationCache(@Body() body: {
        conversationId: string;
        userId: string;
        personalityId: string;
        initialQuery: string;
    }) {
        await this.kvCacheService.initializeConversationCache(
            body.conversationId,
            body.userId,
            body.personalityId,
            body.initialQuery
        );

        return {
            success: true,
            message: `Initialized cache for conversation: ${body.conversationId}`
        };
    }

    @Get('health')
    async getCacheHealth() {
        try {
            const stats = await this.kvCacheService.getCacheStats();
            return {
                status: 'healthy',
                redis: 'connected',
                cacheStats: stats
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                redis: 'disconnected',
                error: error.message
            };
        }
    }
}
