/**
 * Session Manager - Manages browser session lifecycle
 *
 * Handles browser session creation, retrieval, and cleanup with:
 * - Rate limiting to prevent resource exhaustion
 * - Capacity management for concurrent sessions
 * - Activity tracking for session expiration
 * - Page management within sessions
 *
 * @see https://playwright.dev/docs/browser-contexts for context documentation
 */
import type { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

import config from '../config/server-config.js';
import type {
  BrowserSession,
  SessionCleanupCallback,
  SessionCreateOptions,
  SessionInfo,
  SessionManagerConfig,
} from '../config/types.js';
import {
  ErrorCode,
  ErrorHandler,
  toError,
  validateUUID,
} from '../utils/error-handler.js';
import { SESSION_CACHE_TTL_MS } from '../utils/constants.js';
import type { Logger } from '../utils/logger.js';
import { RateLimiterConfig, RateLimitStatus } from '../config/types.js';
import {
  DEFAULT_MAX_TRACKED_REQUESTS,
  MS_PER_MINUTE,
} from '../utils/constants.js';

/**
 * Sliding window rate limiter with memory bounds.
 */
class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxTracked: number;

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.maxTracked = config.maxTracked ?? DEFAULT_MAX_TRACKED_REQUESTS;
  }

  consumeToken(): void {
    const status = this.getStatus();

    if (!status.allowed) {
      throw ErrorHandler.rateLimitExceeded(
        this.maxRequests,
        Math.round(this.windowMs / 1000)
      );
    }
    this.timestamps.push(Date.now());
  }

  canAccept(): boolean {
    this.pruneExpired();
    return this.timestamps.length < this.maxRequests;
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
    // Use slice assignment instead of splice to avoid O(n) element shifting
    if (left > 0) {
      this.timestamps = this.timestamps.slice(left);
    }
    if (this.timestamps.length > this.maxTracked) {
      this.timestamps = this.timestamps.slice(-this.maxTracked);
    }
  }
}

export class SessionManager {
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly cleanupInProgress = new Set<string>();
  private readonly rateLimiter: RateLimiter;
  private readonly config: SessionManagerConfig;

