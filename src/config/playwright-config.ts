/**
 * Playwright-specific configuration
 *
 * Separates Playwright launch and context options from server configuration.
 * Based on MCP best practices for modular configuration.
 *
 * @see https://playwright.dev/docs/api/class-browsertype#browser-type-launch
 * @see https://playwright.dev/docs/api/class-browser#browser-new-context
 */
import type { BrowserContextOptions, LaunchOptions } from 'playwright';

import config from './server-config.js';

/**
 * Default browser launch options
 * These are applied when launching any browser instance
 */
export const launchOptions: LaunchOptions = {
  headless: config.headless,
  timeout: config.timeouts.default,
  // Slow down operations for debugging (set via SLOW_MO env var)
  slowMo: parseInt(process.env.SLOW_MO ?? '0', 10) || undefined,
};

/**
 * Default browser context options
 * Applied to each new browser context (page isolation)
 */
export const contextOptions: BrowserContextOptions = {
  viewport: config.defaultViewport,
  locale: config.locale,
  timezoneId: config.timezoneId,
  ignoreHTTPSErrors: config.ignoreHTTPSErrors,
  // Enable/disable JavaScript (useful for testing)
  javaScriptEnabled: true,
  // Bypass Content Security Policy for testing
  bypassCSP: false,
  // Geolocation (can be set per test)
  geolocation: undefined,
  // Permissions (can be granted per test)
  permissions: undefined,
  // Extra HTTP headers (can be set per test)
  extraHTTPHeaders: undefined,
  // User agent (can be set per test)
  userAgent: undefined,
  // Offline mode
  offline: false,
  // Color scheme preference
  colorScheme: 'light',
  // Reduced motion preference
  reducedMotion: 'no-preference',
  // Forced colors (high contrast mode)
  forcedColors: 'none',
};

/**
 * Video recording options
 */
export const videoOptions = {
  dir: config.video.directory,
  size: config.defaultViewport,
} as const;

/**
 * Screenshot options
 */
export const screenshotOptions = {
  quality: config.screenshot.quality,
  type: 'png' as const,
} as const;

/**
 * Timeout configurations for different operations
 */
export const timeoutOptions = {
  default: config.timeouts.default,
  navigation: config.timeouts.navigation,
  action: config.timeouts.action,
  assertion: config.timeouts.assertion,
} as const;

/**
 * Common viewport presets for responsive testing
 */
export const viewportPresets = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1366, height: 768 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
  mobileLandscape: { width: 667, height: 375 },
} as const;

/**
 * Browser channel options for Chromium
 */
export const browserChannels = {
  chrome: 'chrome',
  chromeBeta: 'chrome-beta',
  chromeDev: 'chrome-dev',
  chromeCanary: 'chrome-canary',
  msedge: 'msedge',
  msedgeBeta: 'msedge-beta',
  msedgeDev: 'msedge-dev',
  msedgeCanary: 'msedge-canary',
} as const;

export type BrowserChannel =
  (typeof browserChannels)[keyof typeof browserChannels];

export default {
  launchOptions,
  contextOptions,
  videoOptions,
  screenshotOptions,
  timeoutOptions,
  viewportPresets,
  browserChannels,
};
