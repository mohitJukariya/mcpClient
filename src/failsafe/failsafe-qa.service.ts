import { Injectable, Logger } from '@nestjs/common';

export interface FailsafeResponse {
  success: boolean;
  response: string;
  fallbackLevel: 'none' | 'cached' | 'template' | 'emergency';
  confidence: number;
  metadata: {
    originalError?: string;
    fallbackReason: string;
    timestamp: string;
  };
}

export interface CachedResponse {
  query: string;
  response: string;
  confidence: number;
  timestamp: string;
  usage: number;
}

@Injectable()
export class FailsafeQAService {
  private readonly logger = new Logger(FailsafeQAService.name);
  private cachedResponses: Map<string, CachedResponse> = new Map();
  private emergencyResponses: Map<string, string> = new Map();

  constructor() {
    this.initializeEmergencyResponses();
    this.initializeCachedResponses();
  }

  async handleFailure(
    originalQuery: string,
    error: Error,
    userId?: string
  ): Promise<FailsafeResponse> {
    this.logger.warn(`Handling failure for query: "${originalQuery}" - Error: ${error.message}`);

    // Level 1: Try cached response
    const cachedResponse = await this.tryCache(originalQuery);
    if (cachedResponse.success) {
      return cachedResponse;
    }

    // Level 2: Try template response
    const templateResponse = await this.tryTemplate(originalQuery);
    if (templateResponse.success) {
      return templateResponse;
    }

    // Level 3: Emergency response
    return this.getEmergencyResponse(originalQuery, error);
  }

  private async tryCache(query: string): Promise<FailsafeResponse> {
    const normalizedQuery = this.normalizeQuery(query);

    // Check for exact match
    const exactMatch = this.cachedResponses.get(normalizedQuery);
    if (exactMatch) {
      exactMatch.usage++;
      return {
        success: true,
        response: exactMatch.response,
        fallbackLevel: 'cached',
        confidence: exactMatch.confidence,
        metadata: {
          fallbackReason: 'Found exact cached response',
          timestamp: new Date().toISOString()
        }
      };
    }

    // Check for similar queries
    const similarMatch = this.findSimilarQuery(normalizedQuery);
    if (similarMatch) {
      similarMatch.usage++;
      return {
        success: true,
        response: `Based on a similar query: ${similarMatch.response}`,
        fallbackLevel: 'cached',
        confidence: similarMatch.confidence * 0.8, // Reduced confidence for similar match
        metadata: {
          fallbackReason: 'Found similar cached response',
          timestamp: new Date().toISOString()
        }
      };
    }

    return {
      success: false,
      response: '',
      fallbackLevel: 'none',
      confidence: 0,
      metadata: {
        fallbackReason: 'No cached response found',
        timestamp: new Date().toISOString()
      }
    };
  }

  private async tryTemplate(query: string): Promise<FailsafeResponse> {
    const queryType = this.classifyQuery(query);
    const templates = this.getTemplateResponses();

    if (templates.has(queryType)) {
      const template = templates.get(queryType)!;
      return {
        success: true,
        response: template,
        fallbackLevel: 'template',
        confidence: 0.6,
        metadata: {
          fallbackReason: `Used template for query type: ${queryType}`,
          timestamp: new Date().toISOString()
        }
      };
    }

    return {
      success: false,
      response: '',
      fallbackLevel: 'none',
      confidence: 0,
      metadata: {
        fallbackReason: 'No suitable template found',
        timestamp: new Date().toISOString()
      }
    };
  }

  private getEmergencyResponse(query: string, error: Error): FailsafeResponse {
    const errorType = this.classifyError(error);
    const emergencyMessage = this.emergencyResponses.get(errorType) ||
      this.emergencyResponses.get('general') ||
      "I'm currently experiencing technical difficulties. Please try again in a few moments.";

    return {
      success: true,
      response: emergencyMessage,
      fallbackLevel: 'emergency',
      confidence: 0.3,
      metadata: {
        originalError: error.message,
        fallbackReason: 'All other fallback methods failed',
        timestamp: new Date().toISOString()
      }
    };
  }

