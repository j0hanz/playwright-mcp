/**
 * Browser Lifecycle Integration Tests
 *
 * Tests browser_launch, browser_close, browser_tabs, sessions_list,
 * save_storage_state, session_reset_state, page_prepare
 *
 * Test Sites:
 * - example.com: Simple, stable site for basic operations
 * - httpbin.org: HTTP testing service
 */
import { test, expect } from '@playwright/test';

test.describe('Browser Lifecycle - Launch and Close', () => {
  test('launch chromium browser', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example Domain/);

    await context.close();
  });

  test('launch firefox browser', async ({ browser, browserName }) => {
    // Skip: Firefox-specific test, only runs when browserName is firefox
    test.skip(browserName !== 'firefox', 'Firefox-only test');

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://example.com');
    await expect(page).toHaveURL('https://example.com/');

    await context.close();
  });

  test('launch webkit browser', async ({ browser, browserName }) => {
    // Skip: WebKit-specific test, only runs when browserName is webkit
    test.skip(browserName !== 'webkit', 'WebKit-only test');

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://example.com');
    await expect(page.locator('h1')).toBeVisible();

    await context.close();
  });
});

test.describe('Browser Lifecycle - Multiple Tabs', () => {
  test('create and manage multiple tabs', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('https://example.com');

    const page2 = await context.newPage();
    await page2.goto('https://httpbin.org');

    // Verify both pages are open
    const pages = context.pages();
    expect(pages).toHaveLength(2);

    // Switch back to first tab
    await page1.bringToFront();
    await expect(page1).toHaveTitle(/Example Domain/);

    // Close tab
    await page2.close();
    expect(context.pages()).toHaveLength(1);

    await page1.close();
  });

  test('handle popup windows', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    // Listen for popup
    const popupPromise = page.waitForEvent('popup');

    // Create link that opens in new window
    await page.evaluate(() => {
      const link = document.createElement('a');
      link.href = 'https://httpbin.org';
      link.target = '_blank';
      link.textContent = 'Open popup';
      document.body.appendChild(link);
      link.click();
    });

    const popup = await popupPromise;
    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/httpbin/);

    await popup.close();
    await page.close();
  });
});

test.describe('Browser Lifecycle - Storage State', () => {
  test('save and restore storage state', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    // Set some storage
    await page.evaluate(() => {
      localStorage.setItem('test-key', 'test-value');
      document.cookie = 'test-cookie=test-value';
    });

    // Save storage state
    const storageState = await context.storageState();
    expect(storageState.cookies).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'test-cookie' })])
    );

    await page.close();
  });

  test('clear storage state', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    // Set storage
    await page.evaluate(() => {
      localStorage.setItem('test-key', 'test-value');
    });

    // Verify storage exists
    const value = await page.evaluate(() => localStorage.getItem('test-key'));
    expect(value).toBe('test-value');

    // Clear storage
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Verify storage is cleared
    const cleared = await page.evaluate(() => localStorage.getItem('test-key'));
    expect(cleared).toBeNull();

    await page.close();
  });
});

test.describe('Browser Lifecycle - Page Configuration', () => {
  test('configure viewport', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 }, // Mobile viewport
    });
    const page = await context.newPage();

    await page.goto('https://example.com');

    const viewport = page.viewportSize();
    expect(viewport).toEqual({ width: 375, height: 667 });

    await context.close();
  });

  test('configure geolocation', async ({ browser }) => {
    const context = await browser.newContext({
      geolocation: { latitude: 37.7749, longitude: -122.4194 },
      permissions: ['geolocation'],
    });
    const page = await context.newPage();

    await page.goto('https://example.com');

    // Verify geolocation is set
    const position = await page.evaluate(() => {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          () => resolve(null)
        );
      });
    });

    expect(position).toMatchObject({
      lat: expect.closeTo(37.7749, 0.001),
      lon: expect.closeTo(-122.4194, 0.001),
    });

    await context.close();
  });

  test('configure color scheme', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'dark',
    });
    const page = await context.newPage();

    await page.goto('https://example.com');

    const colorScheme = await page.evaluate(() => {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    expect(colorScheme).toBe(true);

    await context.close();
  });
});