  // Session list cache with TTL
  private sessionListCache: SessionInfo[] | null = null;
  private cacheTimestamp = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private readonly logger: Logger,
    configOverrides?: Partial<SessionManagerConfig>
  ) {
    this.config = {
      maxConcurrentSessions:
        configOverrides?.maxConcurrentSessions ?? config.maxConcurrentSessions,
      maxSessionsPerMinute:
        configOverrides?.maxSessionsPerMinute ??
        config.limits.maxSessionsPerMinute,
    };

    this.rateLimiter = new RateLimiter({
      maxRequests: this.config.maxSessionsPerMinute,
      windowMs: MS_PER_MINUTE,
      maxTracked: this.config.maxSessionsPerMinute * 2,
    });
  }

  // Capacity and Rate Limiting

  checkRateLimit(): void {
    this.rateLimiter.consumeToken();
  }

  checkCapacity(): void {
    if (this.sessions.size >= this.config.maxConcurrentSessions) {
      throw ErrorHandler.capacityExceeded(
        this.sessions.size,
        this.config.maxConcurrentSessions
      );
    }
  }

  getRemainingCapacity(): number {
    return Math.max(0, this.config.maxConcurrentSessions - this.sessions.size);
  }

  // Session Lifecycle

  createSession(options: SessionCreateOptions): string {
    const { browser, context, browserType, headless } = options;
    const sessionId = uuidv4();

    const session: BrowserSession = {
      id: sessionId,
      browser,
      context,
      pages: new Map(),
      metadata: {
        browserType,
        launchTime: new Date(),
        lastActivity: new Date(),
        headless,
      },
    };

    this.sessions.set(sessionId, session);
    this.invalidateCache();
    this.logger.info('Browser session created', {
      sessionId,
      browserType,
      headless,
    });

    return sessionId;
  }

  getSession(sessionId: string): BrowserSession {
    validateUUID(sessionId, 'sessionId');
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw ErrorHandler.createError(
        ErrorCode.SESSION_NOT_FOUND,
        `Session not found: ${sessionId}`
      );
    }
    return session;
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.lastActivity = new Date();
      this.invalidateCache(); // Activity changes affect idleMs
    }
  }

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) this.invalidateCache();
    return deleted;
  }

  getAllSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  get size(): number {
    return this.sessions.size;
  }

  /**
   * Invalidate the session list cache.
   * Called when session state changes that would affect the list.
   */
  private invalidateCache(): void {
    this.sessionListCache = null;
  }

  // Session Reporting

  private sessionToInfo = (session: BrowserSession): SessionInfo => {
    return {
      id: session.id,
      browserType: session.metadata.browserType,
      pageCount: session.pages.size,
      lastActivity: session.metadata.lastActivity,
      idleMs: Date.now() - session.metadata.lastActivity.getTime(),
      headless: session.metadata.headless,
    };
  };

  listSessions(): SessionInfo[] {
    const now = Date.now();

    // Check cache validity (TTL-based)
    if (
      this.sessionListCache &&
      now - this.cacheTimestamp < SESSION_CACHE_TTL_MS
    ) {
      this.cacheHits++;
      return this.sessionListCache;
    }

    // Cache miss - rebuild list
    this.cacheMisses++;
    this.sessionListCache = Array.from(this.sessions.values()).map(
      this.sessionToInfo
    );
    this.cacheTimestamp = now;
    return this.sessionListCache;
  }

  getStatus(): {
    activeSessions: number;
    maxSessions: number;
    availableSlots: number;
    sessions: SessionInfo[];
  } {
    const sessions = this.listSessions(); // Use cached version

    return {
      activeSessions: this.sessions.size,
      maxSessions: this.config.maxConcurrentSessions,
      availableSlots: this.getRemainingCapacity(),
      sessions,
    };
  }

  /**
   * Get cache statistics for monitoring performance.
   * @returns Cache hit/miss counts and hit rate
   */
  getCacheStats(): {
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  // Session Cleanup

  async cleanupExpiredSessions(
    maxAge: number,
    onCleanup?: SessionCleanupCallback
  ): Promise<{ cleaned: number }> {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      const sessionAge = now - session.metadata.lastActivity.getTime();

      if (sessionAge <= maxAge) continue;

      if (this.cleanupInProgress.has(sessionId)) continue;
      this.cleanupInProgress.add(sessionId);

      try {
        if (onCleanup) {
          await onCleanup(sessionId, session);
        }

        await session.browser.close();
        this.sessions.delete(sessionId);
        cleaned++;

        this.logger.info('Expired session cleaned up', { sessionId });
      } catch (error) {
        const err = toError(error);
        this.logger.error('Failed to cleanup session', {
          sessionId,
          error: err.message,
        });
      } finally {
        this.cleanupInProgress.delete(sessionId);
      }
    }

    return { cleaned };
  }

  isCleaningUp(sessionId: string): boolean {
    return this.cleanupInProgress.has(sessionId);
  }

  // Page Management

  addPage(sessionId: string, pageId: string, page: Page): void {
    const session = this.getSession(sessionId);
    session.pages.set(pageId, page);
    session.metadata.activePageId = pageId;
  }

  getPage(sessionId: string, pageId: string): Page {
    validateUUID(sessionId, 'sessionId');
    validateUUID(pageId, 'pageId');
    const session = this.getSession(sessionId);
    const page = session.pages.get(pageId);
    if (!page) {
      throw ErrorHandler.createError(
        ErrorCode.PAGE_NOT_FOUND,
        `Page not found: ${pageId}`
      );
    }
    return page;
  }

  hasPage(sessionId: string, pageId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.pages.has(pageId) ?? false;
  }

  removePage(sessionId: string, pageId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const deleted = session.pages.delete(pageId);

    if (session.metadata.activePageId === pageId) {
      const remaining = Array.from(session.pages.keys());
      session.metadata.activePageId =
        remaining.length > 0 ? remaining[0] : undefined;
    }

    return deleted;
  }

  getPageIds(sessionId: string): string[] {
    const session = this.getSession(sessionId);
    return Array.from(session.pages.keys());
  }

  getActivePageId(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.metadata.activePageId;
  }

  setActivePageId(sessionId: string, pageId: string): void {
    const session = this.getSession(sessionId);
    if (!session.pages.has(pageId)) {
      throw ErrorHandler.createError(
        ErrorCode.PAGE_NOT_FOUND,
        `Cannot set active page, page not found: ${pageId}`
      );
    }
    session.metadata.activePageId = pageId;
  }
}
