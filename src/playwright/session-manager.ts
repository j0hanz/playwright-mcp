/**
 * Session Manager - Manages browser session lifecycle
 *
 * Extracted from BrowserManager to follow Single Responsibility Principle.
 * Handles session creation, lookup, cleanup, and rate limiting.
 */
import type { Browser, BrowserContext, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

import config from '../config/server-config.js';
import type { BrowserSession, BrowserType, Viewport } from '../types/index.js';
import { ErrorCode, ErrorHandler, toError } from '../utils/error-handler.js';
import type { Logger } from '../utils/logger.js';

export interface SessionCreateOptions {
  browser: Browser;
  context: BrowserContext;
  browserType: BrowserType;
  headless: boolean;
  viewport?: Viewport;
}

export interface SessionInfo {
  id: string;
  browserType: string;
  pageCount: number;
  lastActivity: Date;
  idleMs?: number;
  headless?: boolean;
}

/**
 * Manages browser session lifecycle independently of browser operations.
 * Enables cleaner composition and testing of session-related functionality.
 */
export class SessionManager {
  private sessions = new Map<string, BrowserSession>();
  private sessionCreationTimestamps: number[] = [];
  private cleanupInProgress = new Set<string>();
  private static readonly MAX_TRACKED_SESSIONS = 100;

  constructor(private readonly logger: Logger) {}

  /**
   * Rate limiting check for session creation.
   * Uses efficient filtering with memory bounds to prevent unbounded growth.
   */
  checkRateLimit(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    // Remove expired timestamps (keep only last minute)
    this.sessionCreationTimestamps = this.sessionCreationTimestamps.filter(
      (ts) => ts > oneMinuteAgo
    );

    // Limit array size to prevent unbounded growth
    if (
      this.sessionCreationTimestamps.length >
      SessionManager.MAX_TRACKED_SESSIONS
    ) {
      this.sessionCreationTimestamps = this.sessionCreationTimestamps.slice(
        -SessionManager.MAX_TRACKED_SESSIONS
      );
    }

    if (
      this.sessionCreationTimestamps.length >=
      config.limits.maxSessionsPerMinute
    ) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `Rate limit exceeded: Maximum ${config.limits.maxSessionsPerMinute} sessions per minute`
      );
    }

    this.sessionCreationTimestamps.push(now);
  }

  /**
   * Check if maximum concurrent sessions limit is reached.
   */
  checkCapacity(): void {
    if (this.sessions.size >= config.maxConcurrentSessions) {
      throw ErrorHandler.createError(
        ErrorCode.INTERNAL_ERROR,
        `Maximum concurrent sessions (${config.maxConcurrentSessions}) reached. Close existing sessions first.`
      );
    }
  }

  /**
   * Create a new session from browser and context.
   */
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

  /**
   * Get session by ID with validation.
   */
  getSession(sessionId: string): BrowserSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw ErrorHandler.createError(
        ErrorCode.SESSION_NOT_FOUND,
        `Session not found: ${sessionId}`
      );
    }
    return session;
  }

  /**
   * Check if session exists.
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Update session last activity timestamp.
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.lastActivity = new Date();
    }
  }

  /**
   * Delete session from registry.
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all sessions as array for iteration.
   */
  getAllSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count.
   */
  get size(): number {
    return this.sessions.size;
  }

  /**
   * List all sessions with summary info.
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((session) => ({
      id: session.id,
      browserType: session.metadata.browserType,
      pageCount: session.pages.size,
      lastActivity: session.metadata.lastActivity,
    }));
  }

  /**
   * Get server status with capacity info.
   */
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
      maxSessions: config.maxConcurrentSessions,
      availableSlots: config.maxConcurrentSessions - this.sessions.size,
      sessions,
    };
  }

  /**
   * Cleanup expired sessions based on max age.
   */
  async cleanupExpiredSessions(
    maxAge: number,
    onCleanup?: (sessionId: string, session: BrowserSession) => Promise<void>
  ): Promise<{ cleaned: number }> {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.metadata.lastActivity.getTime() > maxAge) {
        // Attempt to claim cleanup slot atomically
        if (this.cleanupInProgress.has(sessionId)) {
          continue;
        }

        // Claim immediately to prevent race condition
        this.cleanupInProgress.add(sessionId);

        try {
          // Execute cleanup callback if provided
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
          // Always release cleanup lock
          this.cleanupInProgress.delete(sessionId);
        }
      }
    }

    return { cleaned };
  }

  /**
   * Add page to session.
   */
  addPage(sessionId: string, pageId: string, page: Page): void {
    const session = this.getSession(sessionId);
    session.pages.set(pageId, page);
    session.metadata.activePageId = pageId;
  }

  /**
   * Get page from session.
   */
  getPage(sessionId: string, pageId: string): Page {
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

  /**
   * Remove page from session.
   */
  removePage(sessionId: string, pageId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const deleted = session.pages.delete(pageId);

    // Update active page if needed
    if (session.metadata.activePageId === pageId) {
      const remaining = Array.from(session.pages.keys());
      session.metadata.activePageId =
        remaining.length > 0 ? remaining[0] : undefined;
    }

    return deleted;
  }

  /**
   * Get all page IDs for a session.
   */
  getPageIds(sessionId: string): string[] {
    const session = this.getSession(sessionId);
    return Array.from(session.pages.keys());
  }
}

export default SessionManager;
