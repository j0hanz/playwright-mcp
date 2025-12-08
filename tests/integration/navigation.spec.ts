/**
 * Navigation Integration Tests
 *
 * Tests browser_navigate, browser_history, browser_reload, handle_dialog
 *
 * Test Sites:
 * - example.com: Simple, stable site for basic navigation
 * - httpbin.org: HTTP testing service
 * - developer.mozilla.org: Complex site for advanced navigation
 */
import { test, expect } from '@playwright/test';

test.describe('Navigation - Basic Navigation', () => {
  test('navigate with load wait strategy', async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'load' });
    await expect(page).toHaveURL('https://example.com/');
    await expect(page).toHaveTitle(/Example Domain/);
  });

  test('navigate with domcontentloaded wait strategy', async ({ page }) => {
    await page.goto('https://httpbin.org/html', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('h1')).toBeVisible();
  });

  test('navigate with networkidle wait strategy', async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/example\.com/);
  });

  test('navigate with commit wait strategy', async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'commit' });
    // Commit happens before full page load
    await page.waitForLoadState('load');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('navigate to URL with query parameters', async ({ page }) => {
    await page.goto('https://httpbin.org/get?param1=value1&param2=value2');
    await expect(page).toHaveURL(/param1=value1/);
    const content = await page.textContent('body');
    expect(content).toContain('param1');
  });

  test('navigate to URL with hash', async ({ page }) => {
    await page.goto(
      'https://developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event#examples'
    );
    await expect(page).toHaveURL(/#examples/);
  });
});

test.describe('Navigation - Browser History', () => {
  test('navigate back and forward', async ({ page }) => {
    // Navigate to first page
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example Domain/);

    // Navigate to second page
    await page.goto('https://httpbin.org');
    await expect(page).toHaveURL(/httpbin/);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL('https://example.com/');

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/httpbin/);
  });

  test('multiple back and forward operations', async ({ page }) => {
    const urls = [
      'https://example.com',
      'https://httpbin.org/html',
      'https://httpbin.org/get',
    ];

    // Navigate through pages
    for (const url of urls) {
      await page.goto(url);
    }

    // Go back twice
    await page.goBack();
    await page.goBack();
    await expect(page).toHaveURL('https://example.com/');

    // Go forward twice
    await page.goForward();
    await page.goForward();
    await expect(page).toHaveURL(/\/get$/);
  });

  test('history with wait strategies', async ({ page }) => {
    await page.goto('https://example.com');
    await page.goto('https://httpbin.org/html');

    await page.goBack({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL('https://example.com/');
  });
});

test.describe('Navigation - Page Reload', () => {
  test('reload page', async ({ page }) => {
    await page.goto('https://httpbin.org/get');

    await page.reload();
    await page.waitForLoadState('load');

    const reloadedContent = await page.textContent('body');
    expect(reloadedContent).toBeTruthy();
  });

  test('reload with different wait strategies', async ({ page }) => {
    await page.goto('https://example.com');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible();
  });

  test('reload preserves URL hash', async ({ page }) => {
    await page.goto(
      'https://developer.mozilla.org/en-US/docs/Web/API#interfaces'
    );
    await expect(page).toHaveURL(/#interfaces/);

    await page.reload();
    await expect(page).toHaveURL(/#interfaces/);
  });

  test('reload with modified DOM', async ({ page }) => {
    await page.goto('https://example.com');

    // Modify DOM
    await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (h1) h1.textContent = 'Modified';
    });

    const modifiedText = await page.locator('h1').textContent();
    expect(modifiedText).toBe('Modified');

    // Reload should restore original
    await page.reload();
    const originalText = await page.locator('h1').textContent();
    expect(originalText).not.toBe('Modified');
  });
});

test.describe('Navigation - Dialog Handling', () => {
  test('handle alert dialog', async ({ page }) => {
    await page.goto('https://example.com');

    // Set up dialog handler before triggering
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('This is an alert');
      await dialog.accept();
    });

    // Trigger alert
    await page.evaluate(() => alert('This is an alert'));
  });

  test('handle confirm dialog - accept', async ({ page }) => {
    await page.goto('https://example.com');

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe('Do you confirm?');
      await dialog.accept();
    });

    const result = await page.evaluate(() => confirm('Do you confirm?'));
    expect(result).toBe(true);
  });

  test('handle confirm dialog - dismiss', async ({ page }) => {
    await page.goto('https://example.com');

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.dismiss();
    });

    const result = await page.evaluate(() => confirm('Do you confirm?'));
    expect(result).toBe(false);
  });

  test('handle prompt dialog with input', async ({ page }) => {
    await page.goto('https://example.com');

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      expect(dialog.message()).toBe('Enter your name:');
      expect(dialog.defaultValue()).toBe('');
      await dialog.accept('John Doe');
    });

    const result = await page.evaluate(() => prompt('Enter your name:'));
    expect(result).toBe('John Doe');
  });

  test('handle prompt dialog with default value', async ({ page }) => {
    await page.goto('https://example.com');

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      expect(dialog.defaultValue()).toBe('Default Name');
      await dialog.accept();
    });

    const result = await page.evaluate(() =>
      prompt('Enter your name:', 'Default Name')
    );
    expect(result).toBe('Default Name');
  });

  test('handle prompt dialog - dismiss', async ({ page }) => {
    await page.goto('https://example.com');

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.dismiss();
    });

    const result = await page.evaluate(() => prompt('Enter your name:'));
    expect(result).toBeNull();
  });

  test('handle multiple dialogs in sequence', async ({ page }) => {
    await page.goto('https://example.com');

    page.on('dialog', async (dialog) => {
      if (dialog.message() === 'First alert') {
        await dialog.accept();
      } else if (dialog.message() === 'Second confirm') {
        await dialog.accept();
      }
    });

    await page.evaluate(() => {
      alert('First alert');
      confirm('Second confirm');
    });
  });

  test('handle beforeunload dialog', async ({ page }) => {
    await page.goto('https://example.com');

    // Set up beforeunload handler
    await page.evaluate(() => {
      window.addEventListener('beforeunload', (e) => {
        e.preventDefault();
        e.returnValue = '';
      });
    });

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('beforeunload');
      await dialog.accept();
    });

    // Navigate away (triggers beforeunload)
    await page.goto('https://httpbin.org');
  });
});

test.describe('Navigation - Error Handling', () => {
  test('handle navigation timeout', async ({ page }) => {
    // Set short timeout
    await expect(
      page.goto('https://httpstat.us/200?sleep=10000', {
        timeout: 1000,
      })
    ).rejects.toThrow(/Timeout/);
  });

  test('handle 404 error', async ({ page }) => {
    const response = await page.goto('https://httpbin.org/status/404');
    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(/status\/404/);
  });

  test('handle 500 error', async ({ page }) => {
    const response = await page.goto('https://httpbin.org/status/500');
    expect(response?.status()).toBe(500);
  });

  test('handle redirect', async ({ page }) => {
    const response = await page.goto(
      'https://httpbin.org/redirect-to?url=https://example.com'
    );
    expect(response?.url()).toBe('https://example.com/');
  });

  test('handle multiple redirects', async ({ page }) => {
    const response = await page.goto('https://httpbin.org/redirect/3');
    expect(response?.url()).toMatch(/\/get$/);
  });
});
