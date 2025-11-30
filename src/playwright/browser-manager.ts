import { Page } from 'playwright';

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
import { ClockActions } from './actions/clock-actions.js';
import { InteractionActions } from './actions/interaction-actions.js';
import { LocatorActions } from './actions/locator-actions.js';
import { NavigationActions } from './actions/navigation-actions.js';
import { NetworkActions } from './actions/network-actions.js';
import { PageOperations } from './actions/page-operations.js';
import { TracingActions } from './actions/tracing-actions.js';
import * as browserLauncher from './browser-launcher.js';
import { DialogManager } from './dialog-manager.js';
import { SessionManager } from './session-manager.js';

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
  private readonly dialogManager: DialogManager;
  private readonly logger = new Logger('BrowserManager');

  // Action delegates
  private readonly assertionActions: AssertionActions;
  private readonly clockActions: ClockActions;
  private readonly interactionActions: InteractionActions;
  private readonly locatorActions: LocatorActions;
  private readonly navigationActions: NavigationActions;
  private readonly networkActions: NetworkActions;
  private readonly pageOperations: PageOperations;
  private readonly tracingActions: TracingActions;

  constructor() {
    this.sessionManager = new SessionManager(new Logger('SessionManager'));
    this.dialogManager = new DialogManager(new Logger('DialogManager'));

    // Initialize action delegates
    this.assertionActions = new AssertionActions(
      this.sessionManager,
      this.logger
    );
    this.clockActions = new ClockActions(this.sessionManager, this.logger);
    this.interactionActions = new InteractionActions(
      this.sessionManager,
      this.logger
    );
    this.locatorActions = new LocatorActions(this.sessionManager, this.logger);

    this.navigationActions = new NavigationActions(
      this.sessionManager,
      this.logger,
      this.dialogManager
    );
    this.networkActions = new NetworkActions(this.sessionManager, this.logger);
    this.pageOperations = new PageOperations(
      this.sessionManager,
      this.logger,
      this.dialogManager
    );
    this.tracingActions = new TracingActions(this.sessionManager, this.logger);
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
      this.dialogManager.cleanupSession(sessionId, pageIds);
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
        const pageIds = Array.from(session.pages.keys());
        this.dialogManager.cleanupSession(sessionId, pageIds);
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

  /**
   * Assert that an element is enabled.
   *
   * @see https://playwright.dev/docs/test-assertions#locator-assertions-to-be-enabled
   */
  async assertEnabled(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; enabled: boolean }> {
    return this.assertionActions.assertEnabled(
      sessionId,
      pageId,
      selector,
      options
    );
  }

  /**
   * Assert that an element is disabled.
   *
   * @see https://playwright.dev/docs/test-assertions#locator-assertions-to-be-disabled
   */
  async assertDisabled(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; disabled: boolean }> {
    return this.assertionActions.assertDisabled(
      sessionId,
      pageId,
      selector,
      options
    );
  }

  /**
   * Assert that an element has focus.
   *
   * @see https://playwright.dev/docs/test-assertions#locator-assertions-to-be-focused
   */
  async assertFocused(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; focused: boolean }> {
    return this.assertionActions.assertFocused(
      sessionId,
      pageId,
      selector,
      options
    );
  }

  /**
   * Assert element count for a selector.
   *
   * @see https://playwright.dev/docs/test-assertions#locator-assertions-to-have-count
   */
  async assertCount(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedCount: number,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualCount: number }> {
    return this.assertionActions.assertCount(
      sessionId,
      pageId,
      selector,
      expectedCount,
      options
    );
  }

  /**
   * Assert that an element has a specific CSS property value.
   *
   * @see https://playwright.dev/docs/test-assertions#locator-assertions-to-have-css
   */
  async assertCss(
    sessionId: string,
    pageId: string,
    selector: string,
    property: string,
    expectedValue: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualValue?: string }> {
    return this.assertionActions.assertCss(
      sessionId,
      pageId,
      selector,
      property,
      expectedValue,
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
    try {
      const { dialogType, message } = await this.dialogManager.handleDialog(
        sessionId,
        pageId,
        accept,
        promptText
      );

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
      // Check if it's our custom error message
      if (err.message === 'No pending dialog found for this page') {
        throw ErrorHandler.createError(ErrorCode.INTERNAL_ERROR, err.message);
      }
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

  /**
   * Start tracing for a session.
   *
   * @see https://playwright.dev/docs/trace-viewer
   */
  async startTracing(
    sessionId: string,
    options: {
      screenshots?: boolean;
      snapshots?: boolean;
      sources?: boolean;
    } = {}
  ): Promise<{ success: boolean }> {
    return this.tracingActions.startTracing(sessionId, options);
  }

  /**
   * Stop tracing and save to a file.
   *
   * @see https://playwright.dev/docs/trace-viewer
   */
  async stopTracing(
    sessionId: string,
    path: string
  ): Promise<{ success: boolean; path: string }> {
    return this.tracingActions.stopTracing(sessionId, path);
  }

  /**
   * Start a named group in tracing for better organization in Trace Viewer.
   *
   * Groups help organize related actions in the trace viewer, making it easier
   * to navigate and understand complex test flows.
   *
   * @see https://playwright.dev/docs/api/class-tracing#tracing-group
   */
  async startTracingGroup(
    sessionId: string,
    name: string,
    options: {
      location?: { file: string; line?: number; column?: number };
    } = {}
  ): Promise<{ success: boolean; groupName: string }> {
    return this.tracingActions.startTracingGroup(sessionId, name, options);
  }

  /**
   * End the current tracing group.
   *
   * @see https://playwright.dev/docs/api/class-tracing#tracing-group-end
   */
  async endTracingGroup(sessionId: string): Promise<{ success: boolean }> {
    return this.tracingActions.endTracingGroup(sessionId);
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
  // Clock Mocking
  // ============================================

  /**
   * Install fake clock on a page for time-dependent testing.
   *
   * This allows controlling time in the page, which is useful for testing:
   * - Animations and transitions
   * - Timeouts and intervals
   * - Date-dependent functionality
   *
   * @see https://playwright.dev/docs/clock
   */
  async installClock(
    sessionId: string,
    pageId: string,
    options: { time?: number | string | Date } = {}
  ): Promise<{ success: boolean; installedTime?: string }> {
    return this.clockActions.installClock(sessionId, pageId, options);
  }

  /**
   * Set the clock to a fixed time and freeze it.
   *
   * Time will not progress until you call resumeClock() or runClockFor().
   *
   * @see https://playwright.dev/docs/api/class-clock#clock-set-fixed-time
   */
  async setFixedTime(
    sessionId: string,
    pageId: string,
    time: number | string | Date
  ): Promise<{ success: boolean; fixedTime: string }> {
    return this.clockActions.setFixedTime(sessionId, pageId, time);
  }

  /**
   * Pause the clock at its current time.
   *
   * @see https://playwright.dev/docs/api/class-clock#clock-pause-at
   */
  async pauseClock(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; pausedAt: string }> {
    return this.clockActions.pauseClock(sessionId, pageId);
  }

  /**
   * Resume the clock from its current paused state.
   *
   * @see https://playwright.dev/docs/api/class-clock#clock-resume
   */
  async resumeClock(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean }> {
    return this.clockActions.resumeClock(sessionId, pageId);
  }

  /**
   * Advance the clock by a specified duration.
   *
   * This triggers all pending timers scheduled within that time range.
   *
   * @param duration - Time to advance in milliseconds or human-readable string (e.g., '1:30:00')
   * @see https://playwright.dev/docs/api/class-clock#clock-run-for
   */
  async runClockFor(
    sessionId: string,
    pageId: string,
    duration: number | string
  ): Promise<{ success: boolean; advancedBy: string }> {
    return this.clockActions.runClockFor(sessionId, pageId, duration);
  }

  /**
   * Fast-forward time by jumping to a specific point.
   *
   * Unlike runClockFor, this does NOT fire any intermediate timers.
   *
   * @see https://playwright.dev/docs/api/class-clock#clock-fast-forward
   */
  async fastForwardClock(
    sessionId: string,
    pageId: string,
    ticks: number | string
  ): Promise<{ success: boolean; fastForwardedBy: string }> {
    return this.clockActions.fastForwardClock(sessionId, pageId, ticks);
  }

  /**
   * Set the system time without affecting timer execution.
   *
   * @see https://playwright.dev/docs/api/class-clock#clock-set-system-time
   */
  async setSystemTime(
    sessionId: string,
    pageId: string,
    time: number | string | Date
  ): Promise<{ success: boolean; systemTime: string }> {
    return this.clockActions.setSystemTime(sessionId, pageId, time);
  }

  // ============================================
  // HAR Mocking
  // ============================================

  /**
   * Route network requests using a HAR file for mock responses.
   *
   * HAR (HTTP Archive) files record network traffic and can be used to:
   * - Replay recorded network responses for consistent testing
   * - Mock API responses without hitting real servers
   * - Test offline scenarios
   *
   * You can record HAR files using:
   * - Browser DevTools (Network tab > Export HAR)
   * - Playwright's recordHar context option
   *
   * @see https://playwright.dev/docs/mock#mocking-with-har-files
   */
  async routeFromHAR(
    sessionId: string,
    pageId: string,
    harPath: string,
    options: {
      url?: string | RegExp;
      notFound?: 'abort' | 'fallback';
      update?: boolean;
      updateContent?: 'embed' | 'attach';
      updateMode?: 'full' | 'minimal';
    } = {}
  ): Promise<{ success: boolean; harPath: string }> {
    return this.networkActions.routeFromHAR(
      sessionId,
      pageId,
      harPath,
      options
    );
  }

  /**
   * Route network requests at the context level using a HAR file.
   *
   * This applies the HAR mocking to ALL pages in the browser context.
   *
   * @see https://playwright.dev/docs/mock#mocking-with-har-files
   */
  async contextRouteFromHAR(
    sessionId: string,
    harPath: string,
    options: {
      url?: string | RegExp;
      notFound?: 'abort' | 'fallback';
      update?: boolean;
      updateContent?: 'embed' | 'attach';
      updateMode?: 'full' | 'minimal';
    } = {}
  ): Promise<{ success: boolean; harPath: string }> {
    return this.networkActions.contextRouteFromHAR(sessionId, harPath, options);
  }

  /**
   * Unroute all HAR-based routes for a page.
   *
   * @see https://playwright.dev/docs/api/class-page#page-unroute-all
   */
  async unrouteAll(
    sessionId: string,
    pageId: string,
    options: { behavior?: 'wait' | 'ignoreErrors' | 'default' } = {}
  ): Promise<{ success: boolean }> {
    return this.networkActions.unrouteAll(sessionId, pageId, options);
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
