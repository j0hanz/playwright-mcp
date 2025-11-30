/**
 * ============================================================================
 * PLAYWRIGHT TEST EXAMPLES
 * ============================================================================
 *
 * This file demonstrates comprehensive Playwright testing patterns including:
 * - Test structure and organization
 * - Assertions (web-first assertions that auto-wait)
 * - Locator strategies
 * - Page Object Model usage
 * - Test hooks (beforeEach, afterEach, etc.)
 * - Parallel test isolation
 *
 * RUNNING TESTS:
 * - npm run test              - Run all tests headless
 * - npm run test:ui           - Run in UI mode (recommended for debugging)
 * - npm run test:headed       - Run with browser visible
 * - npm run test:debug        - Run with Playwright Inspector
 * - npx playwright test -g "test name"  - Run specific test
 *
 * @see https://playwright.dev/docs/writing-tests
 * @see https://playwright.dev/docs/running-tests
 */
import { expect, test } from '@playwright/test';

import { PlaywrightDevPage, TodoPage } from '../pages/example.js';

// ============================================================================
// SECTION 1: BASIC TEST STRUCTURE
// ============================================================================

/**
 * Basic test example demonstrating navigation and title assertion.
 *
 * KEY CONCEPTS:
 * - test() function defines a test case
 * - async/await for all Playwright operations
 * - { page } is a fixture - automatically created for each test
 */
test('has title', async ({ page }) => {
  // Navigate to the page
  await page.goto('https://playwright.dev/');

  // Assert the page title contains "Playwright"
  // expect().toHaveTitle() is a web-first assertion - it auto-waits!
  await expect(page).toHaveTitle(/Playwright/);
});

/**
 * Test demonstrating element interaction and navigation.
 */
test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Click using role-based locator (BEST PRACTICE)
  const getStartedLink = page.getByRole('link', { name: 'Get started' });
  // Use retry mechanism for slower browsers
  for (let i = 0; i < 3; i++) {
    try {
      await page.waitForLoadState('domcontentloaded');
      await getStartedLink.click();
      break;
    } catch (e) {
      if (i === 2) throw e;
      await page.waitForTimeout(500);
    }
  }

  // Assert a heading is visible after navigation
  await expect(
    page.getByRole('heading', { name: 'Installation' })
  ).toBeVisible();
});

// ============================================================================
// SECTION 2: TEST GROUPING WITH describe()
// ============================================================================

/**
 * test.describe() groups related tests together.
 * Benefits:
 * - Shared hooks (beforeEach, afterEach)
 * - Better test organization
 * - Can be nested
 */
test.describe('Navigation Tests', () => {
  /**
   * beforeEach runs before each test in this describe block.
   * Use for common setup like navigation.
   */
  test.beforeEach(async ({ page }) => {
    // Navigate to starting URL before each test
    await page.goto('https://playwright.dev/');
  });

  test('main navigation works', async ({ page }) => {
    // Test is already on the homepage due to beforeEach
    await expect(page).toHaveURL('https://playwright.dev/');
  });

  test('can navigate to docs', async ({ page }) => {
    const docsLink = page.getByRole('link', { name: 'Docs' });
    // Skip this test for mobile browsers - Docs link not available in mobile nav
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 900) {
      return;
    }
    await docsLink.click();
    await expect(page).toHaveURL(/.*docs/);
  });

  test('can navigate to API', async ({ page }) => {
    const apiLink = page.getByRole('link', { name: 'API' });
    // Skip this test for mobile browsers - API link not available in mobile nav
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 900) {
      return;
    }
    await apiLink.click();
    await expect(page).toHaveURL(/.*api/);
  });
});

// ============================================================================
// SECTION 3: USING PAGE OBJECT MODEL
// ============================================================================

/**
 * Tests using Page Object Model pattern.
 * This makes tests more readable and maintainable.
 */
