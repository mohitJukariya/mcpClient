import { Injectable, Logger } from '@nestjs/common';

interface PerformanceMetrics {
    responseTime: number;
    timestamp: number;
    toolsUsed: string[];
    success: boolean;
    errorType?: string;
    sessionId: string;
    userId?: string;
}

interface AggregatedMetrics {
    averageResponseTime: number;
    totalRequests: number;
    successRate: number;
    popularTools: { [toolName: string]: number };
    errorTypes: { [errorType: string]: number };
    p95ResponseTime: number;
    p99ResponseTime: number;
}

@Injectable()
export class PerformanceMonitorService {
    private readonly logger = new Logger(PerformanceMonitorService.name);
    private metrics: PerformanceMetrics[] = [];
    private readonly MAX_METRICS = 10000; // Keep last 10k metrics
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // Cleanup every 5 minutes

    constructor() {
        // Setup periodic cleanup
        setInterval(() => {
            this.cleanupOldMetrics();
        }, this.CLEANUP_INTERVAL);
    }

    recordMetric(metric: PerformanceMetrics): void {
        this.metrics.push(metric);

        // Log slow requests
        if (metric.responseTime > 5000) { // 5 seconds
            this.logger.warn(`Slow request detected: ${metric.responseTime}ms for session ${metric.sessionId}`);
        }

        // Log errors
        if (!metric.success && metric.errorType) {
            this.logger.error(`Request failed: ${metric.errorType} for session ${metric.sessionId}`);
        }

        // Maintain size limit
        if (this.metrics.length > this.MAX_METRICS) {
            this.metrics = this.metrics.slice(-this.MAX_METRICS);
        }
    }

    getAggregatedMetrics(timeWindowMinutes = 60): AggregatedMetrics {
        const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
        const recentMetrics = this.metrics.filter(m => m.timestamp > cutoffTime);

        if (recentMetrics.length === 0) {
            return {
                averageResponseTime: 0,
                totalRequests: 0,
                successRate: 0,
                popularTools: {},
                errorTypes: {},
                p95ResponseTime: 0,
                p99ResponseTime: 0
            };
        }

        const responseTimes = recentMetrics.map(m => m.responseTime).sort((a, b) => a - b);
        const successCount = recentMetrics.filter(m => m.success).length;

        // Calculate percentiles
        const p95Index = Math.floor(responseTimes.length * 0.95);
        const p99Index = Math.floor(responseTimes.length * 0.99);

        // Count tool usage
        const toolCounts: { [toolName: string]: number } = {};
        const errorCounts: { [errorType: string]: number } = {};

        recentMetrics.forEach(metric => {
            metric.toolsUsed.forEach(tool => {
                toolCounts[tool] = (toolCounts[tool] || 0) + 1;
            });

            if (!metric.success && metric.errorType) {
                errorCounts[metric.errorType] = (errorCounts[metric.errorType] || 0) + 1;
            }
        });

        return {
            averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
            totalRequests: recentMetrics.length,
            successRate: (successCount / recentMetrics.length) * 100,
            popularTools: toolCounts,
            errorTypes: errorCounts,
            p95ResponseTime: responseTimes[p95Index] || 0,
            p99ResponseTime: responseTimes[p99Index] || 0
        };
    }

    // Get performance stats for a specific user
    getUserPerformance(userId: string, timeWindowMinutes = 60): Partial<AggregatedMetrics> {
        const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
        const userMetrics = this.metrics.filter(m =>
            m.userId === userId && m.timestamp > cutoffTime
        );

        if (userMetrics.length === 0) {
            return { totalRequests: 0 };
        }

        const responseTimes = userMetrics.map(m => m.responseTime);
        const successCount = userMetrics.filter(m => m.success).length;

        return {
            averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
            totalRequests: userMetrics.length,
            successRate: (successCount / userMetrics.length) * 100
        };
    }

    private cleanupOldMetrics(): void {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // Keep 24 hours
        const beforeCount = this.metrics.length;
        this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
        const cleaned = beforeCount - this.metrics.length;

        if (cleaned > 0) {
            this.logger.debug(`Cleaned up ${cleaned} old performance metrics`);
        }
    }

    // Health check based on recent performance
    getHealthStatus(): { status: 'healthy' | 'degraded' | 'unhealthy'; details: any } {
        const metrics = this.getAggregatedMetrics(10); // Last 10 minutes

        const isHealthy = metrics.successRate > 95 && metrics.averageResponseTime < 3000;
        const isDegraded = metrics.successRate > 85 && metrics.averageResponseTime < 8000;

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (isHealthy) {
            status = 'healthy';
        } else if (isDegraded) {
            status = 'degraded';
        } else {
            status = 'unhealthy';
        }

        return {
            status,
            details: {
                averageResponseTime: Math.round(metrics.averageResponseTime),
                successRate: Math.round(metrics.successRate * 100) / 100,
                totalRequests: metrics.totalRequests,
                p95ResponseTime: Math.round(metrics.p95ResponseTime)
            }
        };
    }
}
