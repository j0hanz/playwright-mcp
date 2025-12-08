/**
 * Base Action Class - Common foundation for all action modules
 *
 * Provides shared infrastructure for Playwright action classes including:
 * - Session and page management via SessionManager
 * - Structured logging via Logger
 * - Standardized page operation execution with error handling
 *
 * @see https://playwright.dev/docs/api/class-page for Page API
 */

import type { Page } from 'playwright';

import { ErrorHandler, toError } from '../../utils/error-handler.js';
import type { Logger } from '../../utils/logger.js';
import type { SessionManager } from '../session-manager.js';

/**
 * Abstract base class for all Playwright action modules.
 *
 * Extend this class to create new action categories with consistent
 * constructor injection and execution patterns.
 *
 * @example
 * ```typescript
 * export class MyActions extends BaseAction {
 *   async myOperation(sessionId: string, pageId: string) {
 *     return this.executePageOperation(sessionId, pageId, 'My operation', async (page) => {
 *       // Perform actions on the page
 *       return { success: true };
 *     });
 *   }
 * }
 * ```
 */
export abstract class BaseAction {
  /**
   * Creates a new action module instance.
   *
   * @param sessionManager - Manages browser sessions and pages
   * @param logger - Logger instance for structured logging
   */
  constructor(
    protected readonly sessionManager: SessionManager,
    protected readonly logger: Logger
  ) {}

  /**
   * Executes an operation on a page with standardized error handling and logging.
   *
   * This method:
   * - Retrieves the page from the session manager
   * - Executes the provided action
   * - Updates session activity on success
   * - Logs operation timing and results
   * - Wraps errors in MCPPlaywrightError for consistent error handling
   *
   * @param sessionId - The session ID containing the page
   * @param pageId - The page ID to operate on
   * @param operation - Human-readable operation name for logging
   * @param action - Async function that performs the actual page operation
   * @param meta - Optional metadata to include in log entries
   * @returns The result of the action function
   * @throws MCPPlaywrightError on failure
   */
  protected async executePageOperation<T>(
    sessionId: string,
    pageId: string,
    operation: string,
    action: (page: Page) => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now();
    const page = this.sessionManager.getPage(sessionId, pageId);

    try {
      const result = await action(page);
      const duration = Date.now() - startTime;
      this.sessionManager.updateActivity(sessionId);

      this.logger.info(`${operation} completed`, {
        sessionId,
        pageId,
        duration,
        ...meta,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = toError(error);

      this.logger.error(`${operation} failed`, {
        sessionId,
        pageId,
        duration,
        error: err.message,
        stack: err.stack,
        ...meta,
      });

      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  /**
   * Executes an operation on a browser context with standardized error handling and logging.
   *
   * Similar to executePageOperation but operates at the context level.
   *
   * @param sessionId - The session ID to operate on
   * @param operation - Human-readable operation name for logging
   * @param action - Async function that performs the context operation
   * @param meta - Optional metadata to include in log entries
   * @returns The result of the action function
   * @throws MCPPlaywrightError on failure
   */
  protected async executeContextOperation<T>(
    sessionId: string,
    operation: string,
    action: (
      context: import('playwright').BrowserContext,
      session: import('../../config/types.js').BrowserSession
    ) => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now();
    const session = this.sessionManager.getSession(sessionId);

    try {
      const result = await action(session.context, session);
      const duration = Date.now() - startTime;
      this.sessionManager.updateActivity(sessionId);

      this.logger.info(`${operation} completed`, {
        sessionId,
        duration,
        ...meta,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = toError(error);

      this.logger.error(`${operation} failed`, {
        sessionId,
        duration,
        error: err.message,
        stack: err.stack,
        ...meta,
      });

      throw ErrorHandler.handlePlaywrightError(err);
    }
  }
}
