import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppConfig {
    // LLM Configuration
    llm: {
        model: string;
        maxTokens: number;
        temperature: number;
        timeout: number;
        retryAttempts: number;
    };

    // Rate Limiting
    rateLimit: {
        windowMs: number;
        userLimit: number;
        globalLimit: number;
    };

    // Performance Monitoring
    monitoring: {
        slowRequestThreshold: number;
        metricsRetentionHours: number;
        healthCheckIntervalMs: number;
    };

    // Security
    security: {
        maxInputLength: number;
        allowedOrigins: string[];
        enableCors: boolean;
    };

    // Embeddings
    embeddings: {
        model: string;
        dimension: number;
        similarityThreshold: number;
        maxSimilarMessages: number;
    };
}

@Injectable()
export class ConfigurationService {
    private readonly logger = new Logger(ConfigurationService.name);
    private config: AppConfig;

    constructor(private configService: ConfigService) {
        this.loadConfiguration();
        this.validateConfiguration();
    }

    private loadConfiguration(): void {
        this.config = {
            llm: {
                model: this.configService.get<string>('HUGGINGFACE_MODEL', 'mistralai/Mistral-7B-Instruct-v0.3'),
                maxTokens: this.configService.get<number>('LLM_MAX_TOKENS', 256),
                temperature: this.configService.get<number>('LLM_TEMPERATURE', 0.1),
                timeout: this.configService.get<number>('LLM_TIMEOUT_MS', 30000),
                retryAttempts: this.configService.get<number>('LLM_RETRY_ATTEMPTS', 3)
            },
            rateLimit: {
                windowMs: this.configService.get<number>('RATE_LIMIT_WINDOW_MS', 60000),
                userLimit: this.configService.get<number>('RATE_LIMIT_USER', 60),
                globalLimit: this.configService.get<number>('RATE_LIMIT_GLOBAL', 1000)
            },
            monitoring: {
                slowRequestThreshold: this.configService.get<number>('SLOW_REQUEST_THRESHOLD_MS', 5000),
                metricsRetentionHours: this.configService.get<number>('METRICS_RETENTION_HOURS', 24),
                healthCheckIntervalMs: this.configService.get<number>('HEALTH_CHECK_INTERVAL_MS', 300000)
            },
            security: {
                maxInputLength: this.configService.get<number>('MAX_INPUT_LENGTH', 1000),
                allowedOrigins: this.configService.get<string>('ALLOWED_ORIGINS', '*').split(','),
                enableCors: this.configService.get<boolean>('ENABLE_CORS', true)
            },
            embeddings: {
                model: this.configService.get<string>('EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2'),
                dimension: this.configService.get<number>('EMBEDDING_DIMENSION', 384),
                similarityThreshold: this.configService.get<number>('SIMILARITY_THRESHOLD', 0.75),
                maxSimilarMessages: this.configService.get<number>('MAX_SIMILAR_MESSAGES', 5)
            }
        };
    }

    private validateConfiguration(): void {
        const requiredKeys = [
            'HUGGINGFACE_API_KEY',
            'PINECONE_API_KEY',
            'PINECONE_INDEX_NAME',
            'MCP_SERVER_BASE_URL'
        ];

        const missingKeys = requiredKeys.filter(key => !this.configService.get(key));

        if (missingKeys.length > 0) {
            throw new Error(`Missing required configuration keys: ${missingKeys.join(', ')}`);
        }

        // Validate numeric ranges
        if (this.config.llm.maxTokens < 50 || this.config.llm.maxTokens > 4000) {
            this.logger.warn('LLM_MAX_TOKENS should be between 50 and 4000');
        }

        if (this.config.llm.temperature < 0 || this.config.llm.temperature > 2) {
            this.logger.warn('LLM_TEMPERATURE should be between 0 and 2');
        }

        if (this.config.embeddings.dimension < 100 || this.config.embeddings.dimension > 1536) {
            this.logger.warn('EMBEDDING_DIMENSION should be between 100 and 1536');
        }

        this.logger.log('Configuration validated successfully');
    }

    getConfig(): AppConfig {
        return this.config;
    }

    getLLMConfig() {
        return this.config.llm;
    }

    getRateLimitConfig() {
        return this.config.rateLimit;
    }

    getMonitoringConfig() {
        return this.config.monitoring;
    }

    getSecurityConfig() {
        return this.config.security;
    }

    getEmbeddingsConfig() {
        return this.config.embeddings;
    }

    // Dynamic configuration updates (for runtime changes)
    updateLLMConfig(updates: Partial<AppConfig['llm']>): void {
        this.config.llm = { ...this.config.llm, ...updates };
        this.logger.log('LLM configuration updated', updates);
    }

    updateRateLimitConfig(updates: Partial<AppConfig['rateLimit']>): void {
        this.config.rateLimit = { ...this.config.rateLimit, ...updates };
        this.logger.log('Rate limit configuration updated', updates);
    }

    // Get configuration summary for health checks
    getConfigSummary(): any {
        return {
            llm: {
                model: this.config.llm.model,
                maxTokens: this.config.llm.maxTokens,
                temperature: this.config.llm.temperature
            },
            rateLimit: {
                userLimit: this.config.rateLimit.userLimit,
                windowMs: this.config.rateLimit.windowMs
            },
            embeddings: {
                model: this.config.embeddings.model,
                dimension: this.config.embeddings.dimension
            },
            security: {
                maxInputLength: this.config.security.maxInputLength,
                corsEnabled: this.config.security.enableCors
            }
        };
    }
}
