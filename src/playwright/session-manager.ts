/**
 * Session Manager - Manages browser session lifecycle
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
import type { Logger } from '../utils/logger.js';
import { MS_PER_MINUTE } from '../utils/constants.js';
import { RateLimiter } from './rate-limiter.js';

export class SessionManager {
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly cleanupInProgress = new Set<string>();
  private readonly rateLimiter: RateLimiter;
  private readonly config: SessionManagerConfig;

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
    this.rateLimiter.checkLimit();
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
    }
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  getAllSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  get size(): number {
    return this.sessions.size;
  }

  // Session Reporting

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((session) => ({
      id: session.id,
      browserType: session.metadata.browserType,
      pageCount: session.pages.size,
      lastActivity: session.metadata.lastActivity,
    }));
  }

  getStatus(): {
    activeSessions: number;
    maxSessions: number;
    availableSlots: number;
    sessions: SessionInfo[];
  } {
    const sessions = Array.from(this.sessions.values()).map((session) => ({
      id: session.id,
      browserType: session.metadata.browserType,
      pageCount: session.pages.size,
      lastActivity: session.metadata.lastActivity,
      idleMs: Date.now() - session.metadata.lastActivity.getTime(),
      headless: session.metadata.headless,
    }));

    return {
      activeSessions: this.sessions.size,
      maxSessions: this.config.maxConcurrentSessions,
      availableSlots: this.getRemainingCapacity(),
      sessions,
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
