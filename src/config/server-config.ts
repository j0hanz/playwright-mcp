/**
 * Server Configuration Module
 *
 * Centralized configuration with environment variable parsing.
 *
 * @see https://playwright.dev/docs/api/class-browsertype#browser-type-launch
 * @see https://playwright.dev/docs/test-timeouts
 */
import dotenv from 'dotenv';

import type { BrowserType, Viewport } from '../types/index.js';

dotenv.config();

// Time and size unit constants
const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const BYTES_PER_MB = 1024 * 1024;

const parseNumber = (
  value: string | undefined,
  fallback: number,
  options?: { min?: number; max?: number }
): number => {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return fallback;
  if (options?.min !== undefined && parsed < options.min) return options.min;
  if (options?.max !== undefined && parsed > options.max) return options.max;
  return parsed;
};

const parseBoolean = (
  value: string | undefined,
  fallback: boolean
): boolean => {
  if (value === undefined) return fallback;
  const lower = value.toLowerCase().trim();
  if (['true', '1', 'yes', 'on'].includes(lower)) return true;
  if (['false', '0', 'no', 'off'].includes(lower)) return false;
  return fallback;
};

const parseBrowser = (value: string | undefined): BrowserType => {
  const valid: readonly BrowserType[] = ['chromium', 'firefox', 'webkit'];
  const lower = value?.toLowerCase().trim();
  if (lower && valid.includes(lower as BrowserType)) {
    return lower as BrowserType;
  }
  return 'chromium';
};

const parseLogLevel = (value: string | undefined): string => {
  const valid = ['error', 'warn', 'info', 'debug', 'verbose'];
  const lower = value?.toLowerCase().trim();
  if (lower && valid.includes(lower)) return lower;
  return 'info';
};

const parseViewport = (
  widthEnv: string | undefined,
  heightEnv: string | undefined,
  fallback: Viewport
): Viewport => {
  const width = parseNumber(widthEnv, fallback.width, { min: 320, max: 3840 });
  const height = parseNumber(heightEnv, fallback.height, {
    min: 240,
    max: 2160,
  });
  return { width, height };
};

export interface ServerConfig {
  readonly logLevel: string;
  readonly maxConcurrentSessions: number;
  readonly defaultBrowser: BrowserType;
  readonly headless: boolean;
  readonly defaultViewport: Viewport;
  readonly sessionTimeout: number;
  readonly cleanupInterval: number;
  readonly locale: string;
  readonly timezoneId: string;
  readonly ignoreHTTPSErrors: boolean;
  readonly timeouts: {
    readonly default: number;
    readonly navigation: number;
    readonly action: number;
    readonly assertion: number;
    readonly download: number;
  };
  readonly limits: {
    readonly maxScriptLength: number;
    readonly maxLogFileSize: number;
    readonly maxErrorLogFileSize: number;
    readonly maxLogFiles: number;
    readonly maxFileSizeForUpload: number;
    readonly maxSessionsPerMinute: number;
    readonly maxResponseBodySize: number;
  };
  readonly screenshot: {
    readonly quality: number;
    readonly type: 'png' | 'jpeg';
  };
  readonly video: {
    readonly directory: string;
  };
  readonly accessibility: {
    readonly defaultTags: readonly string[];
  };
  readonly testIdAttribute: string;
}

export const config: ServerConfig = Object.freeze({
  logLevel: parseLogLevel(process.env.LOG_LEVEL),
  maxConcurrentSessions: parseNumber(process.env.MAX_SESSIONS, 5, {
    min: 1,
    max: 20,
  }),
  defaultBrowser: parseBrowser(process.env.DEFAULT_BROWSER),
  headless: parseBoolean(process.env.HEADLESS, true),
  defaultViewport: parseViewport(
    process.env.VIEWPORT_WIDTH,
    process.env.VIEWPORT_HEIGHT,
    { width: 1366, height: 900 }
  ),
  sessionTimeout: parseNumber(process.env.SESSION_TIMEOUT, 30 * MS_PER_MINUTE, {
    min: 1 * MS_PER_MINUTE,
    max: 120 * MS_PER_MINUTE,
  }),
  cleanupInterval: 1 * MS_PER_MINUTE,
  locale: process.env.LOCALE ?? 'en-US',
  timezoneId: process.env.TIMEZONE ?? 'UTC',
  ignoreHTTPSErrors: parseBoolean(process.env.IGNORE_HTTPS_ERRORS, false),
  timeouts: Object.freeze({
    default: parseNumber(process.env.TIMEOUT_DEFAULT, 30 * MS_PER_SECOND, {
      min: 5 * MS_PER_SECOND,
      max: 120 * MS_PER_SECOND,
    }),
    navigation: parseNumber(
      process.env.TIMEOUT_NAVIGATION,
      30 * MS_PER_SECOND,
      {
        min: 5 * MS_PER_SECOND,
        max: 120 * MS_PER_SECOND,
      }
    ),
    action: parseNumber(process.env.TIMEOUT_ACTION, 5 * MS_PER_SECOND, {
      min: 1 * MS_PER_SECOND,
      max: 60 * MS_PER_SECOND,
    }),
    assertion: parseNumber(process.env.TIMEOUT_ASSERTION, 5 * MS_PER_SECOND, {
      min: 1 * MS_PER_SECOND,
      max: 60 * MS_PER_SECOND,
    }),
    download: parseNumber(process.env.TIMEOUT_DOWNLOAD, 60 * MS_PER_SECOND, {
      min: 10 * MS_PER_SECOND,
      max: 300 * MS_PER_SECOND,
    }),
  }),
  limits: Object.freeze({
    maxScriptLength: 5_000,
    maxLogFileSize: 10 * BYTES_PER_MB,
    maxErrorLogFileSize: 5 * BYTES_PER_MB,
    maxLogFiles: 10,
    maxFileSizeForUpload: 50 * BYTES_PER_MB,
    maxSessionsPerMinute: parseNumber(process.env.MAX_SESSIONS_PER_MINUTE, 10, {
      min: 1,
      max: 60,
    }),
    maxResponseBodySize: 50 * BYTES_PER_MB,
  }),
  screenshot: Object.freeze({
    quality: parseNumber(process.env.SCREENSHOT_QUALITY, 80, {
      min: 0,
      max: 100,
    }),
    type: 'png' as const,
  }),
  video: Object.freeze({
    directory: process.env.VIDEO_DIR ?? './videos',
  }),
  accessibility: Object.freeze({
    defaultTags: ['wcag2a', 'wcag2aa', 'wcag21aa'] as readonly string[],
  }),
  testIdAttribute: process.env.TEST_ID_ATTRIBUTE ?? 'data-testid',
});

export default config;
