import { v4 as uuidv4 } from 'uuid';

import { ErrorHandler, toError } from '../../utils/error-handler.js';
import { Logger } from '../../utils/logger.js';
import { NavigationOptions } from '../../types/index.js';
import * as pageActions from '../page-actions.js';
import * as security from '../security.js';
import { DialogManager } from '../dialog-manager.js';
import { SessionManager } from '../session-manager.js';
import { executePageOperation } from '../utils/execution-helper.js';

export class NavigationActions {
  constructor(
    private sessionManager: SessionManager,
    private logger: Logger,
    private dialogManager: DialogManager
  ) {}

  async navigateToPage(
    options: NavigationOptions
  ): Promise<{ pageId: string; title: string; url: string }> {
    const { sessionId, url, waitUntil, timeout } = options;

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
      this.sessionManager.updateActivity(sessionId);

      this.logger.info('Page navigation completed', {
        sessionId,
        pageId,
        url: result.url,
        title: result.title,
      });

      return { pageId, title: result.title, url: result.url };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Page navigation failed', {
        sessionId,
        url,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async navigateBack(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; url?: string }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Navigate back',
      async (page) => {
        const result = await pageActions.navigateBack(page);
        return { success: true, url: result.url };
      }
    );
  }
}
