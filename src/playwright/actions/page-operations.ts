// Page Operations - Viewport, tabs, screenshots, accessibility scans

import { v4 as uuidv4 } from 'uuid';
import AxeBuilder from '@axe-core/playwright';

import { ErrorCode, ErrorHandler } from '../../utils/error-handler.js';
import { Logger } from '../../utils/logger.js';
import { Viewport } from '../../types/index.js';
import * as pageActions from '../page-actions.js';
import * as security from '../security.js';
import { DialogManager } from '../dialog-manager.js';
import { SessionManager } from '../session-manager.js';
import { executePageOperation } from '../utils/execution-helper.js';

export class PageOperations {
  constructor(
    private sessionManager: SessionManager,
    private logger: Logger,
    private dialogManager: DialogManager
  ) {}

  async resizeViewport(
    sessionId: string,
    pageId: string,
    viewport: Viewport
  ): Promise<{ success: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Resize viewport',
      async (page) => {
        await page.setViewportSize(viewport);
        return { success: true };
      },
      { viewport }
    );
  }

  async manageTabs(
    sessionId: string,
    action: 'list' | 'create' | 'close' | 'select',
    pageId?: string,
    url?: string
  ): Promise<{
    success: boolean;
    tabs?: Array<{
      pageId: string;
      title: string;
      url: string;
      active: boolean;
    }>;
    newPageId?: string;
  }> {
    const session = this.sessionManager.getSession(sessionId);

    if (action === 'create') {
      const newPage = await session.context.newPage();
      const newPageId = uuidv4();
      this.dialogManager.setupDialogHandler(sessionId, newPageId, newPage);
      this.sessionManager.addPage(sessionId, newPageId, newPage);

      if (url) {
        await pageActions.navigateTo(newPage, url);
      }

      this.sessionManager.updateActivity(sessionId);
      return { success: true, newPageId };
    }

    if (action === 'close') {
      if (!pageId) {
        throw ErrorHandler.createError(
          ErrorCode.VALIDATION_FAILED,
          'Page ID required for close action'
        );
      }
      const page = this.sessionManager.getPage(sessionId, pageId);
      await page.close();
      this.sessionManager.removePage(sessionId, pageId);
      this.sessionManager.updateActivity(sessionId);
      return { success: true };
    }

    if (action === 'select') {
      if (!pageId) {
        throw ErrorHandler.createError(
          ErrorCode.VALIDATION_FAILED,
          'Page ID required for select action'
        );
      }
      const page = this.sessionManager.getPage(sessionId, pageId);
      await page.bringToFront();
      this.sessionManager.updateActivity(sessionId);
      return { success: true };
    }

    // List tabs
    const tabs = [];
    const pages = session.pages;

    for (const [pid, page] of pages) {
      let title = '';
      try {
        title = await page.title();
      } catch {
        title = 'Unknown';
      }
      tabs.push({
        pageId: pid,
        title,
        url: page.url(),
        active: false, // TODO: Track active tab
      });
    }

    return { success: true, tabs };
  }

  async takeScreenshot(options: {
    sessionId: string;
    pageId: string;
    fullPage?: boolean;
    path?: string;
    type?: 'png' | 'jpeg';
    quality?: number;
  }): Promise<{ base64?: string; path?: string }> {
    const { sessionId, pageId, fullPage, path, type, quality } = options;
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Take screenshot',
      async (page) => {
        return pageActions.takeScreenshot(page, {
          fullPage,
          path,
          type,
          quality,
        });
      }
    );
  }

  async getPageContent(
    sessionId: string,
    pageId: string
  ): Promise<{ html: string; text: string }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Get page content',
      async (page) => {
        return pageActions.getContent(page);
      }
    );
  }

  async waitForSelector(
    sessionId: string,
    pageId: string,
    selector: string,
    options: {
      state?: 'visible' | 'hidden' | 'attached' | 'detached';
      timeout?: number;
    } = {}
  ): Promise<{ found: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Wait for selector',
      async (page) => {
        return pageActions.waitForSelector(page, selector, options);
      },
      { selector, state: options.state }
    );
  }

  async waitForDownload(
    sessionId: string,
    pageId: string,
    options: { timeout?: number } = {}
  ): Promise<{
    success: boolean;
    suggestedFilename: string;
    path: string | null;
  }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Wait for download',
      async (page) => {
        const downloadPromise = page.waitForEvent('download', {
          timeout: options.timeout,
        });
        const download = await downloadPromise;
        const suggestedFilename = download.suggestedFilename();
        const path = await download.path().catch(() => null);
        return { success: true, suggestedFilename, path };
      }
    );
  }

  async resetSessionState(sessionId: string): Promise<{
    success: boolean;
    clearedCookies: boolean;
    clearedStorage: boolean;
  }> {
    const session = this.sessionManager.getSession(sessionId);
    await session.context.clearCookies();

    // Clear storage for all pages
    for (const page of session.pages.values()) {
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          // Ignore errors if storage is not accessible
        }
      });
    }

    this.sessionManager.updateActivity(sessionId);
    return { success: true, clearedCookies: true, clearedStorage: true };
  }

  async preparePage(
    sessionId: string,
    pageId: string,
    options: {
      viewport?: Viewport;
      extraHTTPHeaders?: Record<string, string>;
      geolocation?: { latitude: number; longitude: number; accuracy?: number };
      permissions?: string[];
      colorScheme?: 'light' | 'dark' | 'no-preference';
      reducedMotion?: 'reduce' | 'no-preference';
    }
  ): Promise<{ success: boolean; appliedSettings: string[] }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Prepare page',
      async (page) => {
        const appliedSettings: string[] = [];
        const context = page.context();

        if (options.viewport) {
          await page.setViewportSize(options.viewport);
          appliedSettings.push('viewport');
        }

        if (options.extraHTTPHeaders) {
          await page.setExtraHTTPHeaders(options.extraHTTPHeaders);
          appliedSettings.push('extraHTTPHeaders');
        }

        if (options.geolocation) {
          await context.setGeolocation(options.geolocation);
          appliedSettings.push('geolocation');
        }

        if (options.permissions) {
          // We need the origin to grant permissions
          const url = page.url();
          try {
            const origin = new URL(url).origin;
            await context.grantPermissions(options.permissions, { origin });
            appliedSettings.push('permissions');
          } catch {
            await context.grantPermissions(options.permissions);
            appliedSettings.push('permissions');
          }
        }

        if (options.colorScheme) {
          await page.emulateMedia({ colorScheme: options.colorScheme });
          appliedSettings.push('colorScheme');
        }

        if (options.reducedMotion) {
          await page.emulateMedia({ reducedMotion: options.reducedMotion });
          appliedSettings.push('reducedMotion');
        }

        return { success: true, appliedSettings };
      }
    );
  }

  async runAccessibilityScan(
    sessionId: string,
    pageId: string,
    options: {
      tags?: string[];
      includedImpacts?: string[];
      selector?: string;
    } = {}
  ): Promise<{
    success: boolean;
    violations: Array<{
      id: string;
      impact?: string | null;
      description: string;
      help: string;
      helpUrl: string;
      nodes: Array<{
        html: string;
        target: string[];
        failureSummary?: string;
      }>;
    }>;
    passes: number;
    incomplete: number;
    inapplicable: number;
  }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Run accessibility scan',
      async (page) => {
        const builder = new AxeBuilder({ page });

        if (options.tags && options.tags.length > 0) {
          builder.withTags(options.tags);
        }

        if (options.selector) {
          builder.include(options.selector);
        }

        const results = await builder.analyze();

        // Filter by impact if requested
        let violations = results.violations;
        if (options.includedImpacts && options.includedImpacts.length > 0) {
          const impacts = options.includedImpacts;
          violations = violations.filter(
            (v) => v.impact && impacts.includes(v.impact)
          );
        }

        return {
          success: true,
          violations: violations as unknown as Array<{
            id: string;
            impact?: string | null;
            description: string;
            help: string;
            helpUrl: string;
            nodes: Array<{
              html: string;
              target: string[];
              failureSummary?: string;
            }>;
          }>,
          passes: results.passes.length,
          incomplete: results.incomplete.length,
          inapplicable: results.inapplicable.length,
        };
      }
    );
  }

  async evaluateScript(
    sessionId: string,
    pageId: string,
    script: string
  ): Promise<{ result: unknown }> {
    const page = this.sessionManager.getPage(sessionId, pageId);
    return security.evaluateScript(page, script, sessionId, pageId, (sid) => {
      this.sessionManager.updateActivity(sid);
    });
  }
}
