import type { Browser, BrowserContext, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

import config from '../config/server-config.js';
import type { BrowserSession, BrowserType, Viewport } from '../types/index.js';
import { ErrorCode, ErrorHandler, toError } from '../utils/error-handler.js';
import type { Logger } from '../utils/logger.js';
import { RateLimiter } from './rate-limiter.js';

// ============================================
// Types and Interfaces
// ============================================

/** Options for creating a new browser session */
export interface SessionCreateOptions {
  browser: Browser;
  context: BrowserContext;
  browserType: BrowserType;
  headless: boolean;
  viewport?: Viewport;
}

/** Summary information about a session for external reporting */
export interface SessionInfo {
  id: string;
  browserType: string;
  pageCount: number;
  lastActivity: Date;
  idleMs?: number;
  headless?: boolean;
}

/** Configuration for SessionManager behavior */
export interface SessionManagerConfig {
  /** Maximum concurrent sessions allowed */
  maxConcurrentSessions: number;
  /** Maximum sessions that can be created per minute */
  maxSessionsPerMinute: number;
}

/** Callback signature for session cleanup operations */
export type SessionCleanupCallback = (
  sessionId: string,
  session: BrowserSession
) => Promise<void>;

// ============================================
// SessionManager Implementation
// ============================================

/**
 * Manages browser session lifecycle with composed sub-components.
 *
 * Architecture:
 * - Uses RateLimiter for session creation throttling
 * - Delegates page management to BrowserSession's internal Map
 * - Provides atomic cleanup with lock mechanism
 *
 * Thread Safety:
 * - cleanupInProgress Set prevents concurrent cleanup of same session
 * - All operations are designed to be safe for async execution
 */
export class SessionManager {
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly cleanupInProgress = new Set<string>();
  private readonly rateLimiter: RateLimiter;
  private readonly config: SessionManagerConfig;

  constructor(
    private readonly logger: Logger,
    configOverrides?: Partial<SessionManagerConfig>
  ) {
    // Merge defaults with any overrides
    this.config = {
      maxConcurrentSessions:
        configOverrides?.maxConcurrentSessions ?? config.maxConcurrentSessions,
      maxSessionsPerMinute:
        configOverrides?.maxSessionsPerMinute ??
        config.limits.maxSessionsPerMinute,
    };

    // Initialize rate limiter with config
    this.rateLimiter = new RateLimiter({
      maxRequests: this.config.maxSessionsPerMinute,
      windowMs: 60_000, // 1 minute window
      maxTracked: this.config.maxSessionsPerMinute * 2,
    });
  }

  // ============================================
  // Capacity and Rate Limiting
  // ============================================

  /**
   * Check rate limit for session creation.
   * @throws {MCPPlaywrightError} VALIDATION_FAILED if limit exceeded
   */
  checkRateLimit(): void {
    this.rateLimiter.checkLimit();
  }

  /**
   * Check if maximum concurrent sessions limit is reached.
   * @throws {MCPPlaywrightError} INTERNAL_ERROR if at capacity
   */
  checkCapacity(): void {
    if (this.sessions.size >= this.config.maxConcurrentSessions) {
      throw ErrorHandler.createError(
        ErrorCode.INTERNAL_ERROR,
        `Maximum concurrent sessions (${this.config.maxConcurrentSessions}) reached. Close existing sessions first.`
      );
    }
  }

  /**
   * Get remaining capacity for new sessions.
   */
  getRemainingCapacity(): number {
    return Math.max(0, this.config.maxConcurrentSessions - this.sessions.size);
  }

  // ============================================
  // Session Lifecycle
  // ============================================

  /**
   * Create a new session from browser and context.
   * @returns The generated session ID
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
   * @throws {MCPPlaywrightError} SESSION_NOT_FOUND if session doesn't exist
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
   * Check if session exists without throwing.
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
   * @returns true if session was deleted, false if it didn't exist
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
   * Get current session count.
   */
  get size(): number {
    return this.sessions.size;
  }

  // ============================================
  // Session Reporting
  // ============================================

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
      maxSessions: this.config.maxConcurrentSessions,
      availableSlots: this.getRemainingCapacity(),
      sessions,
    };
  }

  // ============================================
  // Session Cleanup
  // ============================================

  /**
   * Cleanup expired sessions based on max age.
   *
   * Uses atomic locking to prevent concurrent cleanup of same session.
   * Cleanup is best-effort - failures are logged but don't stop other cleanups.
   *
   * @param maxAge Maximum age in milliseconds before session is considered expired
   * @param onCleanup Optional callback invoked before closing each session
   * @returns Number of sessions cleaned up
   */
  async cleanupExpiredSessions(
    maxAge: number,
    onCleanup?: SessionCleanupCallback
  ): Promise<{ cleaned: number }> {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      const sessionAge = now - session.metadata.lastActivity.getTime();

      if (sessionAge <= maxAge) continue;

      // Atomic lock acquisition - skip if already being cleaned
      if (this.cleanupInProgress.has(sessionId)) continue;
      this.cleanupInProgress.add(sessionId);

      try {
        // Execute cleanup callback if provided (e.g., clear dialog timeouts)
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
        // Always release lock
        this.cleanupInProgress.delete(sessionId);
      }
    }

    return { cleaned };
  }

  /**
   * Check if a session is currently being cleaned up.
   * Useful for avoiding operations on sessions being destroyed.
   */
  isCleaningUp(sessionId: string): boolean {
    return this.cleanupInProgress.has(sessionId);
  }

  // ============================================
  // Page Management (Delegates to Session)
  // ============================================

  /**
   * Add page to session.
   * @param pageId Unique identifier for the page
   * @param page Playwright page instance
   */
  addPage(sessionId: string, pageId: string, page: Page): void {
    const session = this.getSession(sessionId);
    session.pages.set(pageId, page);
    session.metadata.activePageId = pageId;
  }

  /**
   * Get page from session.
   * @throws {MCPPlaywrightError} PAGE_NOT_FOUND if page doesn't exist
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
   * Check if a page exists in a session.
   */
  hasPage(sessionId: string, pageId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.pages.has(pageId) ?? false;
  }

  /**
   * Remove page from session.
   * @returns true if page was removed, false if it didn't exist
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
   * @throws {MCPPlaywrightError} SESSION_NOT_FOUND if session doesn't exist
   */
  getPageIds(sessionId: string): string[] {
    const session = this.getSession(sessionId);
    return Array.from(session.pages.keys());
  }

  /**
   * Get the active page ID for a session.
   */
  getActivePageId(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.metadata.activePageId;
  }

  /**
   * Set the active page for a session.
   * @throws {MCPPlaywrightError} PAGE_NOT_FOUND if page doesn't exist
   */
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

export default SessionManager;