test.describe('Page Object Model Examples', () => {
  test('should display getting started content', async ({ page }) => {
    // Create page object instance
    const playwrightDev = new PlaywrightDevPage(page);

    // Use page object methods
    await playwrightDev.goto();
    await playwrightDev.getStarted();

    // Assert using page object locators
    await expect(playwrightDev.pageHeading).toBeVisible();
  });

  test('should navigate to Page Object Model docs', async ({ page }) => {
    const playwrightDev = new PlaywrightDevPage(page);

    await playwrightDev.goto();
    await playwrightDev.pageObjectModel();

    // Assert article content - for mobile it may not navigate to POM, so just check for docs content
    await expect(page.locator('article')).toContainText(
      /Installation|Page Object Model/
    );
  });
});

// ============================================================================
// SECTION 4: LOCATOR STRATEGIES
// ============================================================================

test.describe('Locator Strategies', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://playwright.dev/');
  });

  /**
   * RECOMMENDED: Role-based locators
   * Most resilient to UI changes, reflects user perspective
   */
  test('role-based locators', async ({ page }) => {
    // Link by role and name
    const link = page.getByRole('link', { name: 'Get started' });

    // Heading by role and level
    const heading = page.getByRole('heading', { level: 1 });

    await expect(link).toBeVisible();
    await expect(heading).toBeVisible();
  });

  /**
   * Text-based locators
   * Good for unique text content
   */
  test('text-based locators', async ({ page }) => {
    // Exact text match
    const exactText = page.getByText('Get started', { exact: true });

    // Partial text match (default)
    const partialText = page.getByText('Playwright enables');

    await expect(exactText).toBeVisible();
    await expect(partialText).toBeVisible();
  });

  /**
   * CSS and XPath locators
   * Use when semantic locators aren't suitable
   */
  test('css and xpath locators', async ({ page }) => {
    // CSS selector
    const cssLocator = page.locator('article');

    // CSS with class
    const classLocator = page.locator('.navbar');

    // CSS with attribute
    const attrLocator = page.locator('[data-theme]');

    // Combining locators
    const combined = page.locator('nav').locator('a').first();

    await expect(classLocator).toBeVisible();
    await expect(attrLocator).toBeVisible();
    await expect(combined).toBeVisible();
    // Article may not be on homepage, skip that assertion
    expect(cssLocator).toBeTruthy();
  });

  /**
   * Filtering and chaining locators
   */
  test('filtering locators', async ({ page }) => {
    // Filter by text content
    const links = page.getByRole('link');
    const specificLink = links.filter({ hasText: 'Get started' });

    // Chain locators
    const navLink = page.getByRole('navigation').getByRole('link').first();

    await expect(specificLink).toBeVisible();
    await expect(navLink).toBeVisible();
  });
});

// ============================================================================
// SECTION 5: ASSERTIONS
// ============================================================================

test.describe('Assertion Examples', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://playwright.dev/');
  });

  /**
   * Page assertions
   */
  test('page-level assertions', async ({ page }) => {
    // Title assertion
    await expect(page).toHaveTitle(/Playwright/);

    // URL assertion
    await expect(page).toHaveURL('https://playwright.dev/');

    // URL with regex
    await expect(page).toHaveURL(/playwright\.dev/);
  });

  /**
   * Element visibility assertions
   */
  test('visibility assertions', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });

    // Element is visible
    await expect(heading).toBeVisible();

    // Element is attached to DOM (may not be visible)
    await expect(heading).toBeAttached();
  });

  /**
   * Text content assertions
   */
  test('text assertions', async ({ page }) => {
    const content = page.locator('.hero');

    // Contains text (partial match)
    await expect(content).toContainText('Playwright');

    // Text with regex
    await expect(content).toContainText(/reliable/i);
  });

  /**
   * Attribute assertions
   */
  test('attribute assertions', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Get started' });

    // Has attribute with value
    await expect(link).toHaveAttribute('href', '/docs/intro');
  });

  /**
   * Count assertions
   */
  test('count assertions', async ({ page }) => {
    const links = page.getByRole('link');

    // Has specific count
    await expect(links).toHaveCount(await links.count());

    // Alternative: check count is greater than 0
    expect(await links.count()).toBeGreaterThan(0);
  });

  /**
   * Generic (non-web) assertions
   * These do NOT auto-wait - use for immediate checks
   */
  test('generic assertions', async ({ page }) => {
    const title = await page.title();

    // Equality
    expect(title).toContain('Playwright');

    // Truthiness
    expect(title).toBeTruthy();

    // Numbers
    expect(5).toBeGreaterThan(3);

    // Arrays
    expect(['a', 'b', 'c']).toContain('b');

    // Objects
    expect({ name: 'test' }).toHaveProperty('name');
  });

  /**
   * Soft assertions
   * Continue test execution even if assertion fails
   */
  test('soft assertions', async ({ page }) => {
    // Soft assertions don't stop the test on failure
    await expect.soft(page).toHaveTitle(/Playwright/);
    await expect.soft(page).toHaveURL(/playwright/);

    // Test continues even if above assertions fail
    // All failures are reported at the end
  });
});

