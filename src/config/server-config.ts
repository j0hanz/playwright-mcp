import dotenv from 'dotenv';

import type { BrowserType, Viewport } from '../types/index.js';
import { Logger } from '../utils/logger.js';

dotenv.config();

// Logger for configuration warnings
const configLogger = new Logger('ServerConfig');

// Named constants for magic numbers (in milliseconds)
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * BYTES_PER_KB;

// Default configuration values
const DEFAULTS = {
  // Session management
  MAX_SESSIONS: 5,
  SESSION_TIMEOUT_MS: 30 * MILLISECONDS_PER_MINUTE, // 30 minutes
  CLEANUP_INTERVAL_MS: 1 * MILLISECONDS_PER_MINUTE, // 1 minute
  MAX_SESSIONS_PER_MINUTE: 10,
  RETRY_ATTEMPTS: 3,
  
  // Viewport
  VIEWPORT_WIDTH: 1366,
  VIEWPORT_HEIGHT: 900,
  
  // Timeouts
  TIMEOUT_DEFAULT_MS: 30 * MILLISECONDS_PER_SECOND, // 30 seconds
  TIMEOUT_NAVIGATION_MS: 30 * MILLISECONDS_PER_SECOND, // 30 seconds
  TIMEOUT_ACTION_MS: 5 * MILLISECONDS_PER_SECOND, // 5 seconds
  TIMEOUT_ASSERTION_MS: 5 * MILLISECONDS_PER_SECOND, // 5 seconds
  
  // Limits
  MAX_SCRIPT_LENGTH: 5000,
  MAX_LOG_FILE_SIZE: 10 * BYTES_PER_MB, // 10 MB
  MAX_ERROR_LOG_FILE_SIZE: 5 * BYTES_PER_MB, // 5 MB
  MAX_LOG_FILES: 10,
  MAX_FILE_SIZE_FOR_UPLOAD: 50 * BYTES_PER_MB, // 50 MB
  
  // Screenshot
  SCREENSHOT_QUALITY: 80,
} as const;

