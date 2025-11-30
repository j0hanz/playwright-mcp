import { Page } from 'playwright';
import { ErrorHandler, toError } from '../../utils/error-handler.js';
import { Logger } from '../../utils/logger.js';
import { SessionManager } from '../session-manager.js';

/**
 * Helper to execute a page operation with standardized logging, error handling, and session activity tracking.
 */
export async function executePageOperation<T>(
  sessionManager: SessionManager,
  logger: Logger,
  sessionId: string,
  pageId: string,
  operation: string,
  action: (page: Page) => Promise<T>,
  meta?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();
  const page = sessionManager.getPage(sessionId, pageId);

  try {
    const result = await action(page);
    const duration = Date.now() - startTime;
    sessionManager.updateActivity(sessionId);

    logger.info(`${operation} completed`, {
      sessionId,
      pageId,
      duration,
      ...meta,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = toError(error);

    logger.error(`${operation} failed`, {
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
