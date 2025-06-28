import { Controller, Get, Logger } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.service';
import { PerformanceMonitorService } from '../monitoring/performance.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { McpService } from '../mcp/mcp.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

interface HealthResponse {
    status: string;
    timestamp: string;
    responseTime: number;
    [key: string]: any;
}

@Controller('api/health')
export class HealthController {
    private readonly logger = new Logger(HealthController.name);

    constructor(
        private readonly configService: ConfigurationService,
        private readonly performanceService: PerformanceMonitorService,
        private readonly rateLimitService: RateLimitService,
        private readonly mcpService: McpService,
        private readonly embeddingsService: EmbeddingsService,
    ) { }

    @Get()
    async getHealthStatus() {
        const startTime = Date.now();

        try {
            const [
                systemHealth,
                mcpHealth,
                embeddingsHealth,
                performanceHealth,
                rateLimitStats
            ] = await Promise.all([
                this.checkSystemHealth(),
                this.checkMcpHealth(),
                this.checkEmbeddingsHealth(),
                this.performanceService.getHealthStatus(),
                this.rateLimitService.getStats()
            ]);

            const responseTime = Date.now() - startTime;
            const overallHealth = this.determineOverallHealth([
                systemHealth.status,
                mcpHealth.status,
                embeddingsHealth.status,
                performanceHealth.status
            ]);

            return {
                status: overallHealth,
                timestamp: new Date().toISOString(),
                responseTime,
                services: {
                    system: systemHealth,
                    mcp: mcpHealth,
                    embeddings: embeddingsHealth,
                    performance: performanceHealth,
                    rateLimit: {
                        status: 'healthy',
                        ...rateLimitStats
                    }
                },
                configuration: this.configService.getConfigSummary(),
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            };
        } catch (error) {
            this.logger.error('Health check failed:', error);
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                responseTime: Date.now() - startTime,
                error: error.message
            };
        }
    }

    @Get('detailed')
    async getDetailedHealth(): Promise<HealthResponse> {
        const startTime = Date.now();

        try {
            const performanceMetrics = this.performanceService.getAggregatedMetrics(60);
            const systemHealth = await this.checkSystemHealth();

            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                responseTime: Date.now() - startTime,
                system: {
                    ...systemHealth,
                    uptime: process.uptime(),
                    memory: {
                        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                        external: Math.round(process.memoryUsage().external / 1024 / 1024)
                    },
                    cpu: process.cpuUsage()
                },
                performance: performanceMetrics,
                configuration: this.configService.getConfig()
            };
        } catch (error) {
            this.logger.error('Detailed health check failed:', error);
            throw error;
        }
    }

    @Get('ping')
    ping() {
        return {
            status: 'pong',
            timestamp: new Date().toISOString()
        };
    }

    private async checkSystemHealth() {
        try {
            const memoryUsage = process.memoryUsage();
            const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
            const memoryPercentage = (memoryUsedMB / memoryTotalMB) * 100;

            const status = memoryPercentage > 90 ? 'unhealthy' :
                memoryPercentage > 70 ? 'degraded' : 'healthy';

            return {
                status,
                uptime: Math.floor(process.uptime()),
                memory: {
                    used: memoryUsedMB,
                    total: memoryTotalMB,
                    percentage: Math.round(memoryPercentage)
                },
                nodeVersion: process.version,
                platform: process.platform
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    private async checkMcpHealth() {
        try {
            // Try to get available tools to test MCP connection
            const tools = await this.mcpService.getAvailableTools();

            return {
                status: tools.length > 0 ? 'healthy' : 'degraded',
                toolsAvailable: tools.length,
                tools: tools.map(t => t.name)
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    private async checkEmbeddingsHealth() {
        try {
            // Test embeddings service with a simple query
            const testEmbedding = await this.embeddingsService.generateEmbedding('health check test');

            return {
                status: testEmbedding && testEmbedding.length > 0 ? 'healthy' : 'unhealthy',
                embeddingDimension: testEmbedding?.length || 0
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    private determineOverallHealth(statuses: string[]): 'healthy' | 'degraded' | 'unhealthy' {
        if (statuses.includes('unhealthy')) {
            return 'unhealthy';
        }
        if (statuses.includes('degraded')) {
            return 'degraded';
        }
        return 'healthy';
    }
}
