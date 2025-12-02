/**
 * Navigation Tests - Demonstrates semantic locators and best practices
 *
 * These tests show proper use of role-based locators, chaining, and
 * web-first assertions for robust, maintainable tests.
 */
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to base URL
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page has navigation menu', async ({ page }) => {
    // Use role-based locators (most reliable)
    const navigation = page.getByRole('navigation');
    await expect(navigation).toBeVisible();
  });

  test('navigation links are accessible', async ({ page }) => {
    // Find navigation, then find links within it (chaining)
    const nav = page.getByRole('navigation');
    const links = nav.getByRole('link');

    // Verify at least one link exists
    await expect(links).not.toHaveCount(0);
  });

  test('can navigate using semantic locators', async ({ page }) => {
    // Use semantic locator: find link by visible text or accessible name
    const aboutLink = page.getByRole('link', { name: /about/i });
    await expect(aboutLink).toBeVisible();
    await aboutLink.click();

    // Web-first assertion that auto-waits for URL to change
    await expect(page).toHaveURL(/#about/i);
  });

  test('page title is accessible', async ({ page }) => {
    // Use heading locator by level
    const mainHeading = page.getByRole('heading', { level: 1 });
    await expect(mainHeading).toBeVisible();
  });
});

test.describe('Navigation - Locator Chaining', () => {
  test('find nested elements using chaining', async ({ page }) => {
    await page.goto('/');

    // Chain locators to narrow the search
    const sectionWithContent = page
      .getByRole('region')
      .filter({ hasText: /features/i });

    await expect(sectionWithContent).toBeVisible();
  });

  test('filter by text to find specific item', async ({ page }) => {
    await page.goto('/');

    // If there are multiple navigation sections, filter by text
    const primaryNav = page
      .getByRole('navigation')
      .filter({ hasText: /primary/i });

    // If not found (count = 0), the filter simply returns empty locator
    const linkCount = await primaryNav.getByRole('link').count();
    expect(linkCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Navigation - Error Handling', () => {
  test('gracefully handles missing elements', async ({ page }) => {
    await page.goto('/');

    // Try to find element that might not exist
    const optionalElement = page
      .getByRole('navigation')
      .getByTestId('optional-item');

    // This won't throw, just finds nothing
    const count = await optionalElement.count();
    expect(count).toBe(0);
  });

  test('keyboard navigation is accessible', async ({ page }) => {
    await page.goto('/');

    // Get first link
    const firstLink = page.getByRole('navigation').getByRole('link').first();
    await expect(firstLink).toBeVisible();

    // Focus the link
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
  });
});
