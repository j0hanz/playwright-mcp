import path from 'path';
import { promises as fs, constants as fsConstants } from 'fs';
import { Browser, chromium, Dialog, firefox, Page, webkit } from 'playwright';
import { fileURLToPath } from 'url';
import { validate as isValidUUID, v4 as uuidv4 } from 'uuid';

import config from '../config/server-config.js';
import type {
  AriaRole,
  BrowserSession,
  BrowserType,
  ElementInteractionOptions,
  NavigationOptions,
  ScreenshotOptions,
  Viewport,
} from '../types/index.js';
import {
  ErrorCode,
  ErrorHandler,
  isMCPPlaywrightError,
  toError,
} from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';

// Browser launch options (local to this module)
export interface BrowserLaunchOptions {
  browserType?: BrowserType;
  headless?: boolean;
  viewport?: Viewport;
  userAgent?: string;
  timeout?: number;
  channel?: string;
  slowMo?: number;
  proxy?: {
    server: string;
    bypass?: string;
    username?: string;
    password?: string;
  };
  recordVideo?: {
    dir: string;
    size?: Viewport;
  };
}

// Browser launchers map for cleaner browser instantiation
const BROWSER_LAUNCHERS = {
  chromium: chromium.launch.bind(chromium),
  firefox: firefox.launch.bind(firefox),
  webkit: webkit.launch.bind(webkit),
} as const;

// Cached playwright expect for performance (avoids dynamic import on every assertion)
let cachedExpect: typeof import('@playwright/test').expect | null = null;

async function getPlaywrightExpect() {
  if (!cachedExpect) {
    const mod = await import('@playwright/test');
    cachedExpect = mod.expect;
  }
  return cachedExpect;
}

// Allowed directories for file operations (relative to module)
const ALLOWED_LOG_OUTPUT_DIR = fileURLToPath(
  new URL('../../logs', import.meta.url)
);
const ALLOWED_UPLOAD_DIR = fileURLToPath(new URL('../../uploads', import.meta.url));

export class BrowserManager {
  private sessions = new Map<string, BrowserSession>();
  private pendingDialogs = new Map<string, Dialog>();
  private tracingActive = new Map<string, boolean>();
  private networkRoutes = new Map<
    string,
    Map<
      string,
      { url: string; handler: (route: import('playwright').Route) => void }
    >
  >();
  private logger = new Logger('BrowserManager');
  private sessionCreationTimestamps: number[] = [];
  private cleanupInProgress = new Set<string>();

  // Dialog timeout: 2x action timeout to give user time to handle dialog
  // Prevents memory leaks if client doesn't handle dialog
  private static readonly DIALOG_AUTO_DISMISS_TIMEOUT = config.timeouts.action * 2;

  // Allowed URL protocols for navigation
  private static readonly ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

  // ============================================
  // Session and Page Helpers
  // ============================================

  private isValidUUIDFormat(id: string): boolean {
    return isValidUUID(id);
  }

