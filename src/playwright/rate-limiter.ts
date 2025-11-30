import { ErrorCode, ErrorHandler } from '../utils/error-handler.js';

/** Configuration for rate limiter behavior */
export interface RateLimiterConfig {
  /** Maximum requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum tracked timestamps (prevents unbounded memory growth) */
  maxTracked?: number;
}

/** Result of a rate limit check */
export interface RateLimitStatus {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Milliseconds until window resets */
  resetMs: number;
}

/** Default configuration values */
const DEFAULT_MAX_TRACKED = 100;

/**
 * Sliding window rate limiter.
 *
 * Uses efficient timestamp filtering with memory bounds
 * to prevent unbounded growth during high traffic.
 */
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

  /**
   * Check if a request is within rate limits and consume a token.
   * @throws {MCPPlaywrightError} VALIDATION_FAILED if limit exceeded
   */
  checkLimit(): void {
    const status = this.getStatus();

    if (!status.allowed) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `Rate limit exceeded: Maximum ${this.maxRequests} requests per ${Math.round(this.windowMs / 1000)} seconds`
      );
    }

    // Consume a token by recording timestamp
    this.timestamps.push(Date.now());
  }

  /**
   * Get current rate limit status without consuming a token.
   */
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

  /**
   * Reset the rate limiter state.
   * Useful for testing or administrative operations.
   */
  reset(): void {
    this.timestamps = [];
  }

  /**
   * Remove expired timestamps and enforce memory bounds.
   * Uses binary search for efficiency with sorted timestamps.
   */
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

/**
 * Factory function for creating rate limiters with common presets.
 */
export const RateLimiters = {
  /**
   * Create a rate limiter for session creation.
   * @param maxPerMinute Maximum sessions allowed per minute
   */
  forSessions(maxPerMinute: number): RateLimiter {
    return new RateLimiter({
      maxRequests: maxPerMinute,
      windowMs: 60_000,
      maxTracked: maxPerMinute * 2,
    });
  },

  /**
   * Create a rate limiter for API requests.
   * @param maxPerSecond Maximum requests allowed per second
   */
  forRequests(maxPerSecond: number): RateLimiter {
    return new RateLimiter({
      maxRequests: maxPerSecond,
      windowMs: 1_000,
      maxTracked: maxPerSecond * 10,
    });
  },
} as const;

export default RateLimiter;
