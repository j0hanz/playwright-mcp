/**
 * Browser Manager - Core browser automation for MCP Playwright Server
 *
 * @see https://playwright.dev/docs/locators
 * @see https://playwright.dev/docs/test-assertions
 * @see https://playwright.dev/docs/browser-contexts
 */
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
  storageState?: string;
}

export class BrowserManager {
  private readonly sessionManager: SessionManager;
  private readonly dialogManager: DialogManager;
  private readonly logger = new Logger('BrowserManager');

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

  // Browser Lifecycle

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

  // Navigation

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

  // Interactions

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

  // Assertions

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

  // Security / Scripts

  async evaluateScript(
    sessionId: string,
    pageId: string,
    script: string
  ): Promise<{ result: unknown }> {
    return this.pageOperations.evaluateScript(sessionId, pageId, script);
  }

  // File Upload

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

  // Dialogs

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

  // Viewport & Tabs

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

  // Page Content & Screenshots

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

  // Keyboard & Mouse

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

  // Tracing & Storage

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

  async stopTracing(
    sessionId: string,
    path: string
  ): Promise<{ success: boolean; path: string }> {
    return this.tracingActions.stopTracing(sessionId, path);
  }

  async startTracingGroup(
    sessionId: string,
    name: string,
    options: {
      location?: { file: string; line?: number; column?: number };
    } = {}
  ): Promise<{ success: boolean; groupName: string }> {
    return this.tracingActions.startTracingGroup(sessionId, name, options);
  }

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

  // Clock Mocking

  async installClock(
    sessionId: string,
    pageId: string,
    options: { time?: number | string | Date } = {}
  ): Promise<{ success: boolean; installedTime?: string }> {
    return this.clockActions.installClock(sessionId, pageId, options);
  }

  async setFixedTime(
    sessionId: string,
    pageId: string,
    time: number | string | Date
  ): Promise<{ success: boolean; fixedTime: string }> {
    return this.clockActions.setFixedTime(sessionId, pageId, time);
  }

  async pauseClock(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean; pausedAt: string }> {
    return this.clockActions.pauseClock(sessionId, pageId);
  }

  async resumeClock(
    sessionId: string,
    pageId: string
  ): Promise<{ success: boolean }> {
    return this.clockActions.resumeClock(sessionId, pageId);
  }

  async runClockFor(
    sessionId: string,
    pageId: string,
    duration: number | string
  ): Promise<{ success: boolean; advancedBy: string }> {
    return this.clockActions.runClockFor(sessionId, pageId, duration);
  }

  async fastForwardClock(
    sessionId: string,
    pageId: string,
    ticks: number | string
  ): Promise<{ success: boolean; fastForwardedBy: string }> {
    return this.clockActions.fastForwardClock(sessionId, pageId, ticks);
  }

  async setSystemTime(
    sessionId: string,
    pageId: string,
    time: number | string | Date
  ): Promise<{ success: boolean; systemTime: string }> {
    return this.clockActions.setSystemTime(sessionId, pageId, time);
  }

  // HAR Mocking

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

  async unrouteAll(
    sessionId: string,
    pageId: string,
    options: { behavior?: 'wait' | 'ignoreErrors' | 'default' } = {}
  ): Promise<{ success: boolean }> {
    return this.networkActions.unrouteAll(sessionId, pageId, options);
  }

  // Role-based Locators

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

  async clickByText(
    sessionId: string,
    pageId: string,
    text: string,
    options: { exact?: boolean; force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.locatorActions.clickByText(sessionId, pageId, text, options);
  }

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

  // Advanced Features

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
