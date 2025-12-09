// Page Operations - Viewport, tabs, screenshots, PDF, cookies, accessibility scans
// @see https://playwright.dev/docs/pages
// @see https://playwright.dev/docs/screenshots
// @see https://playwright.dev/docs/accessibility-testing

import { v4 as uuidv4 } from 'uuid';
import AxeBuilder from '@axe-core/playwright';

import config from '../../config/server-config.js';
import type { Viewport } from '../../config/types.js';
import { ErrorCode, ErrorHandler } from '../../utils/error-handler.js';
import type { Logger } from '../../utils/logger.js';
import * as security from '../security.js';
import type { DialogManager } from '../dialog-manager.js';
import type { SessionManager } from '../session-manager.js';
import { BaseAction } from './base-action.js';

export class PageOperations extends BaseAction {
  constructor(
    sessionManager: SessionManager,
    logger: Logger,
    private readonly dialogManager: DialogManager
  ) {
    super(sessionManager, logger);
  }

  async resizeViewport(
    sessionId: string,
    pageId: string,
    viewport: Viewport
  ): Promise<{ success: boolean }> {
    return this.executePageOperation(
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

    switch (action) {
      case 'create':
        return this.createTab(sessionId, session, url);
      case 'close':
        return this.closeTab(sessionId, pageId);
      case 'select':
        return this.selectTab(sessionId, pageId);
      case 'list':
      default:
        return this.listTabs(session);
    }
  }

  private async createTab(
    sessionId: string,
    session: { context: import('playwright').BrowserContext },
    url?: string
  ): Promise<{ success: boolean; newPageId: string }> {
    const newPage = await session.context.newPage();
    const newPageId = uuidv4();
    this.dialogManager.setupDialogHandler(sessionId, newPageId, newPage);
    this.sessionManager.addPage(sessionId, newPageId, newPage);

    if (url) {
      // Validate URL before navigation
      security.validateUrlProtocol(url);
      await newPage.goto(url, { timeout: config.timeouts.navigation });
    }

    this.sessionManager.updateActivity(sessionId);
    return { success: true, newPageId };
  }

  private async closeTab(
    sessionId: string,
    pageId?: string
  ): Promise<{ success: boolean }> {
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

  private async selectTab(
    sessionId: string,
    pageId?: string
  ): Promise<{ success: boolean }> {
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

  private async listTabs(session: {
    pages: Map<string, import('playwright').Page>;
  }): Promise<{
    success: boolean;
    tabs: Array<{
      pageId: string;
      title: string;
      url: string;
      active: boolean;
    }>;
  }> {
    const tabs: Array<{
      pageId: string;
      title: string;
      url: string;
      active: boolean;
    }> = [];

    for (const [pid, page] of session.pages) {
      let title = '';
      try {
        title = await page.title();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const errorMessage = err.message.toLowerCase();

        // Categorize errors: expected (closed/detached) vs unexpected
        const isExpectedError =
          errorMessage.includes('closed') ||
          errorMessage.includes('detached') ||
          errorMessage.includes('target') ||
          errorMessage.includes('context destroyed');

        if (isExpectedError) {
          // Expected: page was closed or context destroyed
          this.logger.info('Page unavailable during title retrieval', {
            pageId: pid,
            reason: err.message,
          });
          title = '<closed>';
        } else {
          // Unexpected error: log with stack trace for debugging
          this.logger.warn('Unexpected error getting page title', {
            pageId: pid,
            error: err.message,
            stack: err.stack,
          });
          title = '<error>';
        }
      }
      tabs.push({
        pageId: pid,
        title,
        url: page.url(),
        active: false,
      });
    }

    return { success: true, tabs };
  }

  async takeScreenshot(options: {
    sessionId: string;
    pageId: string;
    fullPage?: boolean;
    selector?: string;
    clip?: { x: number; y: number; width: number; height: number };
    path?: string;
    type?: 'png' | 'jpeg';
    quality?: number;
    omitBackground?: boolean;
  }): Promise<{ base64?: string; path?: string }> {
    const {
      sessionId,
      pageId,
      fullPage,
      selector,
      clip,
      path,
      type,
      quality,
      omitBackground,
    } = options;
    return this.executePageOperation(
      sessionId,
      pageId,
      'Take screenshot',
      async (page) => {
        // Element screenshot takes priority
        if (selector) {
          const buffer = await page.locator(selector).screenshot({
            path,
            type,
            quality,
            omitBackground,
          });
          return {
            base64: buffer.toString('base64'),
            path,
          };
        }

        // Direct Playwright screenshot with all options
        const buffer = await page.screenshot({
          fullPage,
          path,
          type,
          quality,
          omitBackground,
          clip,
        });
        return {
          base64: buffer.toString('base64'),
          path,
        };
      }
    );
  }

  async getPageContent(
    sessionId: string,
    pageId: string
  ): Promise<{ html: string; text: string }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Get page content',
      async (page) => {
        const [html, text] = await Promise.all([
          page.content(),
          page.innerText('body').catch(() => ''),
        ]);
        return { html, text };
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
    const { state = 'visible', timeout = config.timeouts.action } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Wait for selector',
      async (page) => {
        await page.locator(selector).waitFor({ state, timeout });
        return { found: true };
      },
      { selector, state }
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
    return this.executePageOperation(
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
    storageResults: {
      cleared: number;
      restricted: number;
      failed: number;
    };
  }> {
    const session = this.sessionManager.getSession(sessionId);
    await session.context.clearCookies();

    const storageResults = { cleared: 0, restricted: 0, failed: 0 };

    // Clear storage for all pages with detailed error categorization
    for (const page of session.pages.values()) {
      try {
        const result = await page.evaluate(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
            return { success: true, restricted: false };
          } catch (err) {
            const error = err as Error;
            // SecurityError is expected for file:// URLs, sandboxed iframes, etc.
            const isSecurityError =
              error.name === 'SecurityError' ||
              error.message.includes('security') ||
              error.message.includes('sandbox');
            return { success: false, restricted: isSecurityError };
          }
        });

        if (result.success) {
          storageResults.cleared++;
        } else if (result.restricted) {
          storageResults.restricted++;
        } else {
          storageResults.failed++;
        }
      } catch (error) {
        // Unexpected error during page.evaluate itself
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.warn('Unexpected error clearing storage', {
          url: page.url(),
          error: err.message,
          stack: err.stack,
        });
        storageResults.failed++;
      }
    }

    // Log summary if there were any issues
    if (storageResults.restricted > 0 || storageResults.failed > 0) {
      this.logger.info('Storage clearing completed with restrictions', {
        cleared: storageResults.cleared,
        restricted: storageResults.restricted,
        failed: storageResults.failed,
      });
    }

    this.sessionManager.updateActivity(sessionId);
    return {
      success: true,
      clearedCookies: true,
      clearedStorage: storageResults.cleared > 0,
      storageResults,
    };
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
    return this.executePageOperation(
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
    return this.executePageOperation(
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
          violations: violations.map((v) => ({
            id: v.id,
            impact: v.impact as
              | 'minor'
              | 'moderate'
              | 'serious'
              | 'critical'
              | undefined,
            description: v.description,
            help: v.help,
            helpUrl: v.helpUrl,
            nodes: v.nodes.map((n) => ({
              html: n.html,
              target: n.target as string[],
              failureSummary: n.failureSummary,
            })),
          })),
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
    return this.executePageOperation(
      sessionId,
      pageId,
      'Evaluate script',
      async (page) => {
        return security.evaluateScript(page, script);
      },
      { scriptLength: script.length }
    );
  }

  /**
   * Get an accessibility snapshot of the page - returns a structured tree
   * of accessible elements similar to Microsoft's Playwright MCP implementation.
   * This is optimized for LLM consumption as it provides semantic structure.
   */
  async getAccessibilitySnapshot(
    sessionId: string,
    pageId: string,
    options: {
      interestingOnly?: boolean;
      root?: string;
    } = {}
  ): Promise<{
    success: boolean;
    snapshot: string;
    elementCount: number;
  }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Get accessibility snapshot',
      async (page) => {
        // Use ariaSnapshot which returns a YAML-like string representation
        // of the accessibility tree - this is the modern Playwright approach
        const rootLocator = options.root
          ? page.locator(options.root)
          : page.locator(':root');

        const snapshot = await rootLocator.ariaSnapshot();

        // Count elements by counting lines with roles (lines starting with '- ')
        const elementCount = (snapshot.match(/^\s*- /gm) || []).length;

        return {
          success: true,
          snapshot,
          elementCount,
        };
      },
      { interestingOnly: options.interestingOnly, root: options.root }
    );
  }

  /**
   * Generate a PDF from the current page (Chromium only)
   */
  async generatePdf(
    sessionId: string,
    pageId: string,
    options: {
      path?: string;
      format?:
        | 'Letter'
        | 'Legal'
        | 'Tabloid'
        | 'Ledger'
        | 'A0'
        | 'A1'
        | 'A2'
        | 'A3'
        | 'A4'
        | 'A5'
        | 'A6';
      landscape?: boolean;
      printBackground?: boolean;
      scale?: number;
      margin?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
      };
      headerTemplate?: string;
      footerTemplate?: string;
      displayHeaderFooter?: boolean;
      pageRanges?: string;
    } = {}
  ): Promise<{
    success: boolean;
    base64?: string;
    path?: string;
    pageCount?: number;
  }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Generate PDF',
      async (page) => {
        const pdfBuffer = await page.pdf({
          path: options.path,
          format: options.format || 'A4',
          landscape: options.landscape || false,
          printBackground: options.printBackground ?? true,
          scale: options.scale || 1,
          margin: options.margin,
          headerTemplate: options.headerTemplate,
          footerTemplate: options.footerTemplate,
          displayHeaderFooter: options.displayHeaderFooter || false,
          pageRanges: options.pageRanges,
        });

        return {
          success: true,
          base64: pdfBuffer.toString('base64'),
          path: options.path,
        };
      },
      { format: options.format, landscape: options.landscape }
    );
  }

  /**
   * Get all cookies from the browser context
   */
  async getCookies(
    sessionId: string,
    urls?: string[]
  ): Promise<{
    success: boolean;
    cookies: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires: number;
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'Strict' | 'Lax' | 'None';
    }>;
  }> {
    const session = this.sessionManager.getSession(sessionId);
    const cookies = await session.context.cookies(urls);
    this.sessionManager.updateActivity(sessionId);

    return {
      success: true,
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
      })),
    };
  }

  /**
   * Set cookies in the browser context
   */
  async setCookies(
    sessionId: string,
    cookies: Array<{
      name: string;
      value: string;
      url?: string;
      domain?: string;
      path?: string;
      expires?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'Strict' | 'Lax' | 'None';
    }>
  ): Promise<{ success: boolean; count: number }> {
    const session = this.sessionManager.getSession(sessionId);
    await session.context.addCookies(cookies);
    this.sessionManager.updateActivity(sessionId);

    return {
      success: true,
      count: cookies.length,
    };
  }

  /**
   * Clear all cookies from the browser context
   */
  async clearCookies(
    sessionId: string,
    options?: {
      name?: string;
      domain?: string;
      path?: string;
    }
  ): Promise<{ success: boolean }> {
    const session = this.sessionManager.getSession(sessionId);

    if (options?.name || options?.domain || options?.path) {
      // Clear specific cookies by filtering
      await session.context.clearCookies(options);
    } else {
      // Clear all cookies
      await session.context.clearCookies();
    }

    this.sessionManager.updateActivity(sessionId);
    return { success: true };
  }

  /**
   * Get the video path for a page if video recording is enabled
   */
  async getVideoPath(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; path: string | null }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Get video path',
      async (page) => {
        const video = page.video();
        if (!video) {
          return { success: true, path: null };
        }
        const path = await video.path().catch(() => null);
        return { success: true, path };
      }
    );
  }
}
