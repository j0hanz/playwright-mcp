/**
 * Browser Manager - Core browser automation for MCP Playwright Server
 *
 * @see https://playwright.dev/docs/locators
 * @see https://playwright.dev/docs/test-assertions
 * @see https://playwright.dev/docs/browser-contexts
 */
import { Page } from 'playwright';

import config from '../config/server-config.js';
import { BrowserType, Viewport } from '../types/index.js';
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
  public readonly assertionActions: AssertionActions;
  public readonly clockActions: ClockActions;
  public readonly interactionActions: InteractionActions;
  public readonly locatorActions: LocatorActions;
  public readonly navigationActions: NavigationActions;
  public readonly networkActions: NetworkActions;
  public readonly pageOperations: PageOperations;
  public readonly tracingActions: TracingActions;

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

  // Dialogs

  async handleDialog(
    sessionId: string,
    pageId: string,
    accept: boolean,
    promptText?: string
  ): Promise<{ success: boolean; dialogType?: string; message?: string }> {
    const NO_PENDING_DIALOG_MSG = 'No pending dialog found for this page';

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
      if (err.message === NO_PENDING_DIALOG_MSG) {
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

  getPageForTool(sessionId: string, pageId: string): Page {
    return this.sessionManager.getPage(sessionId, pageId);
  }

  markSessionActive(sessionId: string): void {
    this.sessionManager.updateActivity(sessionId);
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
}
