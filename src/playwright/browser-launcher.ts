/**
 * Browser Launcher - Launches Playwright browser instances
 */
import { promises as fs } from 'fs';
import path from 'path';
import {
  Browser,
  chromium,
  firefox,
  webkit,
  LaunchOptions,
  BrowserContext,
} from 'playwright';

import config from '../config/server-config.js';
import type { BrowserLaunchOptions, BrowserType } from '../config/types.js';
import { ErrorCode, ErrorHandler, toError } from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';

export type { BrowserLaunchOptions };

const logger = new Logger('BrowserLauncher');

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
  const projectRoot = process.cwd();

  if (!isPathWithinDirectory(resolved, projectRoot)) {
    throw ErrorHandler.createError(
      ErrorCode.VALIDATION_FAILED,
      `Output path must be within the project directory: ${filePath}`
    );
  }
  return resolved;
}

export async function launch(options: BrowserLaunchOptions = {}): Promise<{
  browser: Browser;
  context: BrowserContext;
  browserType: BrowserType;
  headless: boolean;
  recordingVideo: boolean;
}> {
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
        logger.warn('Channel option ignored for non-Chromium browsers', {
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

    return {
      browser,
      context,
      browserType,
      headless,
      recordingVideo: !!contextOptions.recordVideo,
    };
  } catch (error) {
    const err = toError(error);
    logger.error('Failed to launch browser', {
      error: err.message,
    });
    throw ErrorHandler.createError(
      ErrorCode.BROWSER_LAUNCH_FAILED,
      `Browser launch failed: ${err.message}`
    );
  }
}