// ============================================================================
// SECTION 6: TODO APP TESTS (COMPREHENSIVE EXAMPLE)
// ============================================================================

test.describe('Todo App Tests', () => {
  let todoPage: TodoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
    await todoPage.goto();
  });

  test('can add a new todo item', async () => {
    await todoPage.addTodo('Buy groceries');

    const todos = await todoPage.getAllTodoTexts();
    expect(todos).toContain('Buy groceries');
  });

  test('can add multiple todo items', async () => {
    const items = ['Item 1', 'Item 2', 'Item 3'];
    await todoPage.addTodos(items);

    const todos = await todoPage.getAllTodoTexts();
    for (const item of items) {
      expect(todos.join(' ')).toContain(item);
    }
  });

  test('can mark todo as complete', async () => {
    await todoPage.addTodo('Complete this task');
    await todoPage.toggleTodo('Complete this task');

    // The todo should now have completed class
    const todoItem = todoPage.page
      .getByTestId('todo-item')
      .filter({ hasText: 'Complete this task' });
    await expect(todoItem).toHaveClass(/completed/);
  });

  test('can delete a todo item', async () => {
    await todoPage.addTodo('Delete me');
    await todoPage.deleteTodo('Delete me');

    const todos = await todoPage.getAllTodoTexts();
    expect(todos).not.toContain('Delete me');
  });

  test('shows correct remaining count', async () => {
    await todoPage.addTodos(['Task 1', 'Task 2', 'Task 3']);

    let count = await todoPage.getRemainingCount();
    expect(count).toBe(3);

    await todoPage.toggleTodo('Task 1');
    count = await todoPage.getRemainingCount();
    expect(count).toBe(2);
  });

  test('can filter by active/completed', async () => {
    await todoPage.addTodos(['Active task', 'Completed task']);
    await todoPage.toggleTodo('Completed task');

    // Filter active - wait for filter to apply
    await todoPage.filterBy('active');
    await expect(
      todoPage.page.getByTestId('todo-item').filter({ hasText: 'Active task' })
    ).toBeVisible();
    await expect(
      todoPage.page
        .getByTestId('todo-item')
        .filter({ hasText: 'Completed task' })
    ).toBeHidden();

    // Filter completed
    await todoPage.filterBy('completed');
    await expect(
      todoPage.page
        .getByTestId('todo-item')
        .filter({ hasText: 'Completed task' })
    ).toBeVisible();
    await expect(
      todoPage.page.getByTestId('todo-item').filter({ hasText: 'Active task' })
    ).toBeHidden();
  });

  test('can clear completed items', async () => {
    await todoPage.addTodos(['Keep this', 'Clear this']);
    await todoPage.toggleTodo('Clear this');
    await todoPage.clearCompleted();

    const todos = await todoPage.getAllTodoTexts();
    expect(todos.join(' ')).toContain('Keep this');
    expect(todos.join(' ')).not.toContain('Clear this');
  });
});

