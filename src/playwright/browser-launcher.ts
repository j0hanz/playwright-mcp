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
import { BrowserType, Viewport } from '../types/index.js';
import { ErrorCode, ErrorHandler, toError } from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('BrowserLauncher');

/**
 * Browser launcher map for type-safe browser instantiation.
 */
const BROWSER_LAUNCHERS: Readonly<
  Record<BrowserType, (options?: LaunchOptions) => Promise<Browser>>
> = {
  chromium: chromium.launch.bind(chromium),
  firefox: firefox.launch.bind(firefox),
  webkit: webkit.launch.bind(webkit),
};

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

/**
 * Validates that a file path is within the allowed output directory.
 */
function validateOutputPath(filePath: string): string {
  // This should ideally be in a shared utility or config
  const ALLOWED_LOG_OUTPUT_DIR = path.resolve(process.cwd(), 'logs');
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
