import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export interface ConversationKVCache {
    conversationId: string;
    userId: string;
    personalityId: string;

    // Compressed conversation state
    conversationSummary: string;
    currentIntent: string;

    // Active context entities
    activeAddresses: string[];
    activeTokens: string[];
    activeTransactions: string[];

    // Tool usage context
    lastToolsUsed: Array<{
        tool: string;
        params: Record<string, any>;
        result: any;
        timestamp: number;
        resultSummary?: string;
    }>;

    // User preferences learned
    userPreferences: {
        focusAreas: string[];
        preferredTools: string[];
        responseStyle: string;
        gasPriceSensitivity?: 'low' | 'medium' | 'high';
    };

    // Cached computations
    computedInsights: Record<string, any>;

    // Context optimization
    tokenOptimization: {
        compressedSystemPrompt: string;
        entityReferences: Record<string, string>; // Short refs to long addresses
        intentBasedToolList: string[]; // Only relevant tools for current intent
    };

    // Metadata
    lastUpdated: number;
    expiresAt: number;
    turnCount: number;
}

export interface ToolResultCache {
    toolName: string;
    params: Record<string, any>;
    result: any;
    resultSummary: string;
    timestamp: number;
    ttl: number;
}

export interface OptimizedPromptContext {
    compressedContext: string;
    relevantTools: string[];
    entityReferences: Record<string, string>;
    estimatedTokens: number;
}