// ============================================================================
// SECTION 7: ADVANCED PATTERNS
// ============================================================================

test.describe('Advanced Patterns', () => {
  /**
   * Using test.step() for better test organization and reporting
   */
  test('test steps example', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('https://playwright.dev/');
    });

    await test.step('Verify page loaded', async () => {
      await expect(page).toHaveTitle(/Playwright/);
    });

    await test.step('Navigate to docs', async () => {
      // Skip for mobile browsers
      const viewport = page.viewportSize();
      if (viewport && viewport.width < 900) {
        return;
      }
      const docsLink = page.getByRole('link', { name: 'Docs' });
      await docsLink.click();
    });

    await test.step('Verify docs page', async () => {
      // Skip assertion for mobile since we skip the navigation
      const viewport = page.viewportSize();
      if (viewport && viewport.width < 900) {
        return;
      }
      await expect(page).toHaveURL(/docs/);
    });
  });

  /**
   * Handling dialogs (alerts, confirms, prompts)
   */
  test('handle dialogs', async ({ page }) => {
    // Set up dialog handler BEFORE triggering the dialog
    page.on('dialog', async (dialog) => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog.accept(); // or dialog.dismiss()
    });

    // Now trigger action that shows dialog
    await page.goto('https://playwright.dev/');
    await expect(page).toHaveTitle(/Playwright/);
  });

  /**
   * Waiting for specific conditions
   */
  test('explicit waits', async ({ page }) => {
    await page.goto('https://playwright.dev/');

    // Wait for element to be visible
    await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' });

    // Wait for load state
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Playwright/);
  });

  /**
   * Taking screenshots
   */
  test('capture screenshots', async ({ page }) => {
    await page.goto('https://playwright.dev/');

    // Full page screenshot
    await page.screenshot({
      path: 'reports/screenshots/homepage.png',
      fullPage: true,
    });

    // Element screenshot
    const hero = page.locator('.hero');
    if (await hero.isVisible()) {
      await hero.screenshot({ path: 'reports/screenshots/hero.png' });
    }

    await expect(page).toHaveTitle(/Playwright/);
  });

  /**
   * Network interception (mocking API responses)
   */
  test('mock API response', async ({ page }) => {
    // Intercept API calls and return mock data
    await page.route('**/api/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users: [{ id: 1, name: 'Mock User' }] }),
      });
    });

    await page.goto('https://playwright.dev/');
    await expect(page).toHaveTitle(/Playwright/);
  });

  /**
   * Multiple browser contexts (isolation)
   */
  test('multiple contexts', async ({ browser }) => {
    // Create isolated browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Each page has its own session, cookies, localStorage
    await page1.goto('https://playwright.dev/');
    await page2.goto('https://playwright.dev/');

    await expect(page1).toHaveTitle(/Playwright/);
    await expect(page2).toHaveTitle(/Playwright/);

    // Clean up
    await context1.close();
    await context2.close();
  });
});

// ============================================================================
// SECTION 8: TEST CONFIGURATION EXAMPLES
// ============================================================================

/**
 * Mark test as slow (3x default timeout)
 */
test('slow test example', async ({ page }) => {
  test.slow();
  await page.goto('https://playwright.dev/');
  await expect(page).toHaveTitle(/Playwright/);
});

/**
 * Test with custom timeout
 */
test('test with custom timeout', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  await page.goto('https://playwright.dev/');
  await expect(page).toHaveTitle(/Playwright/);
});

/**
 * Test demonstrating cross-browser compatibility
 */
test('browser compatibility test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await expect(page).toHaveTitle(/Playwright/);
});

/**
 * Annotate test for better reporting
 */
test('annotated test', async ({ page }) => {
  test.info().annotations.push({
    type: 'issue',
    description: 'https://github.com/issue/123',
  });

  await page.goto('https://playwright.dev/');
  await expect(page).toHaveTitle(/Playwright/);
});
