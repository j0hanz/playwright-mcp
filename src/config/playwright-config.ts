/**
 * Playwright-specific configuration
 *
 * @see https://playwright.dev/docs/api/class-browsertype#browser-type-launch
 * @see https://playwright.dev/docs/api/class-browser#browser-new-context
 */
import type { BrowserContextOptions, LaunchOptions } from 'playwright';

import config from './server-config.js';

export const launchOptions: LaunchOptions = {
  headless: config.headless,
  timeout: config.timeouts.default,
  slowMo: parseInt(process.env.SLOW_MO ?? '0', 10) || undefined,
};

export const contextOptions: BrowserContextOptions = {
  viewport: config.defaultViewport,
  locale: config.locale,
  timezoneId: config.timezoneId,
  ignoreHTTPSErrors: config.ignoreHTTPSErrors,
  javaScriptEnabled: true,
  bypassCSP: false,
  geolocation: undefined,
  permissions: undefined,
  extraHTTPHeaders: undefined,
  userAgent: undefined,
  offline: false,
  colorScheme: 'light',
  reducedMotion: 'no-preference',
  forcedColors: 'none',
};

export const videoOptions = {
  dir: config.video.directory,
  size: config.defaultViewport,
} as const;

export const screenshotOptions = {
  quality: config.screenshot.quality,
  type: 'png' as const,
} as const;

export const timeoutOptions = {
  default: config.timeouts.default,
  navigation: config.timeouts.navigation,
  action: config.timeouts.action,
  assertion: config.timeouts.assertion,
} as const;

export const viewportPresets = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1366, height: 768 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
  mobileLandscape: { width: 667, height: 375 },
} as const;

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
