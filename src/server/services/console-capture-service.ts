/**
 * Console Capture Service - Manages browser console message capture
 *
 * Extracted from advanced-tools.ts to eliminate global state and improve testability.
 */

import type { ConsoleMessage, Page } from 'playwright';

export interface CapturedMessage {
  type: string;
  text: string;
  timestamp: string;
  location?: string;
}

export interface CaptureState {
  messages: CapturedMessage[];
  maxMessages: number;
  types: Set<string>;
  listener?: (msg: ConsoleMessage) => void;
}

export interface CaptureOptions {
  types?: string[];
  maxMessages?: number;
}

export interface CaptureResult {
  success: boolean;
  messages?: CapturedMessage[];
  count?: number;
}

const DEFAULT_TYPES = ['log', 'info', 'warn', 'error', 'debug', 'trace'];
const DEFAULT_MAX_MESSAGES = 100;

/**
 * Service for capturing browser console messages.
 * Manages capture state per page and handles cleanup on page close.
 *
 * This service uses the singleton pattern to ensure consistent state
 * across all handler registrations.
 */
export class ConsoleCaptureService {
  private static instance: ConsoleCaptureService | null = null;
  private readonly captures = new Map<string, CaptureState>();

  /**
   * Private constructor to enforce singleton pattern.
   * Use ConsoleCaptureService.getInstance() to get the service instance.
   */
  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of ConsoleCaptureService.
   * Creates the instance if it doesn't exist.
   *
   * @returns The singleton ConsoleCaptureService instance
   */
  static getInstance(): ConsoleCaptureService {
    if (!ConsoleCaptureService.instance) {
      ConsoleCaptureService.instance = new ConsoleCaptureService();
    }
    return ConsoleCaptureService.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing).
   * @internal
   */
  static resetInstance(): void {
    ConsoleCaptureService.instance = null;
  }

  /**
   * Create a unique key for a page within a session.
   */
  private createKey(sessionId: string, pageId: string): string {
    return `${sessionId}:${pageId}`;
  }

  /**
   * Start capturing console messages for a page.
   *
   * @param page - Playwright page instance
   * @param sessionId - Session identifier
   * @param pageId - Page identifier
   * @param options - Capture configuration
   * @returns Capture result with success status
   */
  start(
    page: Page,
    sessionId: string,
    pageId: string,
    options: CaptureOptions = {}
  ): CaptureResult {
    const key = this.createKey(sessionId, pageId);

    // Remove existing capture if any
    this.stopInternal(page, key);

    const capture: CaptureState = {
      messages: [],
      maxMessages: options.maxMessages ?? DEFAULT_MAX_MESSAGES,
      types: new Set(options.types ?? DEFAULT_TYPES),
    };

    capture.listener = (msg: ConsoleMessage) => {
      const msgType = msg.type();
      if (!capture.types.has(msgType)) return;

      const loc = msg.location();
      capture.messages.push({
        type: msgType,
        text: msg.text(),
        timestamp: new Date().toISOString(),
        location: loc.url ? `${loc.url}:${loc.lineNumber}` : undefined,
      });

      // Enforce max messages limit (FIFO)
      if (capture.messages.length > capture.maxMessages) {
        capture.messages.shift();
      }
    };

    page.on('console', capture.listener);
    this.captures.set(key, capture);

    // Auto-cleanup on page close to prevent memory leaks
    page.once('close', () => {
      this.captures.delete(key);
    });

    return {
      success: true,
      count: 0,
    };
  }

  /**
   * Stop capturing console messages for a page.
   *
   * @param page - Playwright page instance
   * @param sessionId - Session identifier
   * @param pageId - Page identifier
   * @returns Capture result with final message count
   */
  stop(page: Page, sessionId: string, pageId: string): CaptureResult {
    const key = this.createKey(sessionId, pageId);
    const capture = this.captures.get(key);
    const count = capture?.messages.length ?? 0;

    this.stopInternal(page, key);

    return {
      success: true,
      count,
    };
  }

  /**
   * Internal stop implementation.
   */
  private stopInternal(page: Page, key: string): void {
    const capture = this.captures.get(key);
    if (capture?.listener) {
      page.off('console', capture.listener);
    }
    this.captures.delete(key);
  }

  /**
   * Get captured console messages for a page.
   *
   * @param sessionId - Session identifier
   * @param pageId - Page identifier
   * @returns Captured messages array
   */
  get(sessionId: string, pageId: string): CaptureResult {
    const key = this.createKey(sessionId, pageId);
    const capture = this.captures.get(key);
    const messages = capture?.messages ?? [];

    return {
      success: true,
      messages,
      count: messages.length,
    };
  }

  /**
   * Check if capture is active for a page.
   *
   * @param sessionId - Session identifier
   * @param pageId - Page identifier
   * @returns True if capture is active
   */
  isCapturing(sessionId: string, pageId: string): boolean {
    return this.captures.has(this.createKey(sessionId, pageId));
  }

  /**
   * Clean up all captures for a session.
   * Call this when a session is closed.
   *
   * @param sessionId - Session identifier
   * @param pageIds - Array of page IDs in the session
   */
  cleanupSession(sessionId: string, pageIds: string[]): void {
    for (const pageId of pageIds) {
      const key = this.createKey(sessionId, pageId);
      this.captures.delete(key);
    }
  }

  /**
   * Get the number of active captures (for monitoring).
   */
  get activeCaptureCount(): number {
    return this.captures.size;
  }

  /**
   * Format captured messages for display.
   *
   * @param messages - Array of captured messages
   * @param limit - Maximum messages to include (default: 20)
   * @returns Formatted string for display
   */
  static formatMessages(messages: CapturedMessage[], limit = 20): string {
    if (messages.length === 0) {
      return 'No console messages captured';
    }

    return messages
      .slice(-limit)
      .map((m) => `[${m.type.toUpperCase()}] ${m.text}`)
      .join('\n');
  }
}
