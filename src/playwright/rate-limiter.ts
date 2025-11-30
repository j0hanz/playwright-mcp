// Rate Limiter - Sliding window rate limiter with memory bounds

import { ErrorHandler } from '../utils/error-handler.js';

export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  maxTracked?: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

const DEFAULT_MAX_TRACKED = 100;

export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxTracked: number;

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.maxTracked = config.maxTracked ?? DEFAULT_MAX_TRACKED;
  }

  checkLimit(): void {
    const status = this.getStatus();

    if (!status.allowed) {
      throw ErrorHandler.rateLimitExceeded(
        this.maxRequests,
        Math.round(this.windowMs / 1000)
      );
    }

    // Consume a token by recording timestamp
    this.timestamps.push(Date.now());
  }

  getStatus(): RateLimitStatus {
    this.pruneExpired();

    const remaining = Math.max(0, this.maxRequests - this.timestamps.length);
    const oldestTimestamp = this.timestamps[0];
    const resetMs = oldestTimestamp
      ? Math.max(0, oldestTimestamp + this.windowMs - Date.now())
      : 0;

    return {
      allowed: this.timestamps.length < this.maxRequests,
      remaining,
      resetMs,
    };
  }

  reset(): void {
    this.timestamps = [];
  }

  private pruneExpired(): void {
    const cutoff = Date.now() - this.windowMs;

    // Binary search to find first valid timestamp (timestamps are naturally sorted)
    let left = 0;
    let right = this.timestamps.length;
    while (left < right) {
      const mid = (left + right) >>> 1;
      if (this.timestamps[mid] <= cutoff) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // Remove expired timestamps in-place (more efficient than filter)
    if (left > 0) {
      this.timestamps.splice(0, left);
    }

    // Enforce memory bounds
    if (this.timestamps.length > this.maxTracked) {
      this.timestamps.splice(0, this.timestamps.length - this.maxTracked);
    }
  }
}

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;

export const RateLimiters = {
  forSessions(maxPerMinute: number): RateLimiter {
    return new RateLimiter({
      maxRequests: maxPerMinute,
      windowMs: MS_PER_MINUTE,
      maxTracked: maxPerMinute * 2,
    });
  },

  forRequests(maxPerSecond: number): RateLimiter {
    return new RateLimiter({
      maxRequests: maxPerSecond,
      windowMs: MS_PER_SECOND,
      maxTracked: maxPerSecond * 10,
    });
  },
} as const;

export default RateLimiter;