  async cacheSuccessfulResponse(query: string, response: string, confidence: number = 0.9): Promise<void> {
    const normalizedQuery = this.normalizeQuery(query);

    this.cachedResponses.set(normalizedQuery, {
      query: normalizedQuery,
      response,
      confidence,
      timestamp: new Date().toISOString(),
      usage: 0
    });

    // Limit cache size
    if (this.cachedResponses.size > 1000) {
      const oldestKey = Array.from(this.cachedResponses.keys())[0];
      this.cachedResponses.delete(oldestKey);
    }

    this.logger.log(`Cached successful response for: "${query}"`);
  }

  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/0x[a-f0-9]+/gi, '[ADDRESS]')
      .replace(/\d+/g, '[NUMBER]')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  private findSimilarQuery(normalizedQuery: string): CachedResponse | null {
    const queryWords = normalizedQuery.split(' ');
    let bestMatch: CachedResponse | null = null;
    let bestScore = 0;

    for (const cached of this.cachedResponses.values()) {
      const cachedWords = cached.query.split(' ');
      const similarity = this.calculateSimilarity(queryWords, cachedWords);

      if (similarity > 0.7 && similarity > bestScore) {
        bestScore = similarity;
        bestMatch = cached;
      }
    }

    return bestMatch;
  }

  private calculateSimilarity(words1: string[], words2: string[]): number {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private classifyQuery(query: string): string {
    const queryLower = query.toLowerCase();

    if (queryLower.includes('gas') || queryLower.includes('fee')) return 'gas_price';
    if (queryLower.includes('balance') || queryLower.includes('wallet')) return 'balance';
    if (queryLower.includes('transaction') || queryLower.includes('tx')) return 'transaction';
    if (queryLower.includes('block')) return 'block';
    if (queryLower.includes('contract') || queryLower.includes('abi')) return 'contract';
    if (queryLower.includes('token')) return 'token';
    if (queryLower.includes('address')) return 'address';

    return 'general';
  }

  private classifyError(error: Error): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) return 'rate_limit';
    if (errorMessage.includes('connection') || errorMessage.includes('network')) return 'network';
    if (errorMessage.includes('unauthorized') || errorMessage.includes('api key')) return 'auth';

    return 'general';
  }

  private getTemplateResponses(): Map<string, string> {
    return new Map([
      ['gas_price', 'Gas prices on Arbitrum are typically very low, usually under 0.1 Gwei. You can check the current gas price using our gas price tool.'],
      ['balance', 'To check an account balance, I need a valid Ethereum address. Please provide the address you want to check.'],
      ['transaction', 'To get transaction details, I need a transaction hash. Please provide the transaction hash you want to analyze.'],
      ['block', 'I can help you get block information. Please specify a block number or use "latest" for the most recent block.'],
      ['contract', 'For contract information, I need the contract address. I can help you get the ABI and other contract details.'],
      ['token', 'I can help you check token balances and information. Please provide the token contract address and the holder address.'],
      ['address', 'I can validate Ethereum addresses and provide various analytics. Please provide the address you want to analyze.'],
      ['general', 'I can help you with Arbitrum blockchain analytics including balances, transactions, gas prices, and more. What would you like to know?']
    ]);
  }

  private initializeEmergencyResponses(): void {
    this.emergencyResponses.set('general',
      "I'm currently experiencing technical difficulties accessing the blockchain data. " +
      "This might be due to network issues or high server load. Please try again in a few moments. " +
      "If the problem persists, the Arbitrum network might be experiencing issues."
    );

    this.emergencyResponses.set('timeout',
      "The request is taking longer than expected. This might be due to network congestion. " +
      "Please try again with a more specific query."
    );

    this.emergencyResponses.set('rate_limit',
      "I'm currently rate-limited by the blockchain API. Please wait a moment before trying again."
    );

    this.emergencyResponses.set('network',
      "There appears to be a network connectivity issue. Please check your connection and try again."
    );

    this.emergencyResponses.set('auth',
      "There's an authentication issue with the external services. Please contact support if this persists."
    );
  }

  private initializeCachedResponses(): void {
    // Pre-populate with some common queries
    this.cachedResponses.set('what is arbitrum', {
      query: 'what is arbitrum',
      response: 'Arbitrum is a Layer 2 scaling solution for Ethereum that uses optimistic rollups to provide faster and cheaper transactions while maintaining Ethereum security.',
      confidence: 0.95,
      timestamp: new Date().toISOString(),
      usage: 0
    });

    this.cachedResponses.set('how to check gas price', {
      query: 'how to check gas price',
      response: 'You can check the current gas price on Arbitrum by asking me "What\'s the current gas price?" I\'ll use the gas price tool to get real-time data.',
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      usage: 0
    });

    this.cachedResponses.set('how does arbitrum work', {
      query: 'how does arbitrum work',
      response: 'Arbitrum works by bundling multiple transactions into a single batch, then posting that batch to Ethereum mainnet. This reduces gas costs and increases throughput while maintaining security.',
      confidence: 0.88,
      timestamp: new Date().toISOString(),
      usage: 0
    });

    this.cachedResponses.set('arbitrum vs ethereum', {
      query: 'arbitrum vs ethereum',
      response: 'Arbitrum is a Layer 2 solution built on top of Ethereum. It offers faster transactions and lower fees compared to Ethereum mainnet, while inheriting Ethereum\'s security.',
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      usage: 0
    });
  }

  async getFailsafeStats(): Promise<{
    cachedResponseCount: number;
    emergencyResponseCount: number;
    topCachedQueries: Array<{ query: string; usage: number }>;
    fallbackUsageStats: Record<string, number>;
    recentFailures: Array<{ query: string; error: string; timestamp: string }>;
  }> {
    const topCachedQueries = Array.from(this.cachedResponses.values())
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10)
      .map(cached => ({ query: cached.query, usage: cached.usage }));

    return {
      cachedResponseCount: this.cachedResponses.size,
      emergencyResponseCount: this.emergencyResponses.size,
      topCachedQueries,
      fallbackUsageStats: {
        cached: 0, // Would need to track this
        template: 0,
        emergency: 0
      },
      recentFailures: [] // Would need to track this
    };
  }

  async clearCache(): Promise<void> {
    this.cachedResponses.clear();
    this.logger.log('Failsafe cache cleared');
  }

  async getCacheStats(): Promise<{
    size: number;
    oldestEntry: string;
    newestEntry: string;
    mostUsed: { query: string; usage: number } | null;
  }> {
    const entries = Array.from(this.cachedResponses.values());

    if (entries.length === 0) {
      return {
        size: 0,
        oldestEntry: '',
        newestEntry: '',
        mostUsed: null
      };
    }

    const sortedByTime = entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const sortedByUsage = entries.sort((a, b) => b.usage - a.usage);

    return {
      size: entries.length,
      oldestEntry: sortedByTime[0].timestamp,
      newestEntry: sortedByTime[sortedByTime.length - 1].timestamp,
      mostUsed: sortedByUsage[0] ? { query: sortedByUsage[0].query, usage: sortedByUsage[0].usage } : null
    };
  }
}
