import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: isCI ? '50%' : '75%',
  forbidOnly: isCI,
  failOnFlakyTests: isCI,
  retries: isCI ? 2 : 0,
  outputDir: 'test-results',
  preserveOutput: 'failures-only',
  maxFailures: isCI ? 10 : 5,
  globalTimeout: 30 * 60 * 1000,
  timeout: 45_000,
  reportSlowTests: { max: 5, threshold: 15_000 },
  reporter: [
    ['html', { outputFolder: './reports', open: isCI ? 'never' : 'on-failure' }],
    ['json', { outputFile: './reports/results.json' }],
    ['list', { printSteps: true }],
    ...(isCI ? [['github'] as const] : []),
  ],
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { maxDiffPixels: 100, animations: 'disabled' },
    toMatchSnapshot: { maxDiffPixelRatio: 0.1 },
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 20_000,
    actionTimeout: 10_000,
    testIdAttribute: 'data-testid',
    locale: 'en-US',
    timezoneId: 'UTC',
    viewport: { width: 1366, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], navigationTimeout: 30_000 },
      timeout: 50_000,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