  /**
   * Validates that a file path is within the allowed output directory.
   * Prevents path traversal attacks.
   */
  private validateOutputPath(filePath: string): string {
    const resolved = path.resolve(filePath);

    // Allow paths in the logs directory or current working directory logs
    const cwdLogs = path.resolve(process.cwd(), 'logs');
    if (
      !resolved.startsWith(ALLOWED_LOG_OUTPUT_DIR) &&
      !resolved.startsWith(cwdLogs) &&
      !resolved.startsWith(process.cwd())
    ) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `Output path must be within the project directory: ${filePath}`
      );
    }
    return resolved;
  }

  /**
   * Rate limiting check for session creation.
   * Throws if rate limit exceeded.
   */
  private checkSessionRateLimit(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    // Remove expired timestamps (in-place, no new array allocation)
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.sessionCreationTimestamps.length; readIndex++) {
      if (this.sessionCreationTimestamps[readIndex] > oneMinuteAgo) {
        this.sessionCreationTimestamps[writeIndex++] = this.sessionCreationTimestamps[readIndex];
      }
    }
    this.sessionCreationTimestamps.length = writeIndex;

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

  private getSession(sessionId: string): BrowserSession {
    if (!this.isValidUUIDFormat(sessionId)) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        'Invalid session ID format'
      );
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw ErrorHandler.createError(
        ErrorCode.SESSION_NOT_FOUND,
        `Session not found: ${sessionId}`
      );
    }
    return session;
  }

  private getPage(sessionId: string, pageId: string): Page {
    if (!this.isValidUUIDFormat(pageId)) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        'Invalid page ID format'
      );
    }
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

  private updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.lastActivity = new Date();
    }
  }

  /**
   * Retrieves metadata about an element. Returns null if element not found or evaluation fails.
   * This is intentional - element info is supplementary and shouldn't fail the parent operation.
   */
  private async getElementInfo(
    page: Page,
    selector: string
  ): Promise<Record<string, unknown> | null> {
    try {
      return await page.locator(selector).evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;
        const text = htmlEl.textContent;
        return {
          tagName: htmlEl.tagName.toLowerCase(),
          textContent: text ? text.trim().slice(0, 100) : '',
          className: htmlEl.className,
          id: htmlEl.id,
          isVisible: htmlEl.offsetParent !== null,
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Helper to execute page operations with standard error handling and logging
   */
  private async executePageOperation<T>(
    sessionId: string,
    pageId: string,
    operation: string,
    action: (page: Page) => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T> {
    const page = this.getPage(sessionId, pageId);

    try {
      const result = await action(page);
      this.updateSessionActivity(sessionId);
      this.logger.info(`${operation} completed`, {
        sessionId,
        pageId,
        ...meta,
      });
      return result;
    } catch (error) {
      const err = toError(error);
      this.logger.error(`${operation} failed`, {
        sessionId,
        pageId,
        ...meta,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // ============================================
  // Browser Lifecycle
  // ============================================

  async launchBrowser(options: BrowserLaunchOptions = {}): Promise<{
    sessionId: string;
    browserType: string;
    recordingVideo: boolean;
  }> {
    // Rate limiting check
    this.checkSessionRateLimit();

    if (this.sessions.size >= config.maxConcurrentSessions) {
      throw ErrorHandler.createError(
        ErrorCode.INTERNAL_ERROR,
        `Maximum concurrent sessions (${config.maxConcurrentSessions}) reached. Close existing sessions first.`
      );
    }

    const {
      browserType = config.defaultBrowser,
      headless = config.headless,
      viewport = config.defaultViewport,
      userAgent,
      recordVideo,
    } = options;

    try {
      const launcher = BROWSER_LAUNCHERS[browserType];
      const browser = await launcher({ headless });

      const contextOptions: Parameters<Browser['newContext']>[0] = {
        viewport,
        userAgent,
        ignoreHTTPSErrors: config.ignoreHTTPSErrors,
        // Locale and timezone for consistent behavior across runs
        locale: config.locale,
        timezoneId: config.timezoneId,
      };

      const context = await browser.newContext(contextOptions);
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

      return { sessionId, browserType, recordingVideo: !!recordVideo };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Failed to launch browser', {
        error: err.message,
      });
      throw ErrorHandler.createError(
        ErrorCode.BROWSER_LAUNCH_FAILED,
        `Browser launch failed: ${err.message}`
      );
    }
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

    // Validate URL protocol to prevent javascript:, file:, data: schemes
    try {
      const parsedUrl = new URL(url);
      if (!BrowserManager.ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
        throw ErrorHandler.createError(
          ErrorCode.VALIDATION_FAILED,
          `Invalid URL protocol: ${parsedUrl.protocol}. Only http: and https: are allowed.`
        );
      }
    } catch (error) {
      if (isMCPPlaywrightError(error)) throw error;
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `Invalid URL format: ${url}`
      );
    }

    const session = this.getSession(sessionId);

    try {
      const page = await session.context.newPage();
      const pageId = uuidv4();

      // Set up dialog handler for new page
      this.setupDialogHandler(sessionId, pageId, page);

      await page.goto(url, { waitUntil, timeout });

      session.pages.set(pageId, page);
      session.metadata.activePageId = pageId;
      this.updateSessionActivity(sessionId);

      const title = await page.title();
      const currentUrl = page.url();

      this.logger.info('Page navigation completed', {
        sessionId,
        pageId,
        url: currentUrl,
        title,
      });

      return { pageId, title, url: currentUrl };
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

  async clickElement(options: ElementInteractionOptions): Promise<{
    success: boolean;
    elementInfo?: Record<string, unknown> | null;
  }> {
    const {
      sessionId,
      pageId,
      selector,
      timeout = config.timeouts.action,
      force = false,
      position,
    } = options;

    const page = this.getPage(sessionId, pageId);

    try {
      const element = page.locator(selector);
      const elementInfo = await this.getElementInfo(page, selector);

      // Playwright locators auto-wait for actionable state
      await element.click({ force, position, timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Element clicked successfully', {
        sessionId,
        pageId,
        selector,
      });

      return { success: true, elementInfo };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Element click failed', {
        sessionId,
        pageId,
        selector,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async fillInput(
    options: ElementInteractionOptions & { text: string }
  ): Promise<{ success: boolean }> {
    const {
      sessionId,
      pageId,
      selector,
      text,
      timeout = config.timeouts.action,
      force = false,
    } = options;

    const page = this.getPage(sessionId, pageId);

    try {
      const element = page.locator(selector);
      // Playwright locators auto-wait for actionable state
      await element.fill(text, { force, timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Input filled successfully', {
        sessionId,
        pageId,
        selector,
      });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Fill input failed', {
        sessionId,
        pageId,
        selector,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async hoverElement(
    options: ElementInteractionOptions
  ): Promise<{ success: boolean }> {
    const {
      sessionId,
      pageId,
      selector,
      timeout = config.timeouts.action,
      force = false,
      position,
    } = options;

    const page = this.getPage(sessionId, pageId);

    try {
      const element = page.locator(selector);
      // Playwright locators auto-wait for actionable state
      await element.hover({ force, position, timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Element hovered successfully', {
        sessionId,
        pageId,
        selector,
      });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Element hover failed', {
        sessionId,
        pageId,
        selector,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async takeScreenshot(
    options: ScreenshotOptions
  ): Promise<{ path?: string; base64?: string }> {
    const {
      sessionId,
      pageId,
      fullPage = false,
      path,
      type = 'png',
      quality,
      clip,
      mask,
    } = options;

    const page = this.getPage(sessionId, pageId);

    try {
      const maskLocators = mask?.map((selector) => page.locator(selector));

      const screenshotOptions: Parameters<Page['screenshot']>[0] = {
        fullPage,
        type,
        path,
        mask: maskLocators,
      };

      if (type === 'jpeg' && quality) {
        screenshotOptions.quality = quality;
      }

      if (clip) {
        screenshotOptions.clip = clip;
      }

      const buffer = await page.screenshot(screenshotOptions);
      const base64 = buffer.toString('base64');

      this.updateSessionActivity(sessionId);
      this.logger.info('Screenshot taken successfully', {
        sessionId,
        pageId,
        path,
        fullPage,
      });

      return { path, base64 };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Screenshot failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.createError(
        ErrorCode.SCREENSHOT_FAILED,
        `Screenshot failed: ${err.message}`
      );
    }
  }

  async getPageContent(
    sessionId: string,
    pageId: string
  ): Promise<{ html: string; text: string }> {
    const page = this.getPage(sessionId, pageId);

    try {
      const html = await page.content();
      const text = await page.innerText('body');

      this.updateSessionActivity(sessionId);

      return { html, text };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Get page content failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
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
    const { state = 'visible', timeout = config.timeouts.assertion } = options;
    const page = this.getPage(sessionId, pageId);

    try {
      await page.waitForSelector(selector, { state, timeout });
      this.updateSessionActivity(sessionId);

      return { found: true };
    } catch {
      return { found: false };
    }
  }

  async evaluateScript(
    sessionId: string,
    pageId: string,
    script: string
  ): Promise<{ result: unknown }> {
    // Security: Only allow predefined safe queries or strict pattern matching
    // Scripts are sandboxed to page context but we restrict dangerous operations

    if (script.length > config.limits.maxScriptLength) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `Script exceeds maximum length of ${config.limits.maxScriptLength} characters`
      );
    }

    // Predefined safe scripts (preferred approach)
    const SAFE_SCRIPT_TEMPLATES: Record<string, string> = {
      getTitle: 'document.title',
      getURL: 'window.location.href',
      getViewport:
        'JSON.stringify({ width: window.innerWidth, height: window.innerHeight })',
      getScrollPosition:
        'JSON.stringify({ x: window.scrollX, y: window.scrollY })',
      getBodyText: 'document.body?.innerText || ""',
      getDocumentReadyState: 'document.readyState',
    };

    // Check if script is a predefined safe template
    const templateScript = SAFE_SCRIPT_TEMPLATES[script.trim()];
    if (templateScript) {
      const page = this.getPage(sessionId, pageId);
      try {
        const result = await page.evaluate(templateScript);
        this.updateSessionActivity(sessionId);
        return { result };
      } catch (error) {
        const err = toError(error);
        this.logger.error('Script evaluation failed', {
          sessionId,
          pageId,
          error: err.message,
        });
        throw ErrorHandler.handlePlaywrightError(err);
      }
    }

    // For custom scripts, apply strict validation
    // Allowlist of safe operations - only permit these patterns at start of script
    const safePatterns = [
      /^\s*document\.querySelector\s*\(/,
      /^\s*document\.querySelectorAll\s*\(/,
      /^\s*document\.getElementById\s*\(/,
      /^\s*document\.getElementsByClassName\s*\(/,
      /^\s*document\.getElementsByTagName\s*\(/,
      /^\s*document\.title\s*$/,
      /^\s*window\.innerWidth\s*$/,
      /^\s*window\.innerHeight\s*$/,
      /^\s*window\.scrollY\s*$/,
      /^\s*window\.scrollX\s*$/,
    ];

    const isSafeScript = safePatterns.some((pattern) =>
      pattern.test(script.trim())
    );

    // Strict blocklist - these are always rejected regardless of pattern match
    // Security: Comprehensive list covering XSS, prototype pollution, and code injection vectors
    const strictBlocklist = [
      // Code execution
      'eval',
      'Function(',
      'setTimeout',
      'setInterval',
      'setImmediate',
      'requestAnimationFrame',
      'requestIdleCallback',
      // Storage access
      'document.cookie',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'openDatabase',
      'caches',
      // Network requests
      'XMLHttpRequest',
      'fetch(',
      'importScripts',
      'navigator.sendBeacon',
      'EventSource',
      'WebSocket',
      // DOM manipulation (XSS vectors)
      'window.open',
      'document.write',
      'document.writeln',
      'innerHTML',
      'outerHTML',
      'insertAdjacentHTML',
      'createContextualFragment',
      'document.domain',
      'document.implementation',
      // Prototype pollution
      '__proto__',
      '.constructor',
      '.prototype',
      'Object.assign',
      'Object.defineProperty',
      'Object.setPrototypeOf',
      'Reflect.',
      'Proxy',
      // Script injection
      'script>',
      '<script',
      '<iframe',
      '<object',
      '<embed',
      '<svg',
      'onerror',
      'onload',
      'onclick',
      // URI schemes
      'javascript:',
      'data:',
      'vbscript:',
      'blob:',
      // Encoding bypass attempts
      'atob',
      'btoa',
      'unescape',
      'decodeURI',
      'decodeURIComponent',
      'String.fromCharCode',
      'String.fromCodePoint',
      // Dangerous APIs
      'execCommand',
      'document.execCommand',
      'postMessage',
      'BroadcastChannel',
      'SharedWorker',
      'Worker(',
      'ServiceWorker',
      'navigator.serviceWorker',
      // Module loading
      'import(',
      'require(',
      'define(',
      // Clipboard access
      'navigator.clipboard',
      'document.getSelection',
      // Location manipulation
      'location.href',
      'location.assign',
      'location.replace',
      'history.pushState',
      'history.replaceState',
    ];

    const scriptLower = script.toLowerCase();
    for (const blocked of strictBlocklist) {
      if (scriptLower.includes(blocked.toLowerCase())) {
        throw ErrorHandler.createError(
          ErrorCode.VALIDATION_FAILED,
          `Script contains blocked operation. Use predefined templates: ${Object.keys(SAFE_SCRIPT_TEMPLATES).join(', ')}`
        );
      }
    }

    if (!isSafeScript) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        `Script does not match allowed patterns. Use predefined templates: ${Object.keys(SAFE_SCRIPT_TEMPLATES).join(', ')}`
      );
    }

    const page = this.getPage(sessionId, pageId);

    try {
      const result = await page.evaluate(script);
      this.updateSessionActivity(sessionId);

      return { result };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Script evaluation failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async closeBrowser(sessionId: string): Promise<{ success: boolean }> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw ErrorHandler.createError(
        ErrorCode.SESSION_NOT_FOUND,
        `Session not found: ${sessionId}`
      );
    }

    try {
      // Clean up all page-related resources before closing browser
      for (const [pageId] of session.pages) {
        const dialogKey = `${sessionId}:${pageId}`;
        this.pendingDialogs.delete(dialogKey);
        this.networkRoutes.delete(dialogKey);
      }

      await session.browser.close();
      this.sessions.delete(sessionId);
      this.tracingActive.delete(sessionId);

      this.logger.info('Browser session closed', { sessionId });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Failed to close browser', {
        sessionId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async closePage(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean }> {
    const session = this.getSession(sessionId);
    const page = session.pages.get(pageId);

    if (!page) {
      throw ErrorHandler.createError(
        ErrorCode.PAGE_NOT_FOUND,
        `Page not found: ${pageId}`
      );
    }

    try {
      await page.close();
      session.pages.delete(pageId);

      this.logger.info('Page closed', { sessionId, pageId });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Failed to close page', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async cleanupExpiredSessions(maxAge: number): Promise<{ cleaned: number }> {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.metadata.lastActivity.getTime() > maxAge) {
        // Skip if session is currently being cleaned or in use
        if (this.cleanupInProgress.has(sessionId)) {
          continue;
        }

        try {
          this.cleanupInProgress.add(sessionId);
          await session.browser.close();

          // Clean up all resources
          for (const [pageId] of session.pages) {
            const dialogKey = `${sessionId}:${pageId}`;
            this.pendingDialogs.delete(dialogKey);
            this.networkRoutes.delete(dialogKey);
          }
          this.tracingActive.delete(sessionId);

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
          this.cleanupInProgress.delete(sessionId);
        }
      }
    }

    return { cleaned };
  }

  async navigateBack(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; url?: string }> {
    const page = this.getPage(sessionId, pageId);

    try {
      await page.goBack({ waitUntil: 'load' });
      const url = page.url();

      this.updateSessionActivity(sessionId);
      this.logger.info('Navigated back', { sessionId, pageId, url });

      return { success: true, url };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Navigate back failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async resizeViewport(
    sessionId: string,
    pageId: string,
    size: { width: number; height: number }
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);

    try {
      await page.setViewportSize(size);

      this.updateSessionActivity(sessionId);
      this.logger.info('Viewport resized', { sessionId, pageId, size });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Resize viewport failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
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
    const session = this.getSession(sessionId);

    try {
      switch (action) {
        case 'list': {
          const tabs = await Promise.all(
            Array.from(session.pages.entries()).map(async ([id, page]) => ({
              pageId: id,
              title: await page.title(),
              url: page.url(),
              active: session.metadata.activePageId === id,
            }))
          );
          return { success: true, tabs };
        }

        case 'create': {
          const newPage = await session.context.newPage();
          const newPageId = uuidv4();
          session.pages.set(newPageId, newPage);

          if (url) {
            await newPage.goto(url, { waitUntil: 'load' });
          }

          // Set up dialog handler for new page
          this.setupDialogHandler(sessionId, newPageId, newPage);

          session.metadata.activePageId = newPageId;
          this.updateSessionActivity(sessionId);
          this.logger.info('New tab created', { sessionId, newPageId, url });

          return { success: true, newPageId };
        }

        case 'close': {
          if (!pageId) {
            throw ErrorHandler.createError(
              ErrorCode.VALIDATION_FAILED,
              'Page ID required for close action'
            );
          }

          const page = session.pages.get(pageId);
          if (!page) {
            throw ErrorHandler.createError(
              ErrorCode.PAGE_NOT_FOUND,
              `Page not found: ${pageId}`
            );
          }

          await page.close();
          session.pages.delete(pageId);
          this.pendingDialogs.delete(`${sessionId}:${pageId}`);

          // Update active page if needed
          if (session.metadata.activePageId === pageId) {
            const remaining = Array.from(session.pages.keys());
            session.metadata.activePageId =
              remaining.length > 0 ? remaining[0] : undefined;
          }

          this.updateSessionActivity(sessionId);
          this.logger.info('Tab closed', { sessionId, pageId });

          return { success: true };
        }

        case 'select': {
          if (!pageId) {
            throw ErrorHandler.createError(
              ErrorCode.VALIDATION_FAILED,
              'Page ID required for select action'
            );
          }

          const page = session.pages.get(pageId);
          if (!page) {
            throw ErrorHandler.createError(
              ErrorCode.PAGE_NOT_FOUND,
              `Page not found: ${pageId}`
            );
          }

          await page.bringToFront();
          session.metadata.activePageId = pageId;
          this.updateSessionActivity(sessionId);
          this.logger.info('Tab selected', { sessionId, pageId });

          return { success: true };
        }

        default:
          throw ErrorHandler.createError(
            ErrorCode.VALIDATION_FAILED,
            `Unknown action: ${action}`
          );
      }
    } catch (error) {
      const err = toError(error);
      this.logger.error('Manage tabs failed', {
        sessionId,
        action,
        error: err.message,
      });
      throw error;
    }
  }

  async handleDialog(
    sessionId: string,
    pageId: string,
    accept: boolean,
    promptText?: string
  ): Promise<{ success: boolean; dialogType?: string; message?: string }> {
    const dialogKey = `${sessionId}:${pageId}`;
    const dialog = this.pendingDialogs.get(dialogKey);

    if (!dialog) {
      throw ErrorHandler.createError(
        ErrorCode.INTERNAL_ERROR,
        'No pending dialog found for this page'
      );
    }

    try {
      const dialogType = dialog.type();
      const message = dialog.message();

      if (accept) {
        await dialog.accept(promptText);
      } else {
        await dialog.dismiss();
      }

      this.pendingDialogs.delete(dialogKey);
      this.updateSessionActivity(sessionId);
      this.logger.info('Dialog handled', {
        sessionId,
        pageId,
        dialogType,
        accept,
      });

      return { success: true, dialogType, message };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Handle dialog failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async uploadFiles(
    sessionId: string,
    pageId: string,
    selector: string,
    filePaths: string[]
  ): Promise<{ success: boolean; filesUploaded: number }> {
    const page = this.getPage(sessionId, pageId);

    // Fixed upload directory relative to module - cannot be manipulated via cwd
    const validatedPaths: string[] = [];

    for (const filePath of filePaths) {
      try {
        // First check: resolve path before symlink resolution
        const initialResolved = path.resolve(filePath);
        if (!initialResolved.startsWith(ALLOWED_UPLOAD_DIR)) {
          throw ErrorHandler.createError(
            ErrorCode.VALIDATION_FAILED,
            `File path not allowed: ${filePath}. Files must be in the uploads directory.`
          );
        }

        // Second check: resolve symlinks and verify still in upload dir (TOCTOU mitigation)
        const resolvedPath = await fs.realpath(initialResolved);
        if (!resolvedPath.startsWith(ALLOWED_UPLOAD_DIR)) {
          throw ErrorHandler.createError(
            ErrorCode.VALIDATION_FAILED,
            `Symlink points outside upload directory: ${filePath}`
          );
        }

        // Check file exists and is readable
        await fs.access(resolvedPath, fsConstants.R_OK);

        // Verify it's a regular file, not a directory
        const stats = await fs.stat(resolvedPath);
        if (!stats.isFile()) {
          throw ErrorHandler.createError(
            ErrorCode.VALIDATION_FAILED,
            `Path is not a file: ${filePath}`
          );
        }

        // File size limit to prevent DoS
        if (stats.size > config.limits.maxFileSizeForUpload) {
          throw ErrorHandler.createError(
            ErrorCode.VALIDATION_FAILED,
            `File exceeds size limit (${Math.round(config.limits.maxFileSizeForUpload / 1024 / 1024)}MB): ${filePath}`
          );
        }

        validatedPaths.push(resolvedPath);
      } catch (error) {
        if (isMCPPlaywrightError(error)) throw error;
        throw ErrorHandler.createError(
          ErrorCode.VALIDATION_FAILED,
          `File not found or not accessible: ${filePath}`
        );
      }
    }

    try {
      const fileInput = page.locator(selector);
      await fileInput.setInputFiles(validatedPaths);

      this.updateSessionActivity(sessionId);
      this.logger.info('Files uploaded', {
        sessionId,
        pageId,
        selector,
        fileCount: validatedPaths.length,
      });

      return { success: true, filesUploaded: validatedPaths.length };
    } catch (error) {
      if (isMCPPlaywrightError(error)) throw error;
      const err = toError(error);
      this.logger.error('File upload failed', {
        sessionId,
        pageId,
        selector,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  private setupDialogHandler(
    sessionId: string,
    pageId: string,
    page: Page
  ): void {
    const dialogKey = `${sessionId}:${pageId}`;

    page.on('dialog', (dialog) => {
      this.pendingDialogs.set(dialogKey, dialog);
      this.logger.info('Dialog detected', {
        sessionId,
        pageId,
        type: dialog.type(),
        message: dialog.message(),
      });

      // Auto-dismiss after timeout to prevent blocking and memory leaks
      setTimeout(() => {
        if (this.pendingDialogs.has(dialogKey)) {
          dialog.dismiss().catch(() => {});
          this.pendingDialogs.delete(dialogKey);
          this.logger.warn('Dialog auto-dismissed due to timeout', {
            sessionId,
            pageId,
            timeoutMs: BrowserManager.DIALOG_AUTO_DISMISS_TIMEOUT,
          });
        }
      }, BrowserManager.DIALOG_AUTO_DISMISS_TIMEOUT);
    });

    // Clean up on page close to prevent memory leaks
    page.on('close', () => {
      this.pendingDialogs.delete(dialogKey);
      this.networkRoutes.delete(dialogKey);
      this.logger.debug('Page closed, cleaned up dialogs and routes', {
        sessionId,
        pageId,
      });
    });
  }

  listSessions(): Array<{
    id: string;
    browserType: string;
    pageCount: number;
    lastActivity: Date;
  }> {
    return Array.from(this.sessions.values()).map((session) => ({
      id: session.id,
      browserType: session.metadata.browserType,
      pageCount: session.pages.size,
      lastActivity: session.metadata.lastActivity,
    }));
  }

  getServerStatus(): {
    activeSessions: number;
    maxSessions: number;
    availableSlots: number;
    sessions: Array<{
      id: string;
      browserType: string;
      pageCount: number;
      idleMs: number;
      headless: boolean;
    }>;
  } {
    const sessions = Array.from(this.sessions.values()).map((session) => ({
      id: session.id,
      browserType: session.metadata.browserType,
      pageCount: session.pages.size,
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

  async resetSessionState(sessionId: string): Promise<{
    success: boolean;
    clearedCookies: boolean;
    clearedStorage: boolean;
  }> {
    const session = this.getSession(sessionId);

    try {
      // Clear cookies
      await session.context.clearCookies();

      // Clear localStorage and sessionStorage for all pages
      for (const [, page] of session.pages) {
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
      }

      this.updateSessionActivity(sessionId);
      this.logger.info('Session state reset', { sessionId });

      return { success: true, clearedCookies: true, clearedStorage: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Reset session state failed', {
        sessionId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async preparePage(
    sessionId: string,
    pageId: string,
    options: {
      viewport?: { width: number; height: number };
      userAgent?: string;
      extraHTTPHeaders?: Record<string, string>;
      geolocation?: { latitude: number; longitude: number; accuracy?: number };
      permissions?: string[];
      colorScheme?: 'light' | 'dark' | 'no-preference';
      reducedMotion?: 'reduce' | 'no-preference';
      locale?: string;
      timezoneId?: string;
    } = {}
  ): Promise<{ success: boolean; appliedSettings: string[] }> {
    const session = this.getSession(sessionId);
    const page = this.getPage(sessionId, pageId);
    const appliedSettings: string[] = [];

    try {
      if (options.viewport) {
        await page.setViewportSize(options.viewport);
        appliedSettings.push('viewport');
      }

      if (options.extraHTTPHeaders) {
        await page.setExtraHTTPHeaders(options.extraHTTPHeaders);
        appliedSettings.push('extraHTTPHeaders');
      }

      if (options.geolocation) {
        await session.context.setGeolocation(options.geolocation);
        appliedSettings.push('geolocation');
      }

      if (options.permissions) {
        await session.context.grantPermissions(options.permissions);
        appliedSettings.push('permissions');
      }

      if (options.colorScheme) {
        await page.emulateMedia({ colorScheme: options.colorScheme });
        appliedSettings.push('colorScheme');
      }

      if (options.reducedMotion) {
        await page.emulateMedia({ reducedMotion: options.reducedMotion });
        appliedSettings.push('reducedMotion');
      }

      this.updateSessionActivity(sessionId);
      this.logger.info('Page prepared', { sessionId, pageId, appliedSettings });

      return { success: true, appliedSettings };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Prepare page failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async clickByAltText(
    sessionId: string,
    pageId: string,
    altText: string,
    options: { exact?: boolean; timeout?: number; force?: boolean } = {}
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const {
      exact = false,
      timeout = config.timeouts.action,
      force = false,
    } = options;

    try {
      const locator = page.getByAltText(altText, { exact });
      await locator.click({ force, timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Element clicked by alt text', {
        sessionId,
        pageId,
        altText,
      });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Click by alt text failed', {
        sessionId,
        pageId,
        altText,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async runAccessibilityScan(
    sessionId: string,
    pageId: string,
    options: {
      tags?: string[];
      includedImpacts?: Array<'minor' | 'moderate' | 'serious' | 'critical'>;
      selector?: string;
    } = {}
  ): Promise<{
    success: boolean;
    violations: Array<{
      id: string;
      impact: string;
      description: string;
      help: string;
      helpUrl: string;
      nodes: Array<{
        html: string;
        target: string[];
        failureSummary: string;
      }>;
    }>;
    passes: number;
    incomplete: number;
    inapplicable: number;
  }> {
    const page = this.getPage(sessionId, pageId);

    try {
      // Dynamic import for axe-core/playwright
      const axeModule = await import('@axe-core/playwright');
      const AxeBuilder = axeModule.default;
      let axeBuilder = new AxeBuilder({ page });

      // Apply WCAG tags filter if specified
      if (options.tags && options.tags.length > 0) {
        axeBuilder = axeBuilder.withTags(options.tags);
      }

      // Filter by specific selector if provided
      if (options.selector) {
        axeBuilder = axeBuilder.include(options.selector);
      }

      const results = await axeBuilder.analyze();

      // Filter violations by impact level if specified
      let filteredViolations = results.violations;
      if (options.includedImpacts && options.includedImpacts.length > 0) {
        const impactSet = new Set(options.includedImpacts);
        filteredViolations = results.violations.filter(
          (v: { impact?: string | null }) =>
            v.impact &&
            impactSet.has(
              v.impact as 'minor' | 'moderate' | 'serious' | 'critical'
            )
        );
      }

      type AxeViolation = (typeof results.violations)[number];
      type AxeNode = AxeViolation['nodes'][number];

      const formattedViolations = filteredViolations.map((v: AxeViolation) => ({
        id: v.id,
        impact: v.impact || 'unknown',
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map((n: AxeNode) => ({
          html: n.html,
          target: n.target as string[],
          failureSummary: n.failureSummary || '',
        })),
      }));

      this.updateSessionActivity(sessionId);
      this.logger.info('Accessibility scan completed', {
        sessionId,
        pageId,
        violations: formattedViolations.length,
        passes: results.passes.length,
      });

      return {
        success: true,
        violations: formattedViolations,
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        inapplicable: results.inapplicable.length,
      };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Accessibility scan failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // Keyboard methods
  async keyboardPress(
    sessionId: string,
    pageId: string,
    key: string,
    options?: { delay?: number }
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);

    try {
      await page.keyboard.press(key, options);
      this.updateSessionActivity(sessionId);
      this.logger.info('Keyboard press', { sessionId, pageId, key });
      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Keyboard press failed', {
        sessionId,
        pageId,
        key,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async keyboardType(
    sessionId: string,
    pageId: string,
    text: string,
    options?: { delay?: number }
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);

    try {
      await page.keyboard.type(text, options);
      this.updateSessionActivity(sessionId);
      this.logger.info('Keyboard type', {
        sessionId,
        pageId,
        textLength: text.length,
      });
      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Keyboard type failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // Mouse methods
  async mouseMove(
    sessionId: string,
    pageId: string,
    x: number,
    y: number,
    options?: { steps?: number }
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);

    try {
      await page.mouse.move(x, y, options);
      this.updateSessionActivity(sessionId);
      this.logger.info('Mouse move', { sessionId, pageId, x, y });
      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Mouse move failed', {
        sessionId,
        pageId,
        x,
        y,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async mouseClick(
    sessionId: string,
    pageId: string,
    x: number,
    y: number,
    options?: {
      button?: 'left' | 'middle' | 'right';
      clickCount?: number;
      delay?: number;
    }
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);

    try {
      await page.mouse.click(x, y, options);
      this.updateSessionActivity(sessionId);
      this.logger.info('Mouse click', {
        sessionId,
        pageId,
        x,
        y,
        button: options?.button ?? 'left',
      });
      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Mouse click failed', {
        sessionId,
        pageId,
        x,
        y,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // Tracing methods
  async startTracing(
    sessionId: string,
    options?: { screenshots?: boolean; snapshots?: boolean; sources?: boolean }
  ): Promise<{ success: boolean }> {
    const session = this.getSession(sessionId);

    if (this.tracingActive.get(sessionId)) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        'Tracing already active for this session'
      );
    }

    try {
      await session.context.tracing.start({
        screenshots: options?.screenshots ?? true,
        snapshots: options?.snapshots ?? true,
        sources: options?.sources ?? false,
      });
      this.tracingActive.set(sessionId, true);
      this.updateSessionActivity(sessionId);
      this.logger.info('Tracing started', { sessionId, options });
      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Start tracing failed', {
        sessionId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async stopTracing(
    sessionId: string,
    path?: string
  ): Promise<{ success: boolean; tracePath?: string }> {
    const session = this.getSession(sessionId);

    if (!this.tracingActive.get(sessionId)) {
      throw ErrorHandler.createError(
        ErrorCode.VALIDATION_FAILED,
        'No active tracing for this session'
      );
    }

    // Default path if not provided, validate if provided
    const defaultPath = `trace-${sessionId}-${Date.now()}.zip`;
    const tracePath = path ? this.validateOutputPath(path) : defaultPath;

    try {
      await session.context.tracing.stop({ path: tracePath });
      this.tracingActive.delete(sessionId);
      this.updateSessionActivity(sessionId);
      this.logger.info('Tracing stopped', { sessionId, tracePath });
      return { success: true, tracePath };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Stop tracing failed', {
        sessionId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // Network routing methods
  async addNetworkRoute(
    sessionId: string,
    pageId: string,
    urlPattern: string,
    response: {
      status?: number;
      body?: string;
      headers?: Record<string, string>;
      delay?: number;
      failureMode?: 'timeout' | 'abort' | 'malformed-json';
    }
  ): Promise<{ success: boolean; routeId: string }> {
    const page = this.getPage(sessionId, pageId);
    const routeKey = `${sessionId}:${pageId}`;
    const routeId = uuidv4();

    try {
      const handler = async (route: import('playwright').Route) => {
        // Apply optional delay before responding
        if (response.delay && response.delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, response.delay));
        }

        // Handle failure modes
        if (response.failureMode) {
          switch (response.failureMode) {
            case 'timeout':
              // Don't respond - let the request timeout
              return;
            case 'abort':
              await route.abort('failed');
              return;
            case 'malformed-json':
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: '{invalid json: "missing closing brace"',
              });
              return;
          }
        }

        await route.fulfill({
          status: response.status ?? 200,
          body: response.body ?? '',
          headers: response.headers,
        });
      };

      await page.route(urlPattern, handler);

      // Store route for later removal
      if (!this.networkRoutes.has(routeKey)) {
        this.networkRoutes.set(routeKey, new Map());
      }
      const routeMap = this.networkRoutes.get(routeKey);
      if (routeMap) {
        routeMap.set(routeId, { url: urlPattern, handler });
      }

      this.updateSessionActivity(sessionId);
      this.logger.info('Network route added', {
        sessionId,
        pageId,
        urlPattern,
        routeId,
        hasDelay: !!response.delay,
        failureMode: response.failureMode,
      });
      return { success: true, routeId };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Add network route failed', {
        sessionId,
        pageId,
        urlPattern,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async removeNetworkRoutes(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; routesRemoved: number }> {
    const page = this.getPage(sessionId, pageId);
    const routeKey = `${sessionId}:${pageId}`;

    try {
      const routes = this.networkRoutes.get(routeKey);
      let routesRemoved = 0;

      if (routes) {
        for (const [, routeInfo] of routes) {
          await page.unroute(routeInfo.url, routeInfo.handler);
          routesRemoved++;
        }
        this.networkRoutes.delete(routeKey);
      }

      this.updateSessionActivity(sessionId);
      this.logger.info('Network routes removed', {
        sessionId,
        pageId,
        routesRemoved,
      });
      return { success: true, routesRemoved };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Remove network routes failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // Role-based locator methods (Playwright best practice)
  async clickByRole(
    sessionId: string,
    pageId: string,
    role: AriaRole,
    options: {
      name?: string;
      exact?: boolean;
      timeout?: number;
      force?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    elementInfo?: Record<string, unknown> | null;
  }> {
    const page = this.getPage(sessionId, pageId);
    const {
      name,
      exact = false,
      timeout = config.timeouts.action,
      force = false,
    } = options;

    try {
      const locator = page.getByRole(role, { name, exact });
      await locator.click({ force, timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Element clicked by role', {
        sessionId,
        pageId,
        role,
        name,
      });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Click by role failed', {
        sessionId,
        pageId,
        role,
        name,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async fillByLabel(
    sessionId: string,
    pageId: string,
    label: string,
    text: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const { exact = false, timeout = config.timeouts.action } = options;

    try {
      const locator = page.getByLabel(label, { exact });
      await locator.fill(text, { timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Input filled by label', { sessionId, pageId, label });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Fill by label failed', {
        sessionId,
        pageId,
        label,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async clickByText(
    sessionId: string,
    pageId: string,
    text: string,
    options: { exact?: boolean; timeout?: number; force?: boolean } = {}
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const {
      exact = false,
      timeout = config.timeouts.action,
      force = false,
    } = options;

    try {
      const locator = page.getByText(text, { exact });
      await locator.click({ force, timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Element clicked by text', { sessionId, pageId, text });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Click by text failed', {
        sessionId,
        pageId,
        text,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async fillByPlaceholder(
    sessionId: string,
    pageId: string,
    placeholder: string,
    text: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const { exact = false, timeout = config.timeouts.action } = options;

    try {
      const locator = page.getByPlaceholder(placeholder, { exact });
      await locator.fill(text, { timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Input filled by placeholder', {
        sessionId,
        pageId,
        placeholder,
      });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Fill by placeholder failed', {
        sessionId,
        pageId,
        placeholder,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async clickByTestId(
    sessionId: string,
    pageId: string,
    testId: string,
    options: { timeout?: number; force?: boolean } = {}
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.action, force = false } = options;

    try {
      const locator = page.getByTestId(testId);
      await locator.click({ force, timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Element clicked by testId', {
        sessionId,
        pageId,
        testId,
      });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Click by testId failed', {
        sessionId,
        pageId,
        testId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async fillByTestId(
    sessionId: string,
    pageId: string,
    testId: string,
    text: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.action } = options;

    try {
      const locator = page.getByTestId(testId);
      await locator.fill(text, { timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Input filled by testId', { sessionId, pageId, testId });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Fill by testId failed', {
        sessionId,
        pageId,
        testId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // Web-first assertions (Playwright best practice)
  
  /**
   * Generic assertion executor that handles common patterns:
   * - Gets page and timeout
   * - Executes assertion
   * - Updates session activity on success
   * - Logs debug info on failure
   * - Optionally retrieves actual value on failure
   * 
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within session
   * @param selector - CSS selector for the element
   * @param assertionName - Name for logging
   * @param assertion - The assertion function to execute
   * @param buildSuccessResult - Function to build result on success
   * @param buildFailureResult - Function to build result on failure
   * @param extraLogData - Additional data to include in logs
   * @returns Assertion result with success flag and optional actual value
   */
  private async executeAssertion<TSuccess, TFailure>(
    sessionId: string,
    pageId: string,
    selector: string,
    assertionName: string,
    assertion: (page: Page, expect: typeof import('@playwright/test').expect) => Promise<void>,
    buildSuccessResult: () => TSuccess | Promise<TSuccess>,
    buildFailureResult: (err: Error) => TFailure | Promise<TFailure>,
    extraLogData?: Record<string, unknown>
  ): Promise<TSuccess | TFailure> {
    const page = this.getPage(sessionId, pageId);

    try {
      const expect = await getPlaywrightExpect();
      await assertion(page, expect);
      this.updateSessionActivity(sessionId);
      return await buildSuccessResult();
    } catch (error) {
      const err = toError(error);
      this.logger.debug(`Assert ${assertionName} failed`, {
        sessionId,
        pageId,
        selector,
        error: err.message,
        ...extraLogData,
      });
      return await buildFailureResult(err);
    }
  }

  async assertVisible(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; visible: boolean }> {
    const { timeout = config.timeouts.assertion } = options;

    return this.executeAssertion(
      sessionId,
      pageId,
      selector,
      'visible',
      async (page, expect) => {
        await expect(page.locator(selector)).toBeVisible({ timeout });
      },
      () => ({ success: true, visible: true }),
      async () => ({ success: false, visible: false })
    );
  }

  async assertHidden(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; hidden: boolean }> {
    const { timeout = config.timeouts.assertion } = options;

    return this.executeAssertion(
      sessionId,
      pageId,
      selector,
      'hidden',
      async (page, expect) => {
        await expect(page.locator(selector)).toBeHidden({ timeout });
      },
      () => ({ success: true, hidden: true }),
      async () => ({ success: false, hidden: false })
    );
  }

  async assertText(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedText: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean; actualText?: string }> {
    const page = this.getPage(sessionId, pageId);
    const { exact = false, timeout = config.timeouts.assertion } = options;

    return this.executeAssertion(
      sessionId,
      pageId,
      selector,
      'text',
      async (p, expect) => {
        const locator = p.locator(selector);
        if (exact) {
          await expect(locator).toHaveText(expectedText, { timeout });
        } else {
          await expect(locator).toContainText(expectedText, { timeout });
        }
      },
      async () => {
        const actualText = await page.locator(selector).textContent();
        return { success: true, actualText: actualText ?? undefined };
      },
      async () => {
        const actualText = await page.locator(selector).textContent().catch(() => null);
        return { success: false, actualText: actualText ?? undefined };
      },
      { expectedText }
    );
  }

  async assertAttribute(
    sessionId: string,
    pageId: string,
    selector: string,
    attribute: string,
    expectedValue: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualValue?: string }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.assertion } = options;

    return this.executeAssertion(
      sessionId,
      pageId,
      selector,
      'attribute',
      async (p, expect) => {
        await expect(p.locator(selector)).toHaveAttribute(attribute, expectedValue, { timeout });
      },
      async () => {
        const actualValue = await page.locator(selector).getAttribute(attribute);
        return { success: true, actualValue: actualValue ?? undefined };
      },
      async () => {
        const actualValue = await page.locator(selector).getAttribute(attribute).catch(() => null);
        return { success: false, actualValue: actualValue ?? undefined };
      },
      { attribute, expectedValue }
    );
  }

  async assertValue(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedValue: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualValue?: string }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.assertion } = options;

    return this.executeAssertion(
      sessionId,
      pageId,
      selector,
      'value',
      async (p, expect) => {
        await expect(p.locator(selector)).toHaveValue(expectedValue, { timeout });
      },
      async () => {
        const actualValue = await page.locator(selector).inputValue();
        return { success: true, actualValue };
      },
      async () => {
        const actualValue = await page.locator(selector).inputValue().catch(() => null);
        return { success: false, actualValue: actualValue ?? undefined };
      },
      { expectedValue }
    );
  }

  async assertChecked(
    sessionId: string,
    pageId: string,
    selector: string,
    checked: boolean = true,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; isChecked?: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.assertion } = options;

    return this.executeAssertion(
      sessionId,
      pageId,
      selector,
      'checked',
      async (p, expect) => {
        if (checked) {
          await expect(p.locator(selector)).toBeChecked({ timeout });
        } else {
          await expect(p.locator(selector)).not.toBeChecked({ timeout });
        }
      },
      async () => {
        const isChecked = await page.locator(selector).isChecked();
        return { success: true, isChecked };
      },
      async () => {
        const isChecked = await page.locator(selector).isChecked().catch(() => null);
        return { success: false, isChecked: isChecked ?? undefined };
      },
      { expectedChecked: checked }
    );
  }

  async assertUrl(
    sessionId: string,
    pageId: string,
    expectedUrl: string | RegExp,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualUrl?: string }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.assertion } = options;

    try {
      const expect = await getPlaywrightExpect();
      await expect(page).toHaveURL(expectedUrl, { timeout });

      this.updateSessionActivity(sessionId);
      return { success: true, actualUrl: page.url() };
    } catch (error) {
      const err = toError(error);
      this.logger.debug('Assert URL failed', {
        sessionId,
        pageId,
        expectedUrl,
        actualUrl: page.url(),
        error: err.message,
      });
      return { success: false, actualUrl: page.url() };
    }
  }

  async assertTitle(
    sessionId: string,
    pageId: string,
    expectedTitle: string | RegExp,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualTitle?: string }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.assertion } = options;

    try {
      const expect = await getPlaywrightExpect();
      await expect(page).toHaveTitle(expectedTitle, { timeout });

      const actualTitle = await page.title();
      this.updateSessionActivity(sessionId);
      return { success: true, actualTitle };
    } catch (error) {
      const actualTitle = await page.title();
      const err = toError(error);
      this.logger.debug('Assert title failed', {
        sessionId,
        pageId,
        expectedTitle,
        actualTitle,
        error: err.message,
      });
      return { success: false, actualTitle };
    }
  }

  // Select option (dropdown)
  async selectOption(
    sessionId: string,
    pageId: string,
    selector: string,
    values:
      | string
      | string[]
      | { value?: string; label?: string; index?: number }[],
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; selectedValues: string[] }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.action } = options;

    try {
      // Playwright locators auto-wait for actionable state
      const selectedValues = await page
        .locator(selector)
        .selectOption(values, { timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Option selected', {
        sessionId,
        pageId,
        selector,
        selectedValues,
      });

      return { success: true, selectedValues };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Select option failed', {
        sessionId,
        pageId,
        selector,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // Check/uncheck checkbox or radio
  async checkElement(
    sessionId: string,
    pageId: string,
    selector: string,
    checked: boolean = true,
    options: { force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const { force = false, timeout = config.timeouts.action } = options;

    try {
      const locator = page.locator(selector);

      // Playwright locators auto-wait for actionable state
      if (checked) {
        await locator.check({ force, timeout });
      } else {
        await locator.uncheck({ force, timeout });
      }

      this.updateSessionActivity(sessionId);
      this.logger.info(`Element ${checked ? 'checked' : 'unchecked'}`, {
        sessionId,
        pageId,
        selector,
      });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Check element failed', {
        sessionId,
        pageId,
        selector,
        checked,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // Drag and drop
  async dragAndDrop(
    sessionId: string,
    pageId: string,
    sourceSelector: string,
    targetSelector: string,
    options: {
      sourcePosition?: { x: number; y: number };
      targetPosition?: { x: number; y: number };
      timeout?: number;
    } = {}
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const {
      sourcePosition,
      targetPosition,
      timeout = config.timeouts.action,
    } = options;

    try {
      // Playwright locators auto-wait for actionable state
      await page.locator(sourceSelector).dragTo(page.locator(targetSelector), {
        sourcePosition,
        targetPosition,
        timeout,
      });

      this.updateSessionActivity(sessionId);
      this.logger.info('Drag and drop completed', {
        sessionId,
        pageId,
        sourceSelector,
        targetSelector,
      });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Drag and drop failed', {
        sessionId,
        pageId,
        sourceSelector,
        targetSelector,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // Frame locator for iframes
  async clickInFrame(
    sessionId: string,
    pageId: string,
    frameSelector: string,
    elementSelector: string,
    options: { timeout?: number; force?: boolean } = {}
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.action, force = false } = options;

    try {
      const frameLocator = page.frameLocator(frameSelector);
      await frameLocator.locator(elementSelector).click({ force, timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Clicked element in frame', {
        sessionId,
        pageId,
        frameSelector,
        elementSelector,
      });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Click in frame failed', {
        sessionId,
        pageId,
        frameSelector,
        elementSelector,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async fillInFrame(
    sessionId: string,
    pageId: string,
    frameSelector: string,
    elementSelector: string,
    text: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.action } = options;

    try {
      const frameLocator = page.frameLocator(frameSelector);
      await frameLocator.locator(elementSelector).fill(text, { timeout });

      this.updateSessionActivity(sessionId);
      this.logger.info('Filled input in frame', {
        sessionId,
        pageId,
        frameSelector,
        elementSelector,
      });

      return { success: true };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Fill in frame failed', {
        sessionId,
        pageId,
        frameSelector,
        elementSelector,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  // Storage state for authentication persistence
  async saveStorageState(
    sessionId: string,
    path?: string
  ): Promise<{ success: boolean; path: string }> {
    const session = this.getSession(sessionId);

    // Default path if not provided, validate if provided
    const defaultPath = `storage-state-${sessionId}.json`;
    const statePath = path ? this.validateOutputPath(path) : defaultPath;

    try {
      await session.context.storageState({ path: statePath });

      this.updateSessionActivity(sessionId);
      this.logger.info('Storage state saved', { sessionId, path: statePath });

      return { success: true, path: statePath };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Save storage state failed', {
        sessionId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }

  async launchWithStorageState(
    options: BrowserLaunchOptions & { storageState: string }
  ): Promise<{
    sessionId: string;
    browserType: string;
    recordingVideo: boolean;
  }> {
    // Rate limiting check
    this.checkSessionRateLimit();

    if (this.sessions.size >= config.maxConcurrentSessions) {
      throw ErrorHandler.createError(
        ErrorCode.INTERNAL_ERROR,
        `Maximum concurrent sessions (${config.maxConcurrentSessions}) reached.`
      );
    }

    const {
      browserType = config.defaultBrowser,
      headless = config.headless,
      viewport = config.defaultViewport,
      storageState,
      recordVideo,
    } = options;

    try {
      const launcher = BROWSER_LAUNCHERS[browserType];
      const browser = await launcher({ headless });

      const contextOptions: Parameters<Browser['newContext']>[0] = {
        viewport,
        storageState,
        ignoreHTTPSErrors: config.ignoreHTTPSErrors,
        // Locale and timezone for consistent behavior across runs
        locale: config.locale,
        timezoneId: config.timezoneId,
      };

      const context = await browser.newContext(contextOptions);
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
      this.logger.info('Browser session created with storage state', {
        sessionId,
        browserType,
        storageState,
        recordingVideo: !!recordVideo,
      });

      return { sessionId, browserType, recordingVideo: !!recordVideo };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Failed to launch browser with storage state', {
        error: err.message,
      });
      throw ErrorHandler.createError(
        ErrorCode.BROWSER_LAUNCH_FAILED,
        `Browser launch failed: ${err.message}`
      );
    }
  }

  // Download handling
  async waitForDownload(
    sessionId: string,
    pageId: string,
    options: { timeout?: number } = {}
  ): Promise<{
    success: boolean;
    suggestedFilename: string;
    path: string | null;
  }> {
    const page = this.getPage(sessionId, pageId);
    const { timeout = config.timeouts.navigation } = options;

    try {
      const download = await page.waitForEvent('download', { timeout });
      const suggestedFilename = download.suggestedFilename();
      const path = await download.path();

      this.updateSessionActivity(sessionId);
      this.logger.info('Download completed', {
        sessionId,
        pageId,
        suggestedFilename,
        path,
      });

      return { success: true, suggestedFilename, path };
    } catch (error) {
      const err = toError(error);
      this.logger.error('Wait for download failed', {
        sessionId,
        pageId,
        error: err.message,
      });
      throw ErrorHandler.handlePlaywrightError(err);
    }
  }
}

export default BrowserManager;
