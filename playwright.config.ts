import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? '50%' : undefined,
  outputDir: 'test-results',
  maxFailures: process.env.CI ? 10 : undefined,
  globalTimeout: process.env.CI ? 60 * 60 * 1000 : undefined,
  timeout: 30000,

  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { outputFolder: './reports', open: 'never' }],
        ['json', { outputFile: './reports/results.json' }],
      ]
    : [
        ['html', { outputFolder: './reports', open: 'on-failure' }],
        ['json', { outputFile: './reports/results.json' }],
        ['list'],
      ],

  expect: {
    timeout: 5000,
    toHaveScreenshot: { maxDiffPixels: 100, animations: 'disabled' },
    toMatchSnapshot: { maxDiffPixelRatio: 0.1 },
  },

  use: {
    baseURL: process.env.PORTFOLIO_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 30000,
    actionTimeout: 20000,
    testIdAttribute: 'data-testid',
    locale: 'en-US',
    timezoneId: 'UTC',
    viewport: { width: 1366, height: 900 },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, timeout: 60000 },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
});
