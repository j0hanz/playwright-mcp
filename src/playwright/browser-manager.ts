import { Dialog, Page } from 'playwright';

import config from '../config/server-config.js';
import {
  BrowserType,
  ElementInteractionOptions,
  NavigationOptions,
  Viewport,
} from '../types/index.js';
import { ErrorCode, ErrorHandler, toError } from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';
import { AssertionActions } from './actions/assertion-actions.js';
import { InteractionActions } from './actions/interaction-actions.js';
import { LocatorActions } from './actions/locator-actions.js';
import { NavigationActions } from './actions/navigation-actions.js';
import { PageOperations } from './actions/page-operations.js';
import * as browserLauncher from './browser-launcher.js';
import { SessionManager } from './session-manager.js';

/**
 * Default timeout values aligned with Playwright best practices.
 * @see https://playwright.dev/docs/test-timeouts
 */
const TIMEOUTS = {
  /** Element actions (click, fill, hover) - 5 seconds */
  ACTION: config.timeouts.action,
  /** Page navigation - 30 seconds */
  NAVIGATION: config.timeouts.navigation,
  /** Assertions with auto-retry - 5 seconds */
  ASSERTION: config.timeouts.assertion,
  /** File downloads - 60 seconds */
  DOWNLOAD: config.timeouts.download,
} as const;

/**
 * Options for launching a new browser session.
 *
 * @see https://playwright.dev/docs/api/class-browsertype#browser-type-launch
 * @see https://playwright.dev/docs/browser-contexts
 */
export interface BrowserLaunchOptions {
  /** Browser engine: 'chromium' (default), 'firefox', or 'webkit' */
  browserType?: BrowserType;
  /** Run browser in headless mode (default: true) */
  headless?: boolean;
  /** Default viewport size for new pages */
  viewport?: Viewport;
  /** Custom user agent string */
  userAgent?: string;
  /** Browser launch timeout in milliseconds */
  timeout?: number;
  /** Browser channel: 'chrome', 'chrome-beta', 'msedge', etc. */
  channel?: string;
  /** Slow down operations by specified milliseconds (useful for debugging) */
  slowMo?: number;
  /** Proxy configuration for network requests */
  proxy?: {
    server: string;
    bypass?: string;
    username?: string;
    password?: string;
  };
  /** Video recording configuration */
  recordVideo?: {
    dir: string;
    size?: Viewport;
  };
  /** Path to storage state file for authentication reuse */
  storageState?: string;
}

/**
 * Core browser automation manager for the MCP Playwright server.
 *
 * This class orchestrates all browser operations following Playwright best practices:
 * - **Locator-based interactions**: Uses Playwright's recommended locator strategies
 * - **Web-first assertions**: Auto-retrying assertions that wait for conditions
 * - **Session isolation**: Each session has its own browser context
 * - **Automatic cleanup**: Dialog handling, resource cleanup on close
 *
 * @see https://playwright.dev/docs/locators
 * @see https://playwright.dev/docs/test-assertions
 * @see https://playwright.dev/docs/browser-contexts
 */
export class BrowserManager {
  private readonly sessionManager: SessionManager;
  private readonly logger = new Logger('BrowserManager');

  // Action delegates
  private readonly assertionActions: AssertionActions;
  private readonly interactionActions: InteractionActions;
  private readonly locatorActions: LocatorActions;
  private readonly navigationActions: NavigationActions;
  private readonly pageOperations: PageOperations;

  /** Pending dialogs awaiting user action, keyed by "sessionId:pageId" */
  private readonly pendingDialogs = new Map<string, Dialog>();

  /** Auto-dismiss timeouts for dialogs */
  private readonly dialogTimeouts = new Map<string, NodeJS.Timeout>();

  /** Auto-dismiss dialogs after 2x action timeout */
  private static readonly DIALOG_AUTO_DISMISS_TIMEOUT = TIMEOUTS.ACTION * 2;

