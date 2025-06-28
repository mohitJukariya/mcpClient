import { Injectable, Logger } from '@nestjs/common';

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

@Injectable()
export class RateLimitService {
    private readonly logger = new Logger(RateLimitService.name);
    private readonly limits = new Map<string, RateLimitEntry>();

    // Rate limits (requests per minute)
    private readonly USER_LIMIT = 60; // 60 requests per minute per user
    private readonly GLOBAL_LIMIT = 1000; // 1000 requests per minute globally
    private readonly WINDOW_MS = 60 * 1000; // 1 minute window

    checkRateLimit(identifier: string, isGlobal = false): { allowed: boolean; remaining: number; resetTime: number } {
        const now = Date.now();
        const limit = isGlobal ? this.GLOBAL_LIMIT : this.USER_LIMIT;

        const entry = this.limits.get(identifier);

        if (!entry || now > entry.resetTime) {
            // Create new entry or reset expired entry
            const resetTime = now + this.WINDOW_MS;
            this.limits.set(identifier, { count: 1, resetTime });

            return {
                allowed: true,
                remaining: limit - 1,
                resetTime
            };
        }

        if (entry.count >= limit) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.resetTime
            };
        }

        // Increment count
        entry.count++;
        this.limits.set(identifier, entry);

        return {
            allowed: true,
            remaining: limit - entry.count,
            resetTime: entry.resetTime
        };
    }

    // Clean up expired entries periodically
    cleanupExpiredEntries(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.limits.entries()) {
            if (now > entry.resetTime) {
                this.limits.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
        }
    }

    // Get current stats
    getStats(): { totalEntries: number; activeUsers: number } {
        const now = Date.now();
        let activeUsers = 0;

        for (const [, entry] of this.limits.entries()) {
            if (now <= entry.resetTime) {
                activeUsers++;
            }
        }

        return {
            totalEntries: this.limits.size,
            activeUsers
        };
    }
}
