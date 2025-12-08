// Rate Limiter - Sliding window rate limiter with memory bounds

import type { RateLimiterConfig, RateLimitStatus } from '../config/types.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { DEFAULT_MAX_TRACKED_REQUESTS } from '../utils/constants.js';

export type { RateLimiterConfig, RateLimitStatus };

/**
 * Sliding window rate limiter with memory bounds.
 *
 * Tracks request timestamps within a configurable time window and enforces
 * a maximum request count. Uses binary search for efficient timestamp pruning.
 *
 * Memory is bounded by `maxTracked` to prevent unbounded growth under high load.
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({
 *   maxRequests: 10,
 *   windowMs: 60_000, // 1 minute
 *   maxTracked: 100
 * });
 *
 * limiter.checkLimit(); // Throws if rate limit exceeded
 * ```
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxTracked: number;

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.maxTracked = config.maxTracked ?? DEFAULT_MAX_TRACKED_REQUESTS;
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
