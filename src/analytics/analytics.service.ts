import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { ContextStorageService } from '../context/context-storage.service';

export interface EmbeddingStats {
  totalEmbeddings: number;
  totalSessions: number;
  averageMessagesPerSession: number;
  topTools: Array<{ tool: string; count: number }>;
  messageTypeDistribution: { user: number; assistant: number };
  dailyActivity: Array<{ date: string; count: number }>;
  recentActivity: Array<{
    sessionId: string;
    messageCount: number;
    lastActivity: string;
    toolsUsed: string[];
  }>;
}

export interface UsagePatterns {
  popularQuestions: Array<{ question: string; frequency: number; avgResponseTime?: number }>;
  toolUsageStats: Array<{
    tool: string;
    usage: number;
    successRate: number;
    avgResponseTime: number;
  }>;
  sessionDurations: Array<{ duration: number; sessionId: string }>;
  timeBasedPatterns: {
    hourlyDistribution: Array<{ hour: number; count: number }>;
    weeklyDistribution: Array<{ day: string; count: number }>;
  };
}

export interface SearchAnalytics {
  similarityScoreDistribution: Array<{ range: string; count: number }>;
  contextUsageStats: {
    queriesWithContext: number;
    queriesWithoutContext: number;
    averageContextItems: number;
  };
  topSimilarQueries: Array<{
    query1: string;
    query2: string;
    similarityScore: number;
  }>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private embeddingsService: EmbeddingsService,
    private contextStorage: ContextStorageService
  ) { }

  async getEmbeddingStats(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<EmbeddingStats> {
    try {
      this.logger.log(`Getting embedding stats for ${timeRange}`);

      // Get Pinecone index stats
      const indexStats = await this.embeddingsService.getIndexStats();

      // Get date filter for time range
      const dateFilter = this.getDateFilter(timeRange);

      // Mock data for now - in a real implementation, you'd query Pinecone with filters
      const mockStats: EmbeddingStats = {
        totalEmbeddings: indexStats.totalVectorCount || 0,
        totalSessions: 12,
        averageMessagesPerSession: 4.5,
        topTools: [
          { tool: 'getGasPrice', count: 45 },
          { tool: 'getBalance', count: 38 },
          { tool: 'getTransaction', count: 32 },
          { tool: 'getTokenBalance', count: 28 },
          { tool: 'getTransactionHistory', count: 25 }
        ],
        messageTypeDistribution: { user: 124, assistant: 118 },
        dailyActivity: this.generateDailyActivity(timeRange),
        recentActivity: [
          {
            sessionId: 'user-001',
            messageCount: 8,
            lastActivity: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            toolsUsed: ['getGasPrice', 'getBalance']
          },
          {
            sessionId: 'user-002',
            messageCount: 6,
            lastActivity: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            toolsUsed: ['getContractAbi', 'getTransaction']
          },
          {
            sessionId: 'user-003',
            messageCount: 12,
            lastActivity: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
            toolsUsed: ['getTransactionHistory', 'getTokenBalance']
          }
        ]
      };

      return mockStats;

    } catch (error) {
      this.logger.error('Error getting embedding stats:', error);
      throw error;
    }
  }

  async getUsagePatterns(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<UsagePatterns> {
    try {
      this.logger.log(`Getting usage patterns for ${timeRange}`);

      // Mock data for demonstration
      const mockPatterns: UsagePatterns = {
        popularQuestions: [
          { question: "What's the current gas price?", frequency: 45, avgResponseTime: 1200 },
          { question: "Check balance for [ADDRESS]", frequency: 38, avgResponseTime: 1500 },
          { question: "Get transaction details", frequency: 32, avgResponseTime: 2100 },
          { question: "Show token balance", frequency: 28, avgResponseTime: 1800 },
          { question: "Validate ethereum address", frequency: 25, avgResponseTime: 800 }
        ],
        toolUsageStats: [
          { tool: 'getGasPrice', usage: 45, successRate: 98.5, avgResponseTime: 1200 },
          { tool: 'getBalance', usage: 38, successRate: 95.2, avgResponseTime: 1500 },
          { tool: 'getTransaction', usage: 32, successRate: 92.8, avgResponseTime: 2100 },
          { tool: 'getTokenBalance', usage: 28, successRate: 94.1, avgResponseTime: 1800 },
          { tool: 'validateAddress', usage: 25, successRate: 99.8, avgResponseTime: 800 }
        ],
        sessionDurations: [
          { sessionId: 'user-001', duration: 1200000 }, // 20 minutes
          { sessionId: 'user-002', duration: 1800000 }, // 30 minutes
          { sessionId: 'user-003', duration: 2400000 }  // 40 minutes
        ],
        timeBasedPatterns: {
          hourlyDistribution: this.generateHourlyDistribution(),
          weeklyDistribution: this.generateWeeklyDistribution()
        }
      };

      return mockPatterns;

    } catch (error) {
      this.logger.error('Error getting usage patterns:', error);
      throw error;
    }
  }

  async getSearchAnalytics(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<SearchAnalytics> {
    try {
      this.logger.log(`Getting search analytics for ${timeRange}`);

      // Mock data for demonstration
      const mockAnalytics: SearchAnalytics = {
        similarityScoreDistribution: [
          { range: '0.9-1.0', count: 45 },
          { range: '0.8-0.9', count: 123 },
          { range: '0.7-0.8', count: 89 },
          { range: '0.6-0.7', count: 67 },
          { range: '0.5-0.6', count: 34 },
          { range: '0.0-0.5', count: 12 }
        ],
        contextUsageStats: {
          queriesWithContext: 234,
          queriesWithoutContext: 45,
          averageContextItems: 2.3
        },
        topSimilarQueries: [
          { query1: "What's the gas price?", query2: "How much gas does it cost?", similarityScore: 0.89 },
          { query1: "Check balance", query2: "What's my balance?", similarityScore: 0.87 },
          { query1: "Transaction details", query2: "Show transaction info", similarityScore: 0.85 }
        ]
      };

      return mockAnalytics;

    } catch (error) {
      this.logger.error('Error getting search analytics:', error);
      throw error;
    }
  }

  async getSystemHealth(): Promise<{
    pineconeStatus: 'healthy' | 'degraded' | 'down';
    indexSize: number;
    lastUpdateTime: string;
    embeddingModel: string;
    responseTime: number;
    storageHealth: any;
  }> {
    try {
      const startTime = Date.now();

      // Get storage health
      const storageHealth = await this.contextStorage.getStorageHealth();

      // Get Pinecone stats
      const indexStats = await this.embeddingsService.getIndexStats();

      const responseTime = Date.now() - startTime;

      return {
        pineconeStatus: indexStats.error ? 'down' : 'healthy',
        indexSize: indexStats.totalVectorCount || 0,
        lastUpdateTime: new Date().toISOString(),
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        responseTime,
        storageHealth
      };

    } catch (error) {
      this.logger.error('Error checking system health:', error);
      return {
        pineconeStatus: 'down',
        indexSize: 0,
        lastUpdateTime: new Date().toISOString(),
        embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
        responseTime: -1,
        storageHealth: { redis: 'down', neo4j: 'down', pinecone: 'down' }
      };
    }
  }

  async getCompleteAnalytics(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<{
    stats: EmbeddingStats;
    patterns: UsagePatterns;
    searchAnalytics: SearchAnalytics;
    health: any;
    generatedAt: string;
    timeRange: string;
  }> {
    const [stats, patterns, searchAnalytics, health] = await Promise.all([
      this.getEmbeddingStats(timeRange),
      this.getUsagePatterns(timeRange),
      this.getSearchAnalytics(timeRange),
      this.getSystemHealth()
    ]);

    return {
      stats,
      patterns,
      searchAnalytics,
      health,
      generatedAt: new Date().toISOString(),
      timeRange
    };
  }

  private getDateFilter(timeRange: 'day' | 'week' | 'month'): string {
    const now = new Date();
    let daysAgo: number;

    switch (timeRange) {
      case 'day':
        daysAgo = 1;
        break;
      case 'week':
        daysAgo = 7;
        break;
      case 'month':
        daysAgo = 30;
        break;
      default:
        daysAgo = 7;
    }

    const filterDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    return filterDate.toISOString();
  }

  private generateDailyActivity(timeRange: 'day' | 'week' | 'month'): Array<{ date: string; count: number }> {
    const days = timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30;
    const activity = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      activity.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 20) + 5
      });
    }

    return activity;
  }

  private generateHourlyDistribution(): Array<{ hour: number; count: number }> {
    const distribution = [];
    for (let hour = 0; hour < 24; hour++) {
      // Simulate higher activity during business hours
      let baseCount = 5;
      if (hour >= 9 && hour <= 17) {
        baseCount = 15;
      } else if (hour >= 18 && hour <= 22) {
        baseCount = 10;
      }

      distribution.push({
        hour,
        count: baseCount + Math.floor(Math.random() * 10)
      });
    }
    return distribution;
  }

  private generateWeeklyDistribution(): Array<{ day: string; count: number }> {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.map(day => ({
      day,
      count: day === 'Saturday' || day === 'Sunday' ?
        Math.floor(Math.random() * 20) + 10 :
        Math.floor(Math.random() * 40) + 20
    }));
  }
}
