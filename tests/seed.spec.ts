/**
 * Seed Test for Playwright Test Agents
 *
 * This seed test sets up the environment necessary for the Playwright test agents
 * (Planner, Generator, Healer) to interact with the application.
 *
 * It:
 * - Executes all initialization necessary for tests (global setup, project dependencies, fixtures)
 * - Serves as a template for all generated tests
 * - Provides a ready-to-use `page` context to bootstrap execution
 *
 * Usage:
 * - The Planner agent runs this test to set up the page before exploring the app
 * - The Generator agent uses this as a reference for generated tests
 * - All tests should follow the same fixture patterns established here
 */
import { test, expect } from '@playwright/test';

/**
 * Seed test - provides a ready-to-use page context for agents
 *
 * This test is intentionally minimal. It sets up the initial page state
 * that other agents can use as a starting point for exploration and test generation.
 */
test.describe('Seed', () => {
  test('environment setup', async ({ page }) => {
    // Navigate to the base URL (configured in playwright.config.ts)
    // This establishes the starting point for agent exploration
    await page.goto('/');

    // Wait for page to be interactive
    await page.waitForLoadState('domcontentloaded');

    // Basic verification that the page loaded successfully
    // Agents will use this state as the starting point
    await expect(page).toHaveTitle(/.*/);
  });
});

/**
 * Example authenticated seed test
 *
 * Uncomment and customize this section when testing authenticated flows.
 * The Planner agent will use this to explore authenticated areas of the app.
 */
// test.describe('Seed - Authenticated', () => {
//   test.use({ storageState: 'playwright/.auth/user.json' });
//
//   test('authenticated environment setup', async ({ page }) => {
//     await page.goto('/dashboard');
//     await page.waitForLoadState('domcontentloaded');
//     await expect(page).toHaveURL(/dashboard/);
//   });
// });