// Parse environment variable helpers
const parseNumber = (
  envVar: string,
  value: string | undefined,
  defaultValue: number
): number => {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    configLogger.warn(
      `Invalid number for env var ${envVar}="${value}", using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return parsed;
};

const parseBoolean = (
  value: string | undefined,
  defaultValue: boolean
): boolean => (value !== undefined ? value !== 'false' : defaultValue);

// Browser type validation
const VALID_BROWSERS = ['chromium', 'firefox', 'webkit'] as const;

function getDefaultBrowser(): BrowserType {
  const envBrowser = process.env.DEFAULT_BROWSER;
  if (envBrowser && VALID_BROWSERS.includes(envBrowser as BrowserType)) {
    return envBrowser as BrowserType;
  }
  return 'chromium';
}

// Config shape for type inference
export interface ServerConfig {
  readonly logLevel: string;
  readonly maxConcurrentSessions: number;
  readonly sessionTimeout: number;
  readonly retryAttempts: number;
  readonly defaultBrowser: BrowserType;
  readonly headless: boolean;
  readonly ignoreHTTPSErrors: boolean;
  readonly cleanupInterval: number;
  readonly defaultViewport: Viewport;
  // Locale and timezone for consistent behavior across runs
  readonly locale: string;
  readonly timezoneId: string;
  readonly screenshot: {
    readonly enabled: boolean;
    readonly quality: number;
    readonly fullPage: boolean;
    readonly directory: string;
  };
  readonly timeouts: {
    readonly default: number;
    readonly navigation: number;
    readonly action: number;
    readonly assertion: number;
  };
  readonly limits: {
    readonly maxScriptLength: number;
    readonly maxLogFileSize: number;
    readonly maxErrorLogFileSize: number;
    readonly maxLogFiles: number;
    readonly maxFileSizeForUpload: number;
    readonly maxSessionsPerMinute: number;
  };
  // Video recording configuration
  readonly video: {
    readonly enabled: boolean;
    readonly directory: string;
  };
}

// Note: This server uses stdio transport for MCP communication
export const config: ServerConfig = {
  logLevel: process.env.LOG_LEVEL ?? 'info',
  maxConcurrentSessions: parseNumber('MAX_SESSIONS', process.env.MAX_SESSIONS, DEFAULTS.MAX_SESSIONS),
  sessionTimeout: parseNumber('SESSION_TIMEOUT', process.env.SESSION_TIMEOUT, DEFAULTS.SESSION_TIMEOUT_MS),
  retryAttempts: parseNumber('RETRY_ATTEMPTS', process.env.RETRY_ATTEMPTS, DEFAULTS.RETRY_ATTEMPTS),
  defaultBrowser: getDefaultBrowser(),
  headless: parseBoolean(process.env.HEADLESS, true),
  ignoreHTTPSErrors: parseBoolean(process.env.IGNORE_HTTPS_ERRORS, false),
  cleanupInterval: parseNumber('CLEANUP_INTERVAL', process.env.CLEANUP_INTERVAL, DEFAULTS.CLEANUP_INTERVAL_MS),
  defaultViewport: {
    width: parseNumber('VIEWPORT_WIDTH', process.env.VIEWPORT_WIDTH, DEFAULTS.VIEWPORT_WIDTH),
    height: parseNumber('VIEWPORT_HEIGHT', process.env.VIEWPORT_HEIGHT, DEFAULTS.VIEWPORT_HEIGHT),
  },
  // Locale and timezone for consistent behavior across runs
  locale: process.env.BROWSER_LOCALE ?? 'en-US',
  timezoneId: process.env.BROWSER_TIMEZONE ?? 'UTC',
  screenshot: {
    enabled: parseBoolean(process.env.SCREENSHOTS_ENABLED, true),
    quality: parseNumber('SCREENSHOT_QUALITY', process.env.SCREENSHOT_QUALITY, DEFAULTS.SCREENSHOT_QUALITY),
    fullPage: parseBoolean(process.env.SCREENSHOT_FULL_PAGE, false),
    directory: process.env.SCREENSHOT_DIR ?? './screenshots',
  },
  timeouts: {
    default: parseNumber('TIMEOUT_DEFAULT', process.env.TIMEOUT_DEFAULT, DEFAULTS.TIMEOUT_DEFAULT_MS),
    navigation: parseNumber('TIMEOUT_NAVIGATION', process.env.TIMEOUT_NAVIGATION, DEFAULTS.TIMEOUT_NAVIGATION_MS),
    action: parseNumber('TIMEOUT_ACTION', process.env.TIMEOUT_ACTION, DEFAULTS.TIMEOUT_ACTION_MS),
    assertion: parseNumber('TIMEOUT_ASSERTION', process.env.TIMEOUT_ASSERTION, DEFAULTS.TIMEOUT_ASSERTION_MS),
  },
  limits: {
    maxScriptLength: parseNumber('MAX_SCRIPT_LENGTH', process.env.MAX_SCRIPT_LENGTH, DEFAULTS.MAX_SCRIPT_LENGTH),
    maxLogFileSize: parseNumber(
      'MAX_LOG_FILE_SIZE',
      process.env.MAX_LOG_FILE_SIZE,
      DEFAULTS.MAX_LOG_FILE_SIZE
    ),
    maxErrorLogFileSize: parseNumber(
      'MAX_ERROR_LOG_FILE_SIZE',
      process.env.MAX_ERROR_LOG_FILE_SIZE,
      DEFAULTS.MAX_ERROR_LOG_FILE_SIZE
    ),
    maxLogFiles: parseNumber('MAX_LOG_FILES', process.env.MAX_LOG_FILES, DEFAULTS.MAX_LOG_FILES),
    maxFileSizeForUpload: parseNumber(
      'MAX_FILE_SIZE_FOR_UPLOAD',
      process.env.MAX_FILE_SIZE_FOR_UPLOAD,
      DEFAULTS.MAX_FILE_SIZE_FOR_UPLOAD
    ),
    maxSessionsPerMinute: parseNumber('MAX_SESSIONS_PER_MINUTE', process.env.MAX_SESSIONS_PER_MINUTE, DEFAULTS.MAX_SESSIONS_PER_MINUTE),
  },
  // Video recording configuration
  video: {
    enabled: parseBoolean(process.env.VIDEO_ENABLED, true),
    directory: process.env.VIDEO_DIR ?? './videos',
  },
} as const;

export default config;
