// Navigation Actions - Page navigation with URL validation
// @see https://playwright.dev/docs/navigations

import { v4 as uuidv4 } from 'uuid';

import config from '../../config/server-config.js';
import type { NavigationOptions, WaitUntilState } from '../../config/types.js';
import { ErrorHandler, toError } from '../../utils/error-handler.js';
import type { Logger } from '../../utils/logger.js';
import * as security from '../security.js';
import type { DialogManager } from '../dialog-manager.js';
import type { SessionManager } from '../session-manager.js';
import { BaseAction } from './base-action.js';

/**
 * Action module for page navigation with URL validation.
 *
 * Provides methods for navigating pages, managing history, and reloading.
 * All navigation URLs are validated against allowed protocols.
 *
 * @see https://playwright.dev/docs/navigations for navigation documentation
 */
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
    const {
      sessionId,
      url,
      waitUntil = 'load',
      timeout = config.timeouts.navigation,
    } = options;
    const startTime = Date.now();

    // Validate URL protocol before navigation
    security.validateUrlProtocol(url);

    const session = this.sessionManager.getSession(sessionId);
    const page = await session.context.newPage();
    const pageId = uuidv4();

    // Set up dialog handling for the new page
    this.dialogManager.setupDialogHandler(sessionId, pageId, page);
    this.sessionManager.addPage(sessionId, pageId, page);

    try {
      // Direct Playwright API call
      await page.goto(url, { waitUntil, timeout });

      const title = await page.title();
      const finalUrl = page.url();
      const duration = Date.now() - startTime;

      this.sessionManager.updateActivity(sessionId);
      this.logger.info('Navigate to page completed', {
        sessionId,
        pageId,
        duration,
        url: finalUrl,
        title,
      });

      return { pageId, title, url: finalUrl };
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
    pageId: string,
    options: { timeout?: number; waitUntil?: WaitUntilState } = {}
  ): Promise<{ success: boolean; url: string }> {
    const { timeout = config.timeouts.navigation, waitUntil } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Navigate back',
      async (page) => {
        await page.goBack({ timeout, waitUntil });
        return { success: true, url: page.url() };
      }
    );
  }

  async navigateForward(
    sessionId: string,
    pageId: string,
    options: { timeout?: number; waitUntil?: WaitUntilState } = {}
  ): Promise<{ success: boolean; url: string }> {
    const { timeout = config.timeouts.navigation, waitUntil } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Navigate forward',
      async (page) => {
        await page.goForward({ timeout, waitUntil });
        return { success: true, url: page.url() };
      }
    );
  }

  async reloadPage(
    sessionId: string,
    pageId: string,
    options: { timeout?: number; waitUntil?: WaitUntilState } = {}
  ): Promise<{ success: boolean; url: string; title: string }> {
    const { timeout = config.timeouts.navigation, waitUntil = 'load' } =
      options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Reload page',
      async (page) => {
        await page.reload({ waitUntil, timeout });
        return {
          success: true,
          url: page.url(),
          title: await page.title(),
        };
      }
    );
  }
}
