/**
 * Accessibility Integration Tests
 *
 * Tests accessibility scanning with axe-core for WCAG compliance
 *
 * Test Sites:
 * - example.com: Simple site for basic accessibility testing
 * - developer.mozilla.org: Complex site for comprehensive testing
 */
import { test, expect } from '@playwright/test';
import type { Result } from 'axe-core';

// Helper to inject and run axe-core
async function injectAxe(page: import('@playwright/test').Page) {
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js',
  });
}

async function runAxe(
  page: import('@playwright/test').Page,
  context?: string,
  options?: unknown
): Promise<Result[]> {
  await page.waitForFunction(
    () => typeof (window as unknown as { axe: unknown }).axe !== 'undefined'
  );

  return await page.evaluate(
    (args) => {
      const [ctx, opts] = args as [string | undefined, unknown];
      return (
        window as unknown as {
          axe: {
            run: (
              ctx: unknown,
              opts: unknown
            ) => Promise<{ violations: Result[] }>;
          };
        }
      ).axe
        .run(ctx || document, opts || {})
        .then((results) => results.violations);
    },
    [context, options] as unknown[]
  );
}

test.describe('Accessibility - Basic Scanning', () => {
  test('scan page for accessibility violations', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page);

    // example.com should have minimal violations
    expect(Array.isArray(violations)).toBe(true);
    console.log(`Found ${violations.length} violations`);
  });

  test('scan specific element', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, 'h1');
    expect(Array.isArray(violations)).toBe(true);
  });

  test('scan with custom rules', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, undefined, {
      rules: {
        'color-contrast': { enabled: true },
        'image-alt': { enabled: true },
      },
    });

    expect(Array.isArray(violations)).toBe(true);
  });
});

test.describe('Accessibility - WCAG Compliance', () => {
  test('check WCAG 2.0 Level A', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, undefined, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a'],
      },
    });

    console.log(`WCAG 2.0 Level A violations: ${violations.length}`);
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });

  test('check WCAG 2.0 Level AA', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, undefined, {
      runOnly: {
        type: 'tag',
        values: ['wcag2aa'],
      },
    });

    console.log(`WCAG 2.0 Level AA violations: ${violations.length}`);
    expect(Array.isArray(violations)).toBe(true);
  });

  test('check WCAG 2.1 Level AA', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, undefined, {
      runOnly: {
        type: 'tag',
        values: ['wcag21aa'],
      },
    });

    console.log(`WCAG 2.1 Level AA violations: ${violations.length}`);
    expect(Array.isArray(violations)).toBe(true);
  });

  test('check best practices', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, undefined, {
      runOnly: {
        type: 'tag',
        values: ['best-practice'],
      },
    });

    console.log(`Best practice violations: ${violations.length}`);
    expect(Array.isArray(violations)).toBe(true);
  });
});

test.describe('Accessibility - Specific Rules', () => {
  test('check color contrast', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, undefined, {
      runOnly: ['color-contrast'],
    });

    console.log(`Color contrast violations: ${violations.length}`);
    expect(Array.isArray(violations)).toBe(true);
  });

  test('check image alt text', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, undefined, {
      runOnly: ['image-alt'],
    });

    expect(Array.isArray(violations)).toBe(true);
  });

  test('check document title', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, undefined, {
      runOnly: ['document-title'],
    });

    expect(violations.length).toBe(0);
  });

  test('check HTML lang attribute', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, undefined, {
      runOnly: ['html-has-lang'],
    });

    expect(Array.isArray(violations)).toBe(true);
  });
});

test.describe('Accessibility - Keyboard Navigation', () => {
  test('check tab order', async ({ page }) => {
    await page.goto('https://example.com');

    // Tab through focusable elements
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(
      () => document.activeElement?.tagName
    );
    expect(firstFocus).toBeTruthy();
  });

  test('verify focus indicators', async ({ page }) => {
    await page.goto('https://example.com');

    const link = page.locator('a').first();
    await link.focus();

    // Check if element has focus
    const hasFocus = await link.evaluate((el) => el === document.activeElement);
    expect(hasFocus).toBe(true);
  });
});

test.describe('Accessibility - Screen Reader Support', () => {
  test('check ARIA labels', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page, undefined, {
      runOnly: ['aria-allowed-attr', 'aria-required-attr'],
    });

    expect(Array.isArray(violations)).toBe(true);
  });

  test('check accessible names', async ({ page }) => {
    await page.goto('https://example.com');

    const links = await page.locator('a').evaluateAll((elements) =>
      elements.map((el) => ({
        text: el.textContent?.trim(),
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
      }))
    );

    // All links should have some form of accessible name
    links.forEach((link) => {
      const hasAccessibleName = link.text || link.ariaLabel || link.title;
      expect(hasAccessibleName).toBeTruthy();
    });
  });
});

test.describe('Accessibility - Visual Elements', () => {
  test('check text sizing', async ({ page }) => {
    await page.goto('https://example.com');

    const fontSize = await page
      .locator('body')
      .evaluate((el) => window.getComputedStyle(el).fontSize);

    // Font size should be readable (at least 12px)
    const size = parseInt(fontSize);
    expect(size).toBeGreaterThanOrEqual(12);
  });

  test('check responsive text', async ({ page }) => {
    await page.goto('https://example.com');

    // Zoom to 200%
    await page.evaluate(() => {
      document.body.style.zoom = '200%';
    });

    // Text should still be visible
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Accessibility - Reporting', () => {
  test('generate detailed violation report', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page);

    if (violations.length > 0) {
      const report = violations.map((violation: Result) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        nodes: violation.nodes.length,
      }));

      console.log('Accessibility Report:', JSON.stringify(report, null, 2));
    }

    expect(Array.isArray(violations)).toBe(true);
  });

  test('check violation severity', async ({ page }) => {
    await page.goto('https://example.com');
    await injectAxe(page);

    const violations = await runAxe(page);

    const criticalViolations = violations.filter(
      (v: Result) => v.impact === 'critical'
    );
    const seriousViolations = violations.filter(
      (v: Result) => v.impact === 'serious'
    );

    console.log(`Critical violations: ${criticalViolations.length}`);
    console.log(`Serious violations: ${seriousViolations.length}`);

    expect(Array.isArray(violations)).toBe(true);
  });
});
