// Navigation Actions - Page navigation with URL validation

import { v4 as uuidv4 } from 'uuid';

import type { NavigationOptions } from '../../config/types.js';
import { ErrorHandler, toError } from '../../utils/error-handler.js';
import type { Logger } from '../../utils/logger.js';
import * as pageActions from '../page-actions.js';
import * as security from '../security.js';
import type { DialogManager } from '../dialog-manager.js';
import type { SessionManager } from '../session-manager.js';
import { BaseAction } from './base-action.js';

export class NavigationActions extends BaseAction {
  constructor(
    sessionManager: SessionManager,
    logger: Logger,
    private readonly dialogManager: DialogManager
  ) {
    super(sessionManager, logger);
  }

  async navigateToPage(
    options: NavigationOptions
  ): Promise<{ pageId: string; title: string; url: string }> {
    const { sessionId, url, waitUntil, timeout } = options;
    const startTime = Date.now();

    security.validateUrlProtocol(url);

    const session = this.sessionManager.getSession(sessionId);
    const page = await session.context.newPage();
    const pageId = uuidv4();

    this.dialogManager.setupDialogHandler(sessionId, pageId, page);
    this.sessionManager.addPage(sessionId, pageId, page);

    try {
      const result = await pageActions.navigateTo(page, url, {
        waitUntil,
        timeout,
      });
      const duration = Date.now() - startTime;
      this.sessionManager.updateActivity(sessionId);

      this.logger.info('Navigate to page completed', {
        sessionId,
        pageId,
        duration,
        url: result.url,
        title: result.title,
      });

      return { pageId, title: result.title, url: result.url };
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = toError(error);
      this.logger.error('Navigate to page failed', {
        sessionId,
        pageId,
        duration,
        url,
        error: err.message,
        stack: err.stack,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async navigateBack(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; url?: string }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Navigate back',
      async (page) => {
        const result = await pageActions.navigateBack(page);
        return { success: true, url: result.url };
      }
    );
  }

  async navigateForward(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; url?: string }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Navigate forward',
      async (page) => {
        const result = await pageActions.navigateForward(page);
        return { success: true, url: result.url };
      }
    );
  }

  async reloadPage(
    sessionId: string,
    pageId: string,
    options?: {
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    }
  ): Promise<{ success: boolean; url?: string }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Reload page',
      async (page) => {
        await pageActions.reload(page, options);
        return { success: true, url: page.url() };
      }
    );
  }
}