@Injectable()
export class KVCacheService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KVCacheService.name);
    private redis: Redis;

    // Cache TTL configurations (in seconds)
    private readonly CONVERSATION_TTL = 3600; // 1 hour
    private readonly TOOL_RESULT_TTL = 300; // 5 minutes for blockchain data
    private readonly GAS_PRICE_TTL = 30; // 30 seconds for gas prices
    private readonly BALANCE_TTL = 60; // 1 minute for balances

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        await this.initializeRedis();
    }

    async onModuleDestroy() {
        if (this.redis) {
            await this.redis.quit();
        }
    }

    private async initializeRedis() {
        try {
            this.redis = new Redis({
                host: this.configService.get<string>('REDIS_HOST', 'localhost'),
                port: this.configService.get<number>('REDIS_PORT', 6379),
                password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                keyPrefix: 'kv_cache:',
            });

            await this.redis.ping();
            this.logger.log('✅ KV Cache Redis connection established');
        } catch (error) {
            this.logger.warn('⚠️ Redis connection failed for KV Cache:', error.message);
            this.redis = null;
        }
    }

    // ===========================================
    // CONVERSATION CACHE MANAGEMENT
    // ===========================================

    async getConversationCache(conversationId: string): Promise<ConversationKVCache | null> {
        if (!this.redis) return null;

        try {
            const cached = await this.redis.get(`conv:${conversationId}`);
            if (!cached) return null;

            const cache = JSON.parse(cached) as ConversationKVCache;

            // Check if cache is expired
            if (Date.now() > cache.expiresAt) {
                await this.redis.del(`conv:${conversationId}`);
                return null;
            }

            this.logger.debug(`📥 Retrieved conversation cache: ${conversationId}`);
            return cache;
        } catch (error) {
            this.logger.error(`Error retrieving conversation cache: ${error.message}`);
            return null;
        }
    }

    async storeConversationCache(cache: ConversationKVCache): Promise<void> {
        if (!this.redis) return;

        try {
            cache.lastUpdated = Date.now();
            cache.expiresAt = Date.now() + (this.CONVERSATION_TTL * 1000);

            await this.redis.setex(
                `conv:${cache.conversationId}`,
                this.CONVERSATION_TTL,
                JSON.stringify(cache)
            );

            this.logger.debug(`📤 Stored conversation cache: ${cache.conversationId}`);
        } catch (error) {
            this.logger.error(`Error storing conversation cache: ${error.message}`);
        }
    }

    async initializeConversationCache(
        conversationId: string,
        userId: string,
        personalityId: string,
        initialQuery: string
    ): Promise<ConversationKVCache> {
        const intent = this.inferInitialIntent(initialQuery);

        const cache: ConversationKVCache = {
            conversationId,
            userId,
            personalityId,
            conversationSummary: `Initial ${intent} session`,
            currentIntent: intent,
            activeAddresses: this.extractAddresses(initialQuery),
            activeTokens: [],
            activeTransactions: [],
            lastToolsUsed: [],
            userPreferences: {
                focusAreas: [intent],
                preferredTools: [],
                responseStyle: 'detailed'
            },
            computedInsights: {},
            tokenOptimization: {
                compressedSystemPrompt: this.generateCompressedSystemPrompt(intent, personalityId),
                entityReferences: {},
                intentBasedToolList: this.getRelevantToolsForIntent(intent)
            },
            lastUpdated: Date.now(),
            expiresAt: Date.now() + (this.CONVERSATION_TTL * 1000),
            turnCount: 0
        };

        await this.storeConversationCache(cache);
        return cache;
    }

    // ===========================================
    // TOOL RESULT CACHING
    // ===========================================

    async getCachedToolResult(toolName: string, params: Record<string, any>): Promise<ToolResultCache | null> {
        if (!this.redis) return null;

        try {
            const cacheKey = this.generateToolCacheKey(toolName, params);
            const cached = await this.redis.get(`tool:${cacheKey}`);

            if (!cached) return null;

            const result = JSON.parse(cached) as ToolResultCache;

            // Check TTL
            if (Date.now() > (result.timestamp + (result.ttl * 1000))) {
                await this.redis.del(`tool:${cacheKey}`);
                return null;
            }

            this.logger.debug(`🔧 Cache HIT for tool: ${toolName}`);
            return result;
        } catch (error) {
            this.logger.error(`Error retrieving tool cache: ${error.message}`);
            return null;
        }
    }

    async storeToolResult(
        toolName: string,
        params: Record<string, any>,
        result: any
    ): Promise<void> {
        if (!this.redis) return;

        try {
            const ttl = this.getToolTTL(toolName);
            const cacheKey = this.generateToolCacheKey(toolName, params);

            const toolCache: ToolResultCache = {
                toolName,
                params,
                result,
                resultSummary: this.generateResultSummary(toolName, result),
                timestamp: Date.now(),
                ttl
            };

            await this.redis.setex(
                `tool:${cacheKey}`,
                ttl,
                JSON.stringify(toolCache)
            );

            this.logger.debug(`🔧 Cached tool result: ${toolName} (TTL: ${ttl}s)`);
        } catch (error) {
            this.logger.error(`Error storing tool result: ${error.message}`);
        }
    }

    // ===========================================
    // CONVERSATION UPDATE METHODS
    // ===========================================

    async updateConversationWithToolUsage(
        conversationId: string,
        toolName: string,
        params: Record<string, any>,
        result: any
    ): Promise<void> {
        const cache = await this.getConversationCache(conversationId);
        if (!cache) return;

        // Add tool usage to cache
        cache.lastToolsUsed.push({
            tool: toolName,
            params,
            result,
            timestamp: Date.now(),
            resultSummary: this.generateResultSummary(toolName, result)
        });

        // Keep only last 3 tool calls to prevent cache bloat
        if (cache.lastToolsUsed.length > 3) {
            cache.lastToolsUsed = cache.lastToolsUsed.slice(-3);
        }

        // Update entities based on tool usage
        this.updateEntitiesFromToolUsage(cache, toolName, params, result);

        // Update intent if needed
        this.updateIntentFromToolUsage(cache, toolName);

        // Update user preferences
        this.updateUserPreferences(cache, toolName);

        // Update summary
        cache.conversationSummary = this.generateConversationSummary(cache);

        // Increment turn count
        cache.turnCount++;

        await this.storeConversationCache(cache);
    }

    async updateConversationWithNewQuery(
        conversationId: string,
        query: string
    ): Promise<void> {
        const cache = await this.getConversationCache(conversationId);
        if (!cache) return;

        // Extract new entities from query
        const newAddresses = this.extractAddresses(query);
        cache.activeAddresses = [...new Set([...cache.activeAddresses, ...newAddresses])];

        // Update intent if query suggests different focus
        const newIntent = this.inferIntentFromQuery(query, cache.currentIntent);
        if (newIntent !== cache.currentIntent) {
            cache.currentIntent = newIntent;
            cache.tokenOptimization.intentBasedToolList = this.getRelevantToolsForIntent(newIntent);
        }

        // Update entity references for token optimization
        this.updateEntityReferences(cache);

        await this.storeConversationCache(cache);
    }

    // ===========================================
    // TOKEN OPTIMIZATION
    // ===========================================

    async getOptimizedPromptContext(conversationId: string): Promise<OptimizedPromptContext | null> {
        const cache = await this.getConversationCache(conversationId);
        if (!cache) return null;

        const compressedContext = this.buildCompressedContext(cache);

        // 🚨 CRITICAL FIX: Don't just use intent-based tools, include diverse tool set
        let relevantTools: string[] = [];

        // Always include the most commonly used core tools
        const coreTools = ['getBalance', 'getGasPrice', 'getTransaction', 'getTransactionHistory'];
        relevantTools.push(...coreTools);

        // Add intent-based tools
        const intentTools = this.getRelevantToolsForIntent(cache.currentIntent);
        relevantTools.push(...intentTools);

        // Add tools from recent usage
        const recentTools = cache.lastToolsUsed.map(t => t.tool);
        relevantTools.push(...recentTools);

        // Add tools based on active entities
        if (cache.activeAddresses.length > 0) {
            relevantTools.push('getBalance', 'getTransactionHistory', 'getERC20Transfers', 'validateAddress');
        }
        if (cache.activeTokens.length > 0) {
            relevantTools.push('getTokenInfo', 'getTokenBalance', 'getERC20Transfers');
        }
        if (cache.activeTransactions.length > 0) {
            relevantTools.push('getTransaction', 'getTransactionReceipt', 'getTransactionStatus');
        }

        // Add user's preferred tools
        if (cache.userPreferences.preferredTools.length > 0) {
            relevantTools.push(...cache.userPreferences.preferredTools);
        }

        // Remove duplicates and limit to reasonable number
        relevantTools = [...new Set(relevantTools)].slice(0, 15); // Keep top 15 tools

        // 🚨 FALLBACK: If somehow we have very few tools, add more diversity
        if (relevantTools.length < 8) {
            const diverseTools = [
                'getBalance', 'getGasPrice', 'getTransaction', 'getTransactionHistory',
                'getTokenInfo', 'getGasOracle', 'getLatestBlock', 'getMultiBalance',
                'getERC20Transfers', 'getBlock', 'validateAddress', 'getAddressType'
            ];
            relevantTools = [...new Set([...relevantTools, ...diverseTools])].slice(0, 12);
        }

        this.logger.debug(`🔧 Context tools for ${cache.currentIntent}: ${relevantTools.join(', ')}`);

        return {
            compressedContext,
            relevantTools,
            entityReferences: cache.tokenOptimization.entityReferences,
            estimatedTokens: this.estimateTokenCount(compressedContext)
        };
    }

    private buildCompressedContext(cache: ConversationKVCache): string {
        const parts = [];

        // Core context (always included)
        parts.push(`Intent: ${cache.currentIntent}`);
        parts.push(`User: ${cache.personalityId} (${cache.userPreferences.responseStyle})`);

        // Active entities (compressed)
        if (cache.activeAddresses.length > 0) {
            const refs = cache.activeAddresses.map(addr =>
                cache.tokenOptimization.entityReferences[addr] || this.shortenAddress(addr)
            );
            parts.push(`Addresses: ${refs.join(', ')}`);
        }

        // Recent tool results (summarized)
        if (cache.lastToolsUsed.length > 0) {
            const recentTool = cache.lastToolsUsed[cache.lastToolsUsed.length - 1];
            parts.push(`Last: ${recentTool.tool} → ${recentTool.resultSummary}`);
        }

        // Key insights
        const insights = Object.values(cache.computedInsights).slice(0, 2);
        if (insights.length > 0) {
            parts.push(`Insights: ${insights.join('; ')}`);
        }

        return parts.join(' | ');
    }

    // ===========================================
    // HELPER METHODS
    // ===========================================

    private inferInitialIntent(query: string): string {
        const lowQuery = query.toLowerCase();

        if (lowQuery.includes('gas') || lowQuery.includes('fee')) return 'gas_analysis';
        if (lowQuery.includes('balance')) return 'balance_check';
        if (lowQuery.includes('transaction') || lowQuery.includes('tx')) return 'transaction_analysis';
        if (lowQuery.includes('token')) return 'token_analysis';
        if (lowQuery.includes('defi') || lowQuery.includes('liquidity')) return 'defi_analysis';
        if (lowQuery.includes('contract')) return 'contract_analysis';

        return 'general_blockchain_query';
    }

    private inferIntentFromQuery(query: string, currentIntent: string): string {
        const newIntent = this.inferInitialIntent(query);

        // Only change intent if the new query is clearly about something different
        if (newIntent === 'general_blockchain_query') {
            return currentIntent; // Keep current intent
        }

        return newIntent;
    }

    private extractAddresses(text: string): string[] {
        const addressRegex = /0x[a-fA-F0-9]{40}/g;
        return text.match(addressRegex) || [];
    }

    private shortenAddress(address: string): string {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    private generateCompressedSystemPrompt(intent: string, personalityId: string): string {
        const intentPrompts = {
            gas_analysis: 'Gas optimization expert. Focus: costs, timing, efficiency.',
            balance_check: 'Balance analyzer. Focus: holdings, portfolio value.',
            transaction_analysis: 'Transaction expert. Focus: history, patterns, details.',
            token_analysis: 'Token specialist. Focus: ERC20/721, transfers, metadata.',
            defi_analysis: 'DeFi analyst. Focus: protocols, liquidity, yields.',
            contract_analysis: 'Contract expert. Focus: verification, functions, events.',
            general_blockchain_query: 'Blockchain analyst. Multi-purpose crypto expertise.'
        };

        const personalityTraits = {
            alice: 'Analytical, detail-oriented',
            bob: 'Practical, cost-focused',
            charlie: 'Technical, thorough'
        };

        return `${intentPrompts[intent] || intentPrompts.general_blockchain_query} Style: ${personalityTraits[personalityId] || 'Professional'}`;
    }

    private getRelevantToolsForIntent(intent: string): string[] {
        const toolMap = {
            gas_analysis: ['getGasPrice', 'getGasOracle', 'estimateGas'],
            balance_check: ['getBalance', 'getTokenBalance', 'getMultiBalance'],
            transaction_analysis: ['getTransaction', 'getTransactionHistory', 'getTransactionReceipt', 'getInternalTransactions'],
            token_analysis: ['getTokenInfo', 'getTokenBalance', 'getERC20Transfers', 'getERC721Transfers'],
            defi_analysis: ['getTokenInfo', 'getERC20Transfers', 'getBalance', 'getTransactionHistory'],
            contract_analysis: ['getContractSource', 'getContractAbi', 'getAddressType'],
            general_blockchain_query: ['getBalance', 'getGasPrice', 'getTransaction', 'getBlock']
        };

        return toolMap[intent] || toolMap.general_blockchain_query;
    }

    private generateToolCacheKey(toolName: string, params: Record<string, any>): string {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((obj, key) => {
                obj[key] = params[key];
                return obj;
            }, {});

        return `${toolName}:${JSON.stringify(sortedParams)}`;
    }

    private getToolTTL(toolName: string): number {
        const ttlMap = {
            getGasPrice: this.GAS_PRICE_TTL,
            getGasOracle: this.GAS_PRICE_TTL,
            getBalance: this.BALANCE_TTL,
            getTokenBalance: this.BALANCE_TTL,
            getMultiBalance: this.BALANCE_TTL,
            // Other tools use default TTL
        };

        return ttlMap[toolName] || this.TOOL_RESULT_TTL;
    }

    private generateResultSummary(toolName: string, result: any): string {
        try {
            switch (toolName) {
                case 'getGasPrice':
                    return `${result.gasPrice || result} gwei`;
                case 'getBalance':
                    return `${result.formatted || result} ETH`;
                case 'getTokenBalance':
                    return `${result.formatted || result} ${result.symbol || 'tokens'}`;
                case 'getTransaction':
                    return `${result.status} tx, ${result.value || 0} ETH`;
                case 'getTransactionHistory':
                    return `${result.length || 0} transactions`;
                default:
                    return JSON.stringify(result).slice(0, 50) + '...';
            }
        } catch {
            return 'Result cached';
        }
    }

    private updateEntitiesFromToolUsage(
        cache: ConversationKVCache,
        toolName: string,
        params: Record<string, any>,
        result: any
    ): void {
        // Extract addresses from params
        if (params.address) {
            if (!cache.activeAddresses.includes(params.address)) {
                cache.activeAddresses.push(params.address);
            }
        }

        // Extract token addresses
        if (params.tokenAddress || params.contractAddress) {
            const tokenAddr = params.tokenAddress || params.contractAddress;
            if (!cache.activeTokens.includes(tokenAddr)) {
                cache.activeTokens.push(tokenAddr);
            }
        }

        // Extract transaction hashes
        if (params.txHash || params.transactionHash) {
            const txHash = params.txHash || params.transactionHash;
            if (!cache.activeTransactions.includes(txHash)) {
                cache.activeTransactions.push(txHash);
            }
        }

        // Limit entity arrays to prevent bloat
        cache.activeAddresses = cache.activeAddresses.slice(-5);
        cache.activeTokens = cache.activeTokens.slice(-3);
        cache.activeTransactions = cache.activeTransactions.slice(-3);
    }

    private updateIntentFromToolUsage(cache: ConversationKVCache, toolName: string): void {
        const toolToIntentMap = {
            getGasPrice: 'gas_analysis',
            getGasOracle: 'gas_analysis',
            getBalance: 'balance_check',
            getTokenBalance: 'token_analysis',
            getTransaction: 'transaction_analysis',
            getTransactionHistory: 'transaction_analysis',
            getContractSource: 'contract_analysis',
            getContractAbi: 'contract_analysis'
        };

        const suggestedIntent = toolToIntentMap[toolName];
        if (suggestedIntent && suggestedIntent !== cache.currentIntent) {
            // Only change if we've used similar tools multiple times
            const recentSimilarTools = cache.lastToolsUsed
                .filter(t => toolToIntentMap[t.tool] === suggestedIntent)
                .length;

            if (recentSimilarTools >= 2) {
                cache.currentIntent = suggestedIntent;
                cache.tokenOptimization.intentBasedToolList = this.getRelevantToolsForIntent(suggestedIntent);
            }
        }
    }

    private updateUserPreferences(cache: ConversationKVCache, toolName: string): void {
        // Track preferred tools
        if (!cache.userPreferences.preferredTools.includes(toolName)) {
            cache.userPreferences.preferredTools.push(toolName);
        }

        // Move frequently used tools to front
        cache.userPreferences.preferredTools.sort((a, b) => {
            const aCount = cache.lastToolsUsed.filter(t => t.tool === a).length;
            const bCount = cache.lastToolsUsed.filter(t => t.tool === b).length;
            return bCount - aCount;
        });

        // Limit to top 5 preferred tools
        cache.userPreferences.preferredTools = cache.userPreferences.preferredTools.slice(0, 5);
    }

    private generateConversationSummary(cache: ConversationKVCache): string {
        const parts = [];

        parts.push(`${cache.currentIntent.replace('_', ' ')} session`);

        if (cache.turnCount > 0) {
            parts.push(`(${cache.turnCount} turns)`);
        }

        if (cache.activeAddresses.length > 0) {
            parts.push(`analyzing ${cache.activeAddresses.length} address${cache.activeAddresses.length > 1 ? 'es' : ''}`);
        }

        if (cache.lastToolsUsed.length > 0) {
            const recentTools = [...new Set(cache.lastToolsUsed.map(t => t.tool))];
            parts.push(`using ${recentTools.join(', ')}`);
        }

        return parts.join(', ');
    }

    private updateEntityReferences(cache: ConversationKVCache): void {
        // Create short references for long addresses
        cache.activeAddresses.forEach((addr, index) => {
            if (!cache.tokenOptimization.entityReferences[addr]) {
                cache.tokenOptimization.entityReferences[addr] = `addr${index + 1}`;
            }
        });

        cache.activeTokens.forEach((token, index) => {
            if (!cache.tokenOptimization.entityReferences[token]) {
                cache.tokenOptimization.entityReferences[token] = `token${index + 1}`;
            }
        });
    }

    private estimateTokenCount(text: string): number {
        // Rough estimation: 1 token ≈ 0.75 words
        const words = text.split(/\s+/).length;
        return Math.ceil(words * 0.75);
    }

    // ===========================================
    // PUBLIC UTILITY METHODS
    // ===========================================

    async clearConversationCache(conversationId: string): Promise<void> {
        if (!this.redis) return;

        try {
            await this.redis.del(`conv:${conversationId}`);
            this.logger.debug(`🗑️ Cleared conversation cache: ${conversationId}`);
        } catch (error) {
            this.logger.error(`Error clearing conversation cache: ${error.message}`);
        }
    }

    async getCacheStats(): Promise<{
        conversationCaches: number;
        toolCaches: number;
        totalMemoryUsage: string;
    }> {
        if (!this.redis) {
            return { conversationCaches: 0, toolCaches: 0, totalMemoryUsage: '0 MB' };
        }

        try {
            const convKeys = await this.redis.keys('conv:*');
            const toolKeys = await this.redis.keys('tool:*');

            // Use info memory command instead of memory usage
            const info = await this.redis.info('memory');
            const memMatch = info.match(/used_memory:(\d+)/);
            const memBytes = memMatch ? parseInt(memMatch[1]) : 0;

            return {
                conversationCaches: convKeys.length,
                toolCaches: toolKeys.length,
                totalMemoryUsage: `${(memBytes / 1024 / 1024).toFixed(2)} MB`
            };
        } catch (error) {
            this.logger.error(`Error getting cache stats: ${error.message}`);
            return { conversationCaches: 0, toolCaches: 0, totalMemoryUsage: 'Unknown' };
        }
    }

    async flushAllCaches(): Promise<void> {
        if (!this.redis) return;

        try {
            await this.redis.flushdb();
            this.logger.warn('🗑️ Flushed all KV caches');
        } catch (error) {
            this.logger.error(`Error flushing caches: ${error.message}`);
        }
    }
}
