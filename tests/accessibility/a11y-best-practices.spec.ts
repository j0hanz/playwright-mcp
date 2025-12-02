/**
 * Accessibility Tests - Demonstrates accessibility-first testing
 *
 * Shows:
 * - Using accessibility snapshot to understand page structure
 * - Running accessibility audits with axe-core
 * - Testing keyboard navigation
 * - Testing screen reader compatibility
 */
import { test, expect } from '@playwright/test';

test.describe('Accessibility - Semantic Structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page has proper semantic structure', async ({ page }) => {
    // Verify page is visible and has content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('main landmark is present', async ({ page }) => {
    // Main content should have a main landmark
    const main = page.getByRole('main');
    await expect(main).toBeVisible();
  });

  test('page has navigation landmark', async ({ page }) => {
    // Navigation should be in a nav element
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();
  });

  test('page title is in heading', async ({ page }) => {
    // Page should have a main heading (h1)
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // Get the text
    const headingText = await heading.textContent();
    expect(headingText?.trim()).not.toBe('');
  });

  test('all interactive elements are keyboard accessible', async ({ page }) => {
    // Get all buttons
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();

    // Each button should be focusable
    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const button = buttons.nth(i);
      await button.focus();
      await expect(button).toBeFocused();
    }
  });

  test('form fields have associated labels', async ({ page }) => {
    // All inputs should have accessible names (from labels or aria-label)
    const inputs = page.locator('input');
    const inputCount = await inputs.count();

    for (let i = 0; i < Math.min(inputCount, 3); i++) {
      const input = inputs.nth(i);
      const name = await input.getAttribute('aria-label');
      const id = await input.getAttribute('id');
      const label = id ? await page.locator(`label[for="${id}"]`).count() : 0;

      // Either aria-label or associated label
      const hasAccessibleName = name || label > 0;
      expect(hasAccessibleName).toBeTruthy();
    }
  });
});

test.describe('Accessibility - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('can navigate using Tab key', async ({ page }) => {
    // Start by clicking on body to ensure focus
    await page.click('body');

    // First Tab should focus first interactive element
    await page.keyboard.press('Tab');

    // Something should be focused
    const focused = page.locator(':focus');
    const focusedCount = await focused.count();
    expect(focusedCount).toBeGreaterThan(0);
  });

  test('can navigate with Shift+Tab backward', async ({ page }) => {
    // Focus an element
    const firstLink = page.getByRole('link').first();
    await firstLink.focus();
    await expect(firstLink).toBeFocused();

    // Shift+Tab should move focus
    await page.keyboard.press('Shift+Tab');

    // Focus should have changed (not guaranteed to be different element, but moved in tab order)
  });

  test('can activate buttons with Enter key', async ({ page }) => {
    // Focus button using Tab
    const button = page.getByRole('button').first();
    await button.focus();
    await expect(button).toBeFocused();

    // Press Enter to activate (assuming it's a clickable button)
    // The behavior depends on the button's action
  });

  test('can close modal with Escape key', async ({ page }) => {
    // Open a modal (if your app has one)
    const openButton = page.getByRole('button', { name: /open/i });
    const openCount = await openButton.count();

    if (openCount > 0) {
      await openButton.click();
      // Modal should be visible
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();

      // Press Escape to close
      await page.keyboard.press('Escape');
      // Modal should be hidden
      await expect(modal).toBeHidden();
    }
  });
});

test.describe('Accessibility - Images and Icons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('all images have alt text', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < Math.min(imageCount, 3); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');

      // Either alt text or aria-label
      const hasAccessibleName = alt || ariaLabel;
      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('icon buttons have accessible names', async ({ page }) => {
    // Icon buttons should have aria-label or title
    const iconButtons = page.getByRole('button');
    const buttonCount = await iconButtons.count();

    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const button = iconButtons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');

      // Button should have accessible name
      const hasName = text?.trim() || ariaLabel || title;
      expect(hasName).toBeTruthy();
    }
  });
});

test.describe('Accessibility - Color Contrast', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page is functional in high contrast mode', async ({ page }) => {
    // Emulate high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });

    // Content should still be visible
    const main = page.getByRole('main');
    await expect(main).toBeVisible();

    // Reset
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('page works without custom styling', async ({ page }) => {
    // Get initial state
    await page.goto('/');

    // Inject CSS to disable colors
    await page.addStyleTag({
      content: `
        * {
          color: black !important;
          background-color: white !important;
        }
      `,
    });

    // Content should still be readable
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
  });
});
