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
// Environment Parsing
// ============================================

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean =>
  value !== undefined ? value !== 'false' : fallback;

const parseBrowser = (value: string | undefined): BrowserType => {
  const valid = ['chromium', 'firefox', 'webkit'] as const;
  return valid.includes(value as BrowserType)
    ? (value as BrowserType)
    : 'chromium';
};

// ============================================
// Config Interface
// ============================================

export interface ServerConfig {
  // User-configurable (via env)
  readonly logLevel: string;
  readonly maxConcurrentSessions: number;
  readonly defaultBrowser: BrowserType;
  readonly headless: boolean;

  // Fixed defaults (internal)
  readonly sessionTimeout: number;
  readonly cleanupInterval: number;
  readonly defaultViewport: Viewport;
  readonly locale: string;
  readonly timezoneId: string;
  readonly ignoreHTTPSErrors: boolean;

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

  readonly screenshot: {
    readonly quality: number;
  };

  readonly video: {
    readonly directory: string;
  };
}

// ============================================
// Configuration Object
// ============================================

export const config: ServerConfig = {
  // User-configurable via environment
  logLevel: process.env.LOG_LEVEL ?? 'info',
  maxConcurrentSessions: parseNumber(process.env.MAX_SESSIONS, 5),
  defaultBrowser: parseBrowser(process.env.DEFAULT_BROWSER),
  headless: parseBoolean(process.env.HEADLESS, true),

  // Fixed internal defaults
  sessionTimeout: 30 * MINUTES,
  cleanupInterval: 1 * MINUTES,
  defaultViewport: { width: 1366, height: 900 },
  locale: 'en-US',
  timezoneId: 'UTC',
  ignoreHTTPSErrors: false,

  timeouts: {
    default: 30 * SECONDS,
    navigation: 30 * SECONDS,
    action: 5 * SECONDS,
    assertion: 5 * SECONDS,
  },

  limits: {
    maxScriptLength: 5000,
    maxLogFileSize: 10 * MB,
    maxErrorLogFileSize: 5 * MB,
    maxLogFiles: 10,
    maxFileSizeForUpload: 50 * MB,
    maxSessionsPerMinute: 10,
  },

  screenshot: {
    quality: 80,
  },

  video: {
    directory: './videos',
  },
} as const;

export default config;
