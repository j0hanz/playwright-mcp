/**
 * Page Operations Integration Tests
 *
 * Tests browser_snapshot, page_screenshot, page_content, page_evaluate,
 * wait_for_selector, page_wait_for_load_state
 *
 * Test Sites:
 * - example.com: Simple site for basic operations
 * - httpbin.org: HTTP testing service
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Page Operations - Page Information', () => {
  test('get page title', async ({ page }) => {
    await page.goto('https://example.com');

    const title = await page.title();
    expect(title).toBe('Example Domain');
  });

  test('get page URL', async ({ page }) => {
    await page.goto('https://example.com');

    const url = page.url();
    expect(url).toBe('https://example.com/');
  });

  test('get viewport size', async ({ page }) => {
    await page.goto('https://example.com');

    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();
    expect(viewport?.width).toBeGreaterThan(0);
  });
});

test.describe('Page Operations - Screenshots', () => {
  test('take full page screenshot', async ({ page }) => {
    await page.goto('https://example.com');

    const screenshotPath = path.join(
      process.cwd(),
      'test-results',
      'full-page.png'
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });

    expect(fs.existsSync(screenshotPath)).toBe(true);

    // Cleanup
    fs.unlinkSync(screenshotPath);
  });

  test('take viewport screenshot', async ({ page }) => {
    await page.goto('https://example.com');

    const screenshot = await page.screenshot();
    expect(screenshot).toBeInstanceOf(Buffer);
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('take element screenshot', async ({ page }) => {
    await page.goto('https://example.com');

    const h1 = page.locator('h1');
    const screenshot = await h1.screenshot();

    expect(screenshot).toBeInstanceOf(Buffer);
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('take screenshot with clip region', async ({ page }) => {
    await page.goto('https://example.com');

    const screenshot = await page.screenshot({
      clip: { x: 0, y: 0, width: 200, height: 200 },
    });

    expect(screenshot).toBeInstanceOf(Buffer);
  });

  test('take screenshot with different quality', async ({ page }) => {
    await page.goto('https://example.com');

    const lowQuality = await page.screenshot({ type: 'jpeg', quality: 50 });
    const highQuality = await page.screenshot({ type: 'jpeg', quality: 100 });

    expect(lowQuality.length).toBeLessThan(highQuality.length);
  });

  test('take screenshot without background', async ({ page }) => {
    await page.goto('https://example.com');

    const screenshot = await page.screenshot({
      omitBackground: true,
      type: 'png',
    });

    expect(screenshot).toBeInstanceOf(Buffer);
  });

  test('take multiple element screenshots', async ({ page }) => {
    await page.goto('https://example.com');

    const h1Screenshot = await page.locator('h1').screenshot();
    const pScreenshot = await page.locator('p').first().screenshot();

    expect(h1Screenshot.length).toBeGreaterThan(0);
    expect(pScreenshot.length).toBeGreaterThan(0);
  });
});

test.describe('Page Operations - Content Extraction', () => {
  test('get page HTML content', async ({ page }) => {
    await page.goto('https://example.com');

    const html = await page.content();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<h1>Example Domain</h1>');
  });

  test('get element HTML', async ({ page }) => {
    await page.goto('https://example.com');

    const innerHTML = await page.locator('div').first().innerHTML();
    expect(innerHTML).toBeTruthy();
  });

  test('get element outer HTML', async ({ page }) => {
    await page.goto('https://example.com');

    const outerHTML = await page.locator('h1').innerHTML();
    expect(outerHTML).toContain('Example Domain');
  });

  test('get page text content', async ({ page }) => {
    await page.goto('https://example.com');

    const text = await page.locator('body').textContent();
    expect(text).toContain('Example Domain');
  });

  test('get element inner text', async ({ page }) => {
    await page.goto('https://example.com');

    const text = await page.locator('h1').innerText();
    expect(text).toBe('Example Domain');
  });

  test('extract all links', async ({ page }) => {
    await page.goto('https://example.com');

    const links = await page.locator('a').evaluateAll((elements) =>
      elements.map((el) => ({
        href: (el as HTMLAnchorElement).href,
        text: el.textContent,
      }))
    );

    expect(links.length).toBeGreaterThan(0);
    expect(links[0].href).toBeTruthy();
  });

  test('extract meta tags', async ({ page }) => {
    await page.goto('https://example.com');

    const metaTags = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('meta')).map((meta) => ({
        name: meta.getAttribute('name'),
        content: meta.getAttribute('content'),
      }));
    });

    expect(Array.isArray(metaTags)).toBe(true);
  });
});

test.describe('Page Operations - JavaScript Evaluation', () => {
  test('evaluate simple expression', async ({ page }) => {
    await page.goto('https://example.com');

    const result = await page.evaluate(() => 1 + 2);
    expect(result).toBe(3);
  });

  test('evaluate with page context', async ({ page }) => {
    await page.goto('https://example.com');

    const title = await page.evaluate(() => document.title);
    expect(title).toBe('Example Domain');
  });

  test('evaluate with arguments', async ({ page }) => {
    await page.goto('https://example.com');

    const result = await page.evaluate(({ a, b }) => a + b, { a: 5, b: 10 });
    expect(result).toBe(15);
  });

  test('evaluate and modify DOM', async ({ page }) => {
    await page.goto('https://example.com');

    await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (h1) h1.textContent = 'Modified Title';
    });

    await expect(page.locator('h1')).toHaveText('Modified Title');
  });

  test('evaluate and return element', async ({ page }) => {
    await page.goto('https://example.com');

    const elementHandle = await page.evaluateHandle(() =>
      document.querySelector('h1')
    );
    expect(elementHandle).toBeTruthy();
    await elementHandle.dispose();
  });

  test('evaluate on element', async ({ page }) => {
    await page.goto('https://example.com');

    const text = await page.locator('h1').evaluate((el) => el.textContent);
    expect(text).toBe('Example Domain');
  });

  test('evaluate with complex return value', async ({ page }) => {
    await page.goto('https://example.com');

    const data = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      links: document.querySelectorAll('a').length,
    }));

    expect(data.title).toBe('Example Domain');
    expect(data.url).toContain('example.com');
    expect(data.links).toBeGreaterThan(0);
  });

  test('evaluate async function', async ({ page }) => {
    await page.goto('https://example.com');

    const result = await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'done';
    });

    expect(result).toBe('done');
  });

  test('evaluate localStorage operations', async ({ page }) => {
    await page.goto('https://example.com');

    await page.evaluate(() => {
      localStorage.setItem('test-key', 'test-value');
    });

    const value = await page.evaluate(() => localStorage.getItem('test-key'));
    expect(value).toBe('test-value');
  });

  test('evaluate sessionStorage operations', async ({ page }) => {
    await page.goto('https://example.com');

    await page.evaluate(() => {
      sessionStorage.setItem('session-key', 'session-value');
    });

    const value = await page.evaluate(() =>
      sessionStorage.getItem('session-key')
    );
    expect(value).toBe('session-value');
  });
});

test.describe('Page Operations - Wait for Selector', () => {
  test('wait for selector to be attached', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dynamic_loading/2');

    await page.getByRole('button', { name: 'Start' }).click();

    await page.locator('#finish').waitFor({ state: 'attached' });
    expect(await page.locator('#finish').isVisible()).toBe(true);
  });

  test('wait for selector to be visible', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dynamic_loading/1');

    await page.getByRole('button', { name: 'Start' }).click();

    await page.locator('#finish').waitFor({ state: 'visible', timeout: 10000 });
    await expect(page.locator('#finish')).toBeVisible();
  });

  test('wait for selector to be hidden', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dynamic_loading/1');

    const loading = page.locator('#loading');

    await page.getByRole('button', { name: 'Start' }).click();
    await loading.waitFor({ state: 'hidden', timeout: 10000 });

    await expect(loading).toBeHidden();
  });

  test('wait for selector to be detached', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/add_remove_elements/');

    await page.getByRole('button', { name: 'Add Element' }).click();
    const deleteButton = page.locator('.added-manually').first();

    await deleteButton.click();
    await deleteButton.waitFor({ state: 'detached' });

    await expect(deleteButton).not.toBeAttached();
  });

  test('wait for selector with timeout', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dynamic_loading/2');

    await page.getByRole('button', { name: 'Start' }).click();

    await page.locator('#finish').waitFor({ timeout: 10000 });
    await expect(page.locator('#finish')).toBeVisible();
  });

  test('wait for multiple selectors', async ({ page }) => {
    await page.goto('https://example.com');

    await Promise.all([
      page.locator('h1').waitFor(),
      page.locator('p').waitFor(),
      page.locator('a').waitFor(),
    ]);

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('p').first()).toBeVisible();
  });
});

test.describe('Page Operations - Wait for Load State', () => {
  test('wait for load event', async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'commit' });
    await page.waitForLoadState('load');

    await expect(page.locator('h1')).toBeVisible();
  });

  test('wait for DOMContentLoaded', async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'commit' });
    await page.waitForLoadState('domcontentloaded');

    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('wait for networkidle', async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'commit' });
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/example\.com/);
  });

  test('wait for load state after navigation', async ({ page }) => {
    await page.goto('https://example.com');

    await Promise.all([
      page.waitForLoadState('load'),
      page.locator('a').first().click(),
    ]);

    await expect(page).toHaveURL(/iana\.org/);
  });

  test('wait for load state after reload', async ({ page }) => {
    await page.goto('https://example.com');

    await Promise.all([page.waitForLoadState('load'), page.reload()]);

    await expect(page.locator('h1')).toBeVisible();
  });

  test('multiple load state waits', async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'commit' });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL('https://example.com/');
  });
});

test.describe('Page Operations - Wait for Function', () => {
  test('wait for function condition', async ({ page }) => {
    await page.goto('https://example.com');

    await page.waitForFunction(() => document.readyState === 'complete');

    const readyState = await page.evaluate(() => document.readyState);
    expect(readyState).toBe('complete');
  });

  test('wait for element count', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/add_remove_elements/');

    await page.getByRole('button', { name: 'Add Element' }).click();

    await page.waitForFunction(() => {
      return document.querySelectorAll('.added-manually').length === 1;
    });

    await expect(page.locator('.added-manually')).toHaveCount(1);
  });

  test('wait for custom condition', async ({ page }) => {
    await page.goto('https://example.com');

    await page.evaluate(() => {
      setTimeout(() => {
        (window as unknown as { customFlag: boolean }).customFlag = true;
      }, 1000);
    });

    await page.waitForFunction(
      () => (window as unknown as { customFlag: boolean }).customFlag === true
    );

    const flag = await page.evaluate(
      () => (window as unknown as { customFlag: boolean }).customFlag
    );
    expect(flag).toBe(true);
  });

  test('wait for timeout', async ({ page }) => {
    await page.goto('https://example.com');

    await page.waitForTimeout(1000);

    // Simple time-based wait
    expect(true).toBe(true);
  });
});

test.describe('Page Operations - Wait for Event', () => {
  test('wait for console message', async ({ page }) => {
    await page.goto('https://example.com');

    const messagePromise = page.waitForEvent('console');

    await page.evaluate(() => console.log('Test message'));

    const message = await messagePromise;
    expect(message.text()).toBe('Test message');
  });

  test('wait for request', async ({ page }) => {
    const requestPromise = page.waitForEvent('request');

    await page.goto('https://example.com');

    const request = await requestPromise;
    expect(request.url()).toContain('example.com');
  });

  test('wait for response', async ({ page }) => {
    const responsePromise = page.waitForEvent('response');

    await page.goto('https://example.com');

    const response = await responsePromise;
    expect(response.status()).toBe(200);
  });

  test('wait for popup', async ({ page }) => {
    await page.goto('https://example.com');

    const popupPromise = page.waitForEvent('popup');

    await page.evaluate(() => {
      window.open('https://www.iana.org/domains/example', '_blank');
    });

    const popup = await popupPromise;
    await popup.waitForLoadState();
    expect(popup.url()).toContain('iana.org');

    await popup.close();
  });

  test('wait for download', async ({ page }) => {
    await page.goto('https://httpbin.org/');

    // Most pages don't trigger downloads directly, so we'll simulate
    await page.evaluate(() => {
      const link = document.createElement('a');
      link.href = 'https://httpbin.org/image/png';
      link.download = 'test.png';
      document.body.appendChild(link);
      link.id = 'download-link';
    });

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-link').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBeTruthy();
  });
});

test.describe('Page Operations - Combined Scenarios', () => {
  test('screenshot after dynamic content load', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dynamic_loading/2');

    await page.getByRole('button', { name: 'Start' }).click();
    await page.locator('#finish').waitFor({ state: 'visible', timeout: 10000 });

    const screenshot = await page.screenshot();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('evaluate and extract after wait', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/dynamic_loading/2');

    await page.getByRole('button', { name: 'Start' }).click();
    await page.waitForLoadState('networkidle');

    const text = await page.locator('#finish h4').textContent();
    expect(text).toBe('Hello World!');
  });

  test('complex content extraction', async ({ page }) => {
    await page.goto('https://example.com');

    const pageData = await page.evaluate(() => ({
      title: document.title,
      headings: Array.from(document.querySelectorAll('h1')).map(
        (h) => h.textContent
      ),
      paragraphs: Array.from(document.querySelectorAll('p')).map(
        (p) => p.textContent
      ),
      links: Array.from(document.querySelectorAll('a')).map((a) => ({
        text: a.textContent,
        href: a.href,
      })),
    }));

    expect(pageData.title).toBe('Example Domain');
    expect(pageData.headings.length).toBeGreaterThan(0);
    expect(pageData.links.length).toBeGreaterThan(0);
  });
});
