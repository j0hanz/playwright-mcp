/**
 * Browser Manager - Core browser automation for MCP Playwright Server
 *
 * @see https://playwright.dev/docs/locators
 * @see https://playwright.dev/docs/test-assertions
 * @see https://playwright.dev/docs/browser-contexts
 */
/**
 * Browser Manager - Core browser automation for MCP Playwright Server
 *
 * @see https://playwright.dev/docs/locators
 * @see https://playwright.dev/docs/test-assertions
 * @see https://playwright.dev/docs/browser-contexts
 */
import { promises as fs } from 'fs';
import path from 'path';
import {
  Browser,
  LaunchOptions,
  Page,
  chromium,
  firefox,
  webkit,
} from 'playwright';

import config from '../config/server-config.js';
import type { BrowserLaunchOptions, BrowserType } from '../config/types.js';
import { consoleCaptureService } from '../server/handlers/advanced-tools.js';
import {
  ErrorCode,
  ErrorHandler,
  isMCPPlaywrightError,
  toError,
} from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';
import { AssertionActions } from './actions/assertion-actions.js';
import { InteractionActions } from './actions/interaction-actions.js';
import { NavigationActions } from './actions/navigation-actions.js';
import { NetworkActions } from './actions/network-actions.js';
import { PageOperations } from './actions/page-operations.js';
import { TracingActions } from './actions/tracing-actions.js';
import { DialogManager } from './dialog-manager.js';
import { SessionManager } from './session-manager.js';

export type { BrowserLaunchOptions };

const BROWSER_LAUNCHERS: Readonly<
  Record<BrowserType, (options?: LaunchOptions) => Promise<Browser>>
> = {
  chromium: chromium.launch.bind(chromium),
  firefox: firefox.launch.bind(firefox),
  webkit: webkit.launch.bind(webkit),
};

function isPathWithinDirectory(filePath: string, allowedDir: string): boolean {
  const normalizedAllowed = path.normalize(allowedDir);
  const normalizedPath = path.normalize(filePath);
  const relative = path.relative(normalizedAllowed, normalizedPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function validateOutputPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const videoRoot = path.resolve(process.cwd(), config.video.directory);

  if (!isPathWithinDirectory(resolved, videoRoot)) {
    throw ErrorHandler.createError(
      ErrorCode.VALIDATION_FAILED,
      `Output path must be within the video directory: ${config.video.directory}`
    );
  }
  return resolved;
}

export class BrowserManager {
  private readonly sessionManager: SessionManager;
  private readonly dialogManager: DialogManager;
  private readonly logger = new Logger('BrowserManager');

  // Action modules - consolidated for cleaner API
  public readonly assertionActions: AssertionActions;
  public readonly interactionActions: InteractionActions;
  public readonly navigationActions: NavigationActions;
  public readonly networkActions: NetworkActions;
  public readonly pageOperations: PageOperations;
  public readonly tracingActions: TracingActions;

  constructor() {
    this.sessionManager = new SessionManager(new Logger('SessionManager'));
    this.dialogManager = new DialogManager(new Logger('DialogManager'));

    // Initialize action modules with shared dependencies
    this.assertionActions = new AssertionActions(
      this.sessionManager,
      this.logger
    );
    this.interactionActions = new InteractionActions(
      this.sessionManager,
      this.logger
    );
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

    const {
      browserType = config.defaultBrowser,
      headless = config.headless,
      viewport = config.defaultViewport,
      userAgent,
      channel,
      slowMo,
      proxy,
      timeout,
      recordVideo,
      storageState,
    } = options;

    try {
      const launcher = BROWSER_LAUNCHERS[browserType];
      const launchOptions: LaunchOptions = {
        headless,
      };

      if (typeof timeout === 'number') {
        launchOptions.timeout = timeout;
      }

      if (typeof slowMo === 'number') {
        launchOptions.slowMo = slowMo;
      }

      if (proxy) {
        launchOptions.proxy = proxy;
      }

      if (channel) {
        if (browserType === 'chromium') {
          launchOptions.channel = channel;
        } else {
          this.logger.warn('Channel option ignored for non-Chromium browsers', {
            browserType,
            channel,
          });
        }
      }

      const browser = await launcher(launchOptions);

      const contextOptions: Parameters<Browser['newContext']>[0] = {
        viewport,
        ignoreHTTPSErrors: config.ignoreHTTPSErrors,
        locale: config.locale,
        timezoneId: config.timezoneId,
      };

      if (userAgent) {
        contextOptions.userAgent = userAgent;
      }

      if (storageState) {
        contextOptions.storageState = storageState;
      }

      if (recordVideo) {
        const videoDir = validateOutputPath(recordVideo.dir);
        await fs.mkdir(videoDir, { recursive: true });
        contextOptions.recordVideo = {
          dir: videoDir,
          size: recordVideo.size,
        };
      }

      const context = await browser.newContext(contextOptions);

      const sessionId = this.sessionManager.createSession({
        browser,
        context,
        browserType,
        headless,
        viewport: options.viewport,
      });

      return {
        sessionId,
        browserType,
        recordingVideo: !!contextOptions.recordVideo,
      };
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

  async closeBrowser(sessionId: string): Promise<{ success: boolean }> {
    // Clean up dialogs, routes, and console listeners for all pages in the session
    if (this.sessionManager.hasSession(sessionId)) {
      const pageIds = this.sessionManager.getPageIds(sessionId);
      this.dialogManager.cleanupSession(sessionId, pageIds);
      consoleCaptureService.cleanupSession(sessionId);
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
      (sessionId, session) => {
        const pageIds = Array.from(session.pages.keys());
        this.dialogManager.cleanupSession(sessionId, pageIds);
        return Promise.resolve();
      }
    );
  }

  listSessions() {
    return this.sessionManager.listSessions();
  }

  getServerStatus() {
    return this.sessionManager.getStatus();
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
      if (
        isMCPPlaywrightError(error) &&
        error.code === ErrorCode.DIALOG_ERROR
      ) {
        throw ErrorHandler.createError(ErrorCode.INTERNAL_ERROR, error.message);
      }
      const err = toError(error);
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
}
