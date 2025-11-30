/**
 * Server Configuration Module
 *
 * Centralized configuration management with:
 * - Environment variable parsing with validation and bounds checking
 * - Type-safe defaults following Playwright best practices
 * - Runtime configuration freeze (immutable after startup)
 * - Sensible limits for security and resource management
 *
 * **Environment Variables:**
 * - `LOG_LEVEL` - Logging verbosity (error, warn, info, debug)
 * - `MAX_SESSIONS` - Maximum concurrent browser sessions (1-20)
 * - `DEFAULT_BROWSER` - Browser engine (chromium, firefox, webkit)
 * - `HEADLESS` - Run browsers headless (true/false)
 * - `VIEWPORT_WIDTH/HEIGHT` - Default viewport dimensions
 * - `SESSION_TIMEOUT` - Session inactivity timeout in ms
 * - `TIMEOUT_*` - Various operation timeouts
 *
 * **Playwright Best Practice Alignment:**
 * - Action timeout (5s): Matches Playwright's default for element actions
 * - Navigation timeout (30s): Allows for slow page loads
 * - Assertion timeout (5s): Matches Playwright Test defaults
 * - Session timeout (30min): Reasonable inactivity threshold
 *
 * **Security Considerations:**
 * - Max script length prevents injection attacks
 * - Session rate limiting prevents resource exhaustion
 * - File size limits prevent memory issues
 *
 * @see https://playwright.dev/docs/api/class-browsertype#browser-type-launch
 * @see https://playwright.dev/docs/test-timeouts
 */
import dotenv from 'dotenv';

import type { BrowserType, Viewport } from '../types/index.js';

dotenv.config();

// ============================================
// Constants
// ============================================

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;
const MB = 1024 * 1024;

// ============================================
// Environment Parsing Utilities
// ============================================

/**
 * Parse a numeric environment variable with bounds checking.
 * Returns fallback if value is undefined, not a number, or out of bounds.
 *
 * @param value - Environment variable value (may be undefined)
 * @param fallback - Default value if parsing fails
 * @param options - Optional min/max bounds
 * @returns Parsed number within bounds, or fallback
 */
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

/**
 * Parse a boolean environment variable.
 * Supports multiple formats: 'true', 'false', '1', '0', 'yes', 'no'
 *
 * @param value - Environment variable value
 * @param fallback - Default value if parsing fails
 * @returns Parsed boolean or fallback
 */
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

/**
 * Parse browser type with validation.
 * Only accepts valid Playwright browser types.
 *
 * @param value - Environment variable value
 * @returns Valid browser type or 'chromium' default
 */
const parseBrowser = (value: string | undefined): BrowserType => {
  const valid: readonly BrowserType[] = ['chromium', 'firefox', 'webkit'];
  const lower = value?.toLowerCase().trim();
  if (lower && valid.includes(lower as BrowserType)) {
    return lower as BrowserType;
  }
  return 'chromium';
};

/**
 * Parse log level with validation.
 * Only accepts valid Winston log levels.
 *
 * @param value - Environment variable value
 * @returns Valid log level or 'info' default
 */
const parseLogLevel = (value: string | undefined): string => {
  const valid = ['error', 'warn', 'info', 'debug', 'verbose'];
  const lower = value?.toLowerCase().trim();
  if (lower && valid.includes(lower)) {
    return lower;
  }
  return 'info';
};

/**
 * Parse viewport dimensions from environment.
 * Validates dimensions are within reasonable bounds.
 *
 * @param widthEnv - Width environment variable
 * @param heightEnv - Height environment variable
 * @param fallback - Default viewport if parsing fails
 * @returns Validated viewport dimensions
 */
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

// ============================================
// Config Interface
// ============================================

/**
 * Server configuration interface.
 * All properties are readonly to prevent runtime modifications.
 *
 * **Configuration Layers:**
 * 1. Environment variables (highest priority)
 * 2. Default values (defined here)
 *
 * **Timeout Guidelines (Playwright Best Practices):**
 * - Action timeout (5s): Element interactions (click, fill, hover)
 * - Assertion timeout (5s): Web-first assertions with auto-retry
 * - Navigation timeout (30s): Page loads and navigation
 * - Download timeout (60s): File downloads
 *
 * **Viewport Guidelines:**
 * - Default 1366x900: Common desktop resolution
 * - Min 320x240: Mobile minimum
 * - Max 3840x2160: 4K maximum
 *
 * @see https://playwright.dev/docs/test-timeouts
 * @see https://playwright.dev/docs/emulation#viewport
 */
export interface ServerConfig {
  // ============================================
  // User-Configurable (via environment variables)
  // ============================================

  /**
   * Logging level: error, warn, info, debug, verbose
   * @env LOG_LEVEL
   * @default 'info'
   */
  readonly logLevel: string;

  /**
   * Maximum concurrent browser sessions.
   * Prevents resource exhaustion on the host machine.
   * @env MAX_SESSIONS
   * @default 5
   * @min 1
   * @max 20
   */
  readonly maxConcurrentSessions: number;