  constructor() {
    this.sessionManager = new SessionManager(new Logger('SessionManager'));

    // Initialize action delegates
    this.assertionActions = new AssertionActions(
      this.sessionManager,
      this.logger
    );
    this.interactionActions = new InteractionActions(
      this.sessionManager,
      this.logger
    );
    this.locatorActions = new LocatorActions(this.sessionManager, this.logger);

    // Navigation and PageOperations need the setupDialogHandler callback
    const dialogHandler = this.setupDialogHandler.bind(this);
    this.navigationActions = new NavigationActions(
      this.sessionManager,
      this.logger,
      dialogHandler
    );
    this.pageOperations = new PageOperations(
      this.sessionManager,
      this.logger,
      dialogHandler
    );
  }

  // ============================================
  // Helper Methods
  // ============================================

  private setupDialogHandler(
    sessionId: string,
    pageId: string,
    page: Page
  ): void {
    const dialogKey = `${sessionId}:${pageId}`;

    page.on('dialog', (dialog) => {
      const existingTimeout = this.dialogTimeouts.get(dialogKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.dialogTimeouts.delete(dialogKey);
      }

      this.pendingDialogs.set(dialogKey, dialog);
      this.logger.info('Dialog detected', {
        sessionId,
        pageId,
        type: dialog.type(),
        message: dialog.message(),
      });

      const timeoutId = setTimeout(() => {
        if (this.pendingDialogs.has(dialogKey)) {
          dialog.dismiss().catch(() => {});
          this.pendingDialogs.delete(dialogKey);
          this.dialogTimeouts.delete(dialogKey);
          this.logger.warn('Dialog auto-dismissed due to timeout', {
            sessionId,
            pageId,
            timeoutMs: BrowserManager.DIALOG_AUTO_DISMISS_TIMEOUT,
          });
        }
      }, BrowserManager.DIALOG_AUTO_DISMISS_TIMEOUT);
      this.dialogTimeouts.set(dialogKey, timeoutId);
    });

    page.on('close', () => {
      const timeoutId = this.dialogTimeouts.get(dialogKey);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.dialogTimeouts.delete(dialogKey);
      }
      this.pendingDialogs.delete(dialogKey);
      this.logger.debug('Page closed, cleaned up dialogs and routes', {
        sessionId,
        pageId,
      });
    });
  }

  // ============================================
  // Browser Lifecycle
  // ============================================

  async launchBrowser(options: BrowserLaunchOptions = {}): Promise<{
    sessionId: string;
    browserType: string;
    recordingVideo: boolean;
  }> {
    this.sessionManager.checkRateLimit();
    this.sessionManager.checkCapacity();

    const { browser, context, browserType, headless, recordingVideo } =
      await browserLauncher.launch(options);

    const sessionId = this.sessionManager.createSession({
      browser,
      context,
      browserType,
      headless,
      viewport: options.viewport,
    });

    return { sessionId, browserType, recordingVideo };
  }

  async closeBrowser(sessionId: string): Promise<{ success: boolean }> {
    // Clean up dialogs and routes for all pages in the session
    if (this.sessionManager.hasSession(sessionId)) {
      const pageIds = this.sessionManager.getPageIds(sessionId);
      for (const pageId of pageIds) {
        const dialogKey = `${sessionId}:${pageId}`;
        this.pendingDialogs.delete(dialogKey);
        const timeoutId = this.dialogTimeouts.get(dialogKey);
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.dialogTimeouts.delete(dialogKey);
        }
      }
    }

    const session = this.sessionManager.getSession(sessionId);
    try {
      await session.browser.close();
      this.sessionManager.deleteSession(sessionId);
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

  async cleanupExpiredSessions(maxAge: number): Promise<{ cleaned: number }> {
    return this.sessionManager.cleanupExpiredSessions(
      maxAge,
      async (sessionId, session) => {
        // Cleanup callback
        for (const [pageId] of session.pages) {
          const dialogKey = `${sessionId}:${pageId}`;
          const timeoutId = this.dialogTimeouts.get(dialogKey);
          if (timeoutId) {
            clearTimeout(timeoutId);
            this.dialogTimeouts.delete(dialogKey);
          }
          this.pendingDialogs.delete(dialogKey);
        }
        await Promise.resolve();
      }
    );
  }

  listSessions() {
    return this.sessionManager.listSessions();
  }

  getServerStatus(): {
    activeSessions: number;
    maxSessions: number;
    availableSlots: number;
    sessions: Array<{
      id: string;
      browserType: string;
      pageCount: number;
      lastActivity: Date;
    }>;
  } {
    const sessions = this.sessionManager.listSessions();
    const maxSessions = config.maxConcurrentSessions;

    return {
      activeSessions: sessions.length,
      maxSessions,
      availableSlots: Math.max(0, maxSessions - sessions.length),
      sessions,
    };
  }

  // ============================================
  // Navigation
  // ============================================

  async navigateToPage(
    options: NavigationOptions
  ): Promise<{ pageId: string; title: string; url: string }> {
    return this.navigationActions.navigateToPage(options);
  }

  async navigateBack(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; url?: string }> {
    return this.navigationActions.navigateBack(sessionId, pageId);
  }

  // ============================================
  // Interactions
  // ============================================

  async clickElement(options: ElementInteractionOptions): Promise<{
    success: boolean;
    elementInfo?: Record<string, unknown> | null;
  }> {
    return this.interactionActions.clickElement(options);
  }

  async fillInput(
    options: ElementInteractionOptions & { text: string }
  ): Promise<{ success: boolean }> {
    return this.interactionActions.fillInput(options);
  }

  async hoverElement(
    options: ElementInteractionOptions
  ): Promise<{ success: boolean }> {
    return this.interactionActions.hoverElement(options);
  }

  async selectOption(
    sessionId: string,
    pageId: string,
    selector: string,
    value: string | string[],
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; selectedValues: string[] }> {
    return this.interactionActions.selectOption(
      sessionId,
      pageId,
      selector,
      value,
      options
    );
  }

  async dragAndDrop(
    sessionId: string,
    pageId: string,
    sourceSelector: string,
    targetSelector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.interactionActions.dragAndDrop(
      sessionId,
      pageId,
      sourceSelector,
      targetSelector,
      options
    );
  }

  // ============================================
  // Assertions
  // ============================================

  /**
   * Assert that an element is hidden or not in the DOM.
   *
   * Uses Playwright's web-first assertion pattern with auto-waiting.
   * The assertion will retry until the element is hidden or timeout.
   *
   * @see https://playwright.dev/docs/test-assertions#locator-assertions-to-be-hidden
   *
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within the session
   * @param selector - CSS selector for the element
   * @param options - Optional timeout configuration
   * @returns Object indicating success and hidden state
   */
  async assertHidden(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; hidden: boolean }> {
    return this.assertionActions.assertHidden(
      sessionId,
      pageId,
      selector,
      options
    );
  }

  /**
   * Assert that an element is visible on the page.
   *
   * Uses Playwright's web-first assertion pattern with auto-waiting.
   * The assertion will retry until the element becomes visible or timeout.
   *
   * @see https://playwright.dev/docs/test-assertions#locator-assertions-to-be-visible
   *
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within the session
   * @param selector - CSS selector, text selector, or locator string
   * @param options - Optional timeout configuration
   * @returns Object indicating success and visibility state
   *
   * @example
   * ```typescript
   * // Using CSS selector
   * await browserManager.assertVisible(sessionId, pageId, '#submit-btn');
   *
   * // Using text selector
   * await browserManager.assertVisible(sessionId, pageId, 'text=Submit');
   * ```
   */
  async assertVisible(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; visible: boolean }> {
    return this.assertionActions.assertVisible(
      sessionId,
      pageId,
      selector,
      options
    );
  }

  /**
   * Assert that an element contains or matches specific text.
   *
   * Uses Playwright's locator-based text retrieval with auto-waiting.
   * Supports both exact matching and substring matching.
   *
   * @see https://playwright.dev/docs/test-assertions#locator-assertions-to-have-text
   * @see https://playwright.dev/docs/test-assertions#locator-assertions-to-contain-text
   *
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within the session
   * @param selector - CSS selector for the element
   * @param expectedText - Text to match against
   * @param options - Match options (exact: true for exact match, false for contains)
   * @returns Object with success status and actual text found
   */
  async assertText(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedText: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean; actualText?: string }> {
    return this.assertionActions.assertText(
      sessionId,
      pageId,
      selector,
      expectedText,
      options
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
    return this.assertionActions.assertAttribute(
      sessionId,
      pageId,
      selector,
      attribute,
      expectedValue,
      options
    );
  }

  async assertValue(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedValue: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualValue?: string }> {
    return this.assertionActions.assertValue(
      sessionId,
      pageId,
      selector,
      expectedValue,
      options
    );
  }

  async assertChecked(
    sessionId: string,
    pageId: string,
    selector: string,
    checked: boolean,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; isChecked?: boolean }> {
    return this.assertionActions.assertChecked(
      sessionId,
      pageId,
      selector,
      checked,
      options
    );
  }

  async assertUrl(
    sessionId: string,
    pageId: string,
    expectedUrl: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualUrl?: string }> {
    return this.assertionActions.assertUrl(
      sessionId,
      pageId,
      expectedUrl,
      options
    );
  }

  async assertTitle(
    sessionId: string,
    pageId: string,
    expectedTitle: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualTitle?: string }> {
    return this.assertionActions.assertTitle(
      sessionId,
      pageId,
      expectedTitle,
      options
    );
  }

  // ============================================
  // Security / Scripts
  // ============================================

  async evaluateScript(
    sessionId: string,
    pageId: string,
    script: string
  ): Promise<{ result: unknown }> {
    return this.pageOperations.evaluateScript(sessionId, pageId, script);
  }

  // ============================================
  // File Upload
  // ============================================

  async uploadFiles(
    sessionId: string,
    pageId: string,
    selector: string,
    filePaths: string[]
  ): Promise<{ success: boolean; filesUploaded: number }> {
    return this.interactionActions.uploadFiles(
      sessionId,
      pageId,
      selector,
      filePaths
    );
  }

  // ============================================
  // Dialogs
  // ============================================

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

      const timeoutId = this.dialogTimeouts.get(dialogKey);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.dialogTimeouts.delete(dialogKey);
      }

      this.pendingDialogs.delete(dialogKey);
      this.sessionManager.updateActivity(sessionId);
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

  // ============================================
  // Viewport & Tabs
  // ============================================

  async resizeViewport(
    sessionId: string,
    pageId: string,
    viewport: Viewport
  ): Promise<{ success: boolean }> {
    return this.pageOperations.resizeViewport(sessionId, pageId, viewport);
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
    return this.pageOperations.manageTabs(sessionId, action, pageId, url);
  }

  // ============================================
  // Page Content & Screenshots
  // ============================================

  async takeScreenshot(options: {
    sessionId: string;
    pageId: string;
    fullPage?: boolean;
    path?: string;
    type?: 'png' | 'jpeg';
    quality?: number;
  }): Promise<{ base64?: string; path?: string }> {
    return this.pageOperations.takeScreenshot(options);
  }

  async getPageContent(
    sessionId: string,
    pageId: string
  ): Promise<{ html: string; text: string }> {
    return this.pageOperations.getPageContent(sessionId, pageId);
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
    return this.pageOperations.waitForSelector(
      sessionId,
      pageId,
      selector,
      options
    );
  }

  getPageForTool(sessionId: string, pageId: string): Page {
    return this.sessionManager.getPage(sessionId, pageId);
  }

  markSessionActive(sessionId: string): void {
    this.sessionManager.updateActivity(sessionId);
  }

  // ============================================
  // Keyboard & Mouse
  // ============================================

  async keyboardPress(
    sessionId: string,
    pageId: string,
    key: string,
    options: { delay?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.interactionActions.keyboardPress(
      sessionId,
      pageId,
      key,
      options
    );
  }

  async keyboardType(
    sessionId: string,
    pageId: string,
    text: string,
    options: { delay?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.interactionActions.keyboardType(
      sessionId,
      pageId,
      text,
      options
    );
  }

  async mouseMove(
    sessionId: string,
    pageId: string,
    x: number,
    y: number,
    options: { steps?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.interactionActions.mouseMove(sessionId, pageId, x, y, options);
  }

  async mouseClick(
    sessionId: string,
    pageId: string,
    x: number,
    y: number,
    options: {
      button?: 'left' | 'middle' | 'right';
      clickCount?: number;
      delay?: number;
    } = {}
  ): Promise<{ success: boolean }> {
    return this.interactionActions.mouseClick(sessionId, pageId, x, y, options);
  }

  // ============================================
  // Tracing & Storage
  // ============================================

  async startTracing(
    sessionId: string,
    options: { screenshots?: boolean; snapshots?: boolean } = {}
  ): Promise<{ success: boolean }> {
    const session = this.sessionManager.getSession(sessionId);
    await session.context.tracing.start(options);
    this.sessionManager.updateActivity(sessionId);
    return { success: true };
  }

  async stopTracing(
    sessionId: string,
    path: string
  ): Promise<{ success: boolean; path: string }> {
    const session = this.sessionManager.getSession(sessionId);
    await session.context.tracing.stop({ path });
    this.sessionManager.updateActivity(sessionId);
    return { success: true, path };
  }

  async saveStorageState(
    sessionId: string,
    path?: string
  ): Promise<{ success: boolean; path: string }> {
    const session = this.sessionManager.getSession(sessionId);
    const statePath = path || `storage-state-${sessionId}.json`;
    await session.context.storageState({ path: statePath });
    this.sessionManager.updateActivity(sessionId);
    return { success: true, path: statePath };
  }

  async launchWithStorageState(
    options: BrowserLaunchOptions & { storageState: string }
  ): Promise<{ sessionId: string; browserType: string }> {
    const result = await this.launchBrowser(options);
    return {
      sessionId: result.sessionId,
      browserType: result.browserType,
    };
  }

  // ============================================
  // Role-based Locators
  // ============================================

  /**
   * Click an element by its ARIA role.
   *
   * **This is the recommended locator strategy by Playwright.**
   * Role-based locators are resilient to DOM changes and ensure accessibility.
   *
   * @see https://playwright.dev/docs/locators#locate-by-role
   * @see https://www.w3.org/TR/wai-aria-1.2/#roles
   *
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within the session
   * @param role - ARIA role (button, link, checkbox, textbox, etc.)
   * @param options - Locator options (name, exact, force, timeout)
   * @returns Success status
   *
   * @example
   * ```typescript
   * // Click a button by its accessible name
   * await browserManager.clickByRole(sessionId, pageId, 'button', { name: 'Submit' });
   *
   * // Click a link with exact text match
   * await browserManager.clickByRole(sessionId, pageId, 'link', { name: 'Learn more', exact: true });
   * ```
   */
  async clickByRole(
    sessionId: string,
    pageId: string,
    role: import('../types/index.js').AriaRole,
    options: {
      name?: string;
      exact?: boolean;
      force?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{ success: boolean }> {
    return this.locatorActions.clickByRole(sessionId, pageId, role, options);
  }

  /**
   * Fill an input field by its associated label text.
   *
   * **Recommended for form inputs** - matches how users identify form fields.
   * Works with <label> elements, aria-labelledby, and aria-label.
   *
   * @see https://playwright.dev/docs/locators#locate-by-label
   *
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within the session
   * @param label - Label text to match (case-insensitive by default)
   * @param text - Text to fill into the input
   * @param options - Options for matching and timeout
   * @returns Success status
   *
   * @example
   * ```typescript
   * // Fill input associated with "Email" label
   * await browserManager.fillByLabel(sessionId, pageId, 'Email', 'user@example.com');
   *
   * // With exact matching for ambiguous labels
   * await browserManager.fillByLabel(sessionId, pageId, 'Password', 'secret', { exact: true });
   * ```
   */
  async fillByLabel(
    sessionId: string,
    pageId: string,
    label: string,
    text: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.locatorActions.fillByLabel(
      sessionId,
      pageId,
      label,
      text,
      options
    );
  }

  /**
   * Click an element containing specific text.
   *
   * Uses Playwright's getByText() locator for text-based element selection.
   *
   * @see https://playwright.dev/docs/locators#locate-by-text
   *
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within the session
   * @param text - Text content to search for
   * @param options - Options for matching behavior and timeout
   * @returns Success status
   *
   * @example
   * ```typescript
   * // Click element containing "Welcome"
   * await browserManager.clickByText(sessionId, pageId, 'Welcome');
   *
   * // Exact text match
   * await browserManager.clickByText(sessionId, pageId, 'Click here', { exact: true });
   * ```
   */
  async clickByText(
    sessionId: string,
    pageId: string,
    text: string,
    options: { exact?: boolean; force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.locatorActions.clickByText(sessionId, pageId, text, options);
  }

  /**
   * Fill an input field by its placeholder text.
   *
   * **Use when labels aren't available.** Placeholder text provides
   * a reasonable fallback for identifying inputs.
   *
   * @see https://playwright.dev/docs/locators#locate-by-placeholder
   *
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within the session
   * @param placeholder - Placeholder attribute text
   * @param text - Text to fill into the input
   * @param options - Matching and timeout options
   * @returns Success status
   *
   * @example
   * ```typescript
   * await browserManager.fillByPlaceholder(sessionId, pageId, 'Enter email...', 'user@example.com');
   * ```
   */
  async fillByPlaceholder(
    sessionId: string,
    pageId: string,
    placeholder: string,
    text: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.locatorActions.fillByPlaceholder(
      sessionId,
      pageId,
      placeholder,
      text,
      options
    );
  }

  /**
   * Click an element using its data-testid attribute.
   *
   * **Use when semantic locators aren't suitable.**
   * Test IDs provide stable selectors independent of implementation.
   *
   * @see https://playwright.dev/docs/locators#locate-by-test-id
   *
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within the session
   * @param testId - Value of the data-testid attribute
   * @param options - Force click and timeout options
   * @returns Success status
   *
   * @example
   * ```typescript
   * // HTML: <button data-testid="submit-btn">Submit</button>
   * await browserManager.clickByTestId(sessionId, pageId, 'submit-btn');
   * ```
   */
  async clickByTestId(
    sessionId: string,
    pageId: string,
    testId: string,
    options: { force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.locatorActions.clickByTestId(
      sessionId,
      pageId,
      testId,
      options
    );
  }

  /**
   * Fill an input field using its data-testid attribute.
   *
   * @see https://playwright.dev/docs/locators#locate-by-test-id
   *
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within the session
   * @param testId - Value of the data-testid attribute
   * @param text - Text to fill into the input
   * @param options - Timeout options
   * @returns Success status
   */
  async fillByTestId(
    sessionId: string,
    pageId: string,
    testId: string,
    text: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.locatorActions.fillByTestId(
      sessionId,
      pageId,
      testId,
      text,
      options
    );
  }

  /**
   * Click an image element by its alt text.
   *
   * Useful for image-based navigation and accessibility testing.
   *
   * @see https://playwright.dev/docs/locators#locate-by-alt-text
   *
   * @param sessionId - Browser session ID
   * @param pageId - Page ID within the session
   * @param altText - Alt text attribute value
   * @param options - Matching and interaction options
   * @returns Success status
   *
   * @example
   * ```typescript
   * // Click an image with alt="Company Logo"
   * await browserManager.clickByAltText(sessionId, pageId, 'Company Logo');
   * ```
   */
  async clickByAltText(
    sessionId: string,
    pageId: string,
    altText: string,
    options: { exact?: boolean; force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.locatorActions.clickByAltText(
      sessionId,
      pageId,
      altText,
      options
    );
  }

  // ============================================
  // Advanced Features
  // ============================================

  async waitForDownload(
    sessionId: string,
    pageId: string,
    options: { timeout?: number } = {}
  ): Promise<{
    success: boolean;
    suggestedFilename: string;
    path: string | null;
  }> {
    return this.pageOperations.waitForDownload(sessionId, pageId, options);
  }

  async resetSessionState(sessionId: string): Promise<{
    success: boolean;
    clearedCookies: boolean;
    clearedStorage: boolean;
  }> {
    return this.pageOperations.resetSessionState(sessionId);
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
    return this.pageOperations.preparePage(sessionId, pageId, options);
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
    return this.pageOperations.runAccessibilityScan(sessionId, pageId, options);
  }
}
