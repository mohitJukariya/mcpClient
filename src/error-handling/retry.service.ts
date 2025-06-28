import { Injectable, Logger } from '@nestjs/common';

interface RetryOptions {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
    retryableErrors: string[];
}

@Injectable()
export class RetryService {
    private readonly logger = new Logger(RetryService.name);

    private readonly defaultOptions: RetryOptions = {
        maxAttempts: 3,
        baseDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds
        backoffFactor: 2,
        retryableErrors: [
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'RATE_LIMIT_EXCEEDED',
            'SERVICE_UNAVAILABLE',
            'INTERNAL_SERVER_ERROR'
        ]
    };

    async executeWithRetry<T>(
        operation: () => Promise<T>,
        options: Partial<RetryOptions> = {},
        context?: string
    ): Promise<T> {
        const opts = { ...this.defaultOptions, ...options };
        let lastError: Error;

        for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
            try {
                const result = await operation();

                if (attempt > 1) {
                    this.logger.log(`${context || 'Operation'} succeeded on attempt ${attempt}`);
                }

                return result;
            } catch (error) {
                lastError = error;

                if (attempt === opts.maxAttempts) {
                    this.logger.error(`${context || 'Operation'} failed after ${opts.maxAttempts} attempts:`, error.message);
                    break;
                }

                if (!this.isRetryableError(error, opts.retryableErrors)) {
                    this.logger.warn(`${context || 'Operation'} failed with non-retryable error:`, error.message);
                    break;
                }

                const delay = this.calculateDelay(attempt, opts);
                this.logger.warn(`${context || 'Operation'} attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);

                await this.sleep(delay);
            }
        }

        throw lastError;
    }

    private isRetryableError(error: any, retryableErrors: string[]): boolean {
        if (!error) return false;

        const errorCode = error.code || error.name || '';
        const errorMessage = error.message || '';

        return retryableErrors.some(retryableError =>
            errorCode.includes(retryableError) ||
            errorMessage.includes(retryableError)
        );
    }

    private calculateDelay(attempt: number, options: RetryOptions): number {
        const delay = options.baseDelay * Math.pow(options.backoffFactor, attempt - 1);
        return Math.min(delay, options.maxDelay);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Enhanced error handling with categorization
export class EnhancedError extends Error {
    constructor(
        message: string,
        public category: 'validation' | 'network' | 'llm' | 'tool' | 'system' | 'rate_limit',
        public retryable: boolean = false,
        public context?: any
    ) {
        super(message);
        this.name = 'EnhancedError';
    }
}

@Injectable()
export class ErrorHandlerService {
    private readonly logger = new Logger(ErrorHandlerService.name);

    categorizeError(error: any): EnhancedError {
        if (error instanceof EnhancedError) {
            return error;
        }

        const message = error.message || 'Unknown error';
        const errorCode = error.code || '';
        const statusCode = error.status || error.statusCode || 0;

        // Network errors
        if (errorCode.includes('ECONNRESET') || errorCode.includes('ENOTFOUND') ||
            errorCode.includes('ECONNREFUSED') || errorCode.includes('ETIMEDOUT')) {
            return new EnhancedError(message, 'network', true, { code: errorCode });
        }

        // Rate limiting
        if (statusCode === 429 || message.includes('rate limit')) {
            return new EnhancedError(message, 'rate_limit', true, { statusCode });
        }

        // LLM errors
        if (message.includes('Hugging Face') || message.includes('model') ||
            message.includes('inference') || message.includes('token')) {
            return new EnhancedError(message, 'llm', statusCode >= 500, { statusCode });
        }

        // Tool errors
        if (message.includes('tool') || message.includes('MCP')) {
            return new EnhancedError(message, 'tool', statusCode >= 500, { statusCode });
        }

        // Validation errors
        if (statusCode === 400 || message.includes('validation') ||
            message.includes('invalid') || message.includes('required')) {
            return new EnhancedError(message, 'validation', false, { statusCode });
        }

        // System errors
        return new EnhancedError(message, 'system', statusCode >= 500, { statusCode, originalError: error });
    }

    getErrorResponse(error: EnhancedError): {
        error: string;
        category: string;
        retryable: boolean;
        suggestion?: string
    } {
        const suggestions = {
            validation: 'Please check your input format and try again.',
            network: 'Network issue detected. Please try again in a moment.',
            llm: 'AI service temporarily unavailable. Please try again later.',
            tool: 'Blockchain data service is having issues. Please try again.',
            rate_limit: 'Too many requests. Please wait a moment before trying again.',
            system: 'System error occurred. Please try again or contact support.'
        };

        return {
            error: error.message,
            category: error.category,
            retryable: error.retryable,
            suggestion: suggestions[error.category]
        };
    }
}