  /**
   * Default browser engine for new sessions.
   * @env DEFAULT_BROWSER
   * @default 'chromium'
   */
  readonly defaultBrowser: BrowserType;

  /**
   * Run browsers in headless mode.
   * Set to false for debugging or visual verification.
   * @env HEADLESS
   * @default true
   */
  readonly headless: boolean;

  /**
   * Default viewport dimensions for new pages.
   * @env VIEWPORT_WIDTH, VIEWPORT_HEIGHT
   * @default { width: 1366, height: 900 }
   */
  readonly defaultViewport: Viewport;

  // ============================================
  // Internal Defaults (not user-configurable)
  // ============================================

  /** Session timeout in milliseconds (30 minutes) */
  readonly sessionTimeout: number;

  /** Cleanup interval in milliseconds (1 minute) */
  readonly cleanupInterval: number;

  /** Locale for consistent behavior */
  readonly locale: string;

  /** Timezone for consistent behavior */
  readonly timezoneId: string;

  /** Ignore HTTPS errors */
  readonly ignoreHTTPSErrors: boolean;

  /** Timeout configurations */
  readonly timeouts: {
    /** Default timeout for operations (30s) */
    readonly default: number;
    /** Navigation timeout (30s) */
    readonly navigation: number;
    /** Element action timeout (5s) */
    readonly action: number;
    /** Assertion timeout (5s) */
    readonly assertion: number;
    /** Download timeout (60s) */
    readonly download: number;
  };

  /** Security and resource limits */
  readonly limits: {
    /** Maximum script length for evaluate (5000 chars) */
    readonly maxScriptLength: number;
    /** Maximum log file size (10MB) */
    readonly maxLogFileSize: number;
    /** Maximum error log file size (5MB) */
    readonly maxErrorLogFileSize: number;
    /** Maximum number of log files to keep */
    readonly maxLogFiles: number;
    /** Maximum file size for uploads (50MB) */
    readonly maxFileSizeForUpload: number;
    /** Maximum sessions per minute (rate limiting) */
    readonly maxSessionsPerMinute: number;
    /** Maximum response body size for network mocking (50MB) */
    readonly maxResponseBodySize: number;
  };

  /** Screenshot defaults */
  readonly screenshot: {
    /** Default JPEG quality (0-100) */
    readonly quality: number;
    /** Default screenshot type */
    readonly type: 'png' | 'jpeg';
  };

  /** Video recording settings */
  readonly video: {
    /** Directory for video recordings */
    readonly directory: string;
  };

  /** Accessibility scanning defaults */
  readonly accessibility: {
    /** Default WCAG tags for a11y scans */
    readonly defaultTags: readonly string[];
  };

  /** Test ID attribute name */
  readonly testIdAttribute: string;
}

// ============================================
// Configuration Object
// ============================================

/**
 * Frozen configuration object.
 * Environment variables are parsed at startup.
 */
export const config: ServerConfig = Object.freeze({
  // ============================================
  // User-Configurable via Environment Variables
  // ============================================

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

  // ============================================
  // Internal Defaults
  // ============================================

  sessionTimeout: parseNumber(process.env.SESSION_TIMEOUT, 30 * MINUTES, {
    min: 1 * MINUTES,
    max: 120 * MINUTES,
  }),

  cleanupInterval: 1 * MINUTES,

  locale: process.env.LOCALE ?? 'en-US',

  timezoneId: process.env.TIMEZONE ?? 'UTC',

  ignoreHTTPSErrors: parseBoolean(process.env.IGNORE_HTTPS_ERRORS, false),

  timeouts: Object.freeze({
    default: parseNumber(process.env.TIMEOUT_DEFAULT, 30 * SECONDS, {
      min: 5 * SECONDS,
      max: 120 * SECONDS,
    }),
    navigation: parseNumber(process.env.TIMEOUT_NAVIGATION, 30 * SECONDS, {
      min: 5 * SECONDS,
      max: 120 * SECONDS,
    }),
    action: parseNumber(process.env.TIMEOUT_ACTION, 5 * SECONDS, {
      min: 1 * SECONDS,
      max: 60 * SECONDS,
    }),
    assertion: parseNumber(process.env.TIMEOUT_ASSERTION, 5 * SECONDS, {
      min: 1 * SECONDS,
      max: 60 * SECONDS,
    }),
    download: parseNumber(process.env.TIMEOUT_DOWNLOAD, 60 * SECONDS, {
      min: 10 * SECONDS,
      max: 300 * SECONDS,
    }),
  }),

  limits: Object.freeze({
    maxScriptLength: 5000,
    maxLogFileSize: 10 * MB,
    maxErrorLogFileSize: 5 * MB,
    maxLogFiles: 10,
    maxFileSizeForUpload: 50 * MB,
    maxSessionsPerMinute: parseNumber(process.env.MAX_SESSIONS_PER_MINUTE, 10, {
      min: 1,
      max: 60,
    }),
    maxResponseBodySize: 50 * MB,
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
