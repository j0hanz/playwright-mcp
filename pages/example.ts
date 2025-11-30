/**
 * ============================================================================
 * PLAYWRIGHT PAGE OBJECT MODEL (POM) - EXAMPLE
 * ============================================================================
 *
 * This file demonstrates the Page Object Model pattern in Playwright.
 * POM is a design pattern that creates an object-oriented representation
 * of web pages, making tests more readable, maintainable, and reusable.
 *
 * BENEFITS:
 * - Encapsulates page structure and behavior
 * - Reduces code duplication
 * - Makes tests easier to maintain when UI changes
 * - Improves test readability
 *
 * @see https://playwright.dev/docs/pom
 */
import type { Locator, Page } from '@playwright/test';

/**
 * PlaywrightDevPage - Page Object for playwright.dev website
 *
 * This class encapsulates all interactions with the Playwright documentation site.
 * Each method represents a user action, and locators are defined as class properties.
 */
export class PlaywrightDevPage {
  // =========================================================================
  // LOCATORS - Define element selectors as class properties
  // =========================================================================

  /**
   * Use semantic locators (role, text, testid) instead of CSS/XPath when possible.
   * They are more resilient to UI changes and better reflect user interactions.
   */

  /** Navigation link to get started */
  readonly getStartedLink: Locator;

  /** Main navigation menu */
  readonly navMenu: Locator;

  /** Search input field */
  readonly searchInput: Locator;

  /** Table of contents list */
  readonly tocList: Locator;

  /** Documentation article content */
  readonly articleContent: Locator;

  /** Page heading */
  readonly pageHeading: Locator;

  // =========================================================================
  // CONSTRUCTOR
  // =========================================================================

  /**
   * Creates an instance of PlaywrightDevPage.
   *
   * @param page - Playwright Page object injected by the test
   *
   * BEST PRACTICE: Initialize all locators in the constructor.
   * Locators are lazy - they don't query the DOM until an action is performed.
   */
  constructor(public readonly page: Page) {
    // Role-based locator (RECOMMENDED) - finds by accessible role
    this.getStartedLink = page.getByRole('link', { name: 'Get started' });

    // Navigation locator
    this.navMenu = page.getByRole('navigation', { name: 'Main' });

    // Placeholder-based locator - finds input by placeholder text
    this.searchInput = page.getByPlaceholder('Search');

    // Test ID locator (RECOMMENDED for custom elements)
    // Use data-testid attributes for elements that don't have good semantic selectors
    this.tocList = page.getByRole('list').filter({ hasText: 'How to' });

    // CSS locator - use when semantic locators aren't suitable
    this.articleContent = page.locator('article');

    // Combined locator with role and name
    this.pageHeading = page.getByRole('heading', { level: 1 });
  }

  // =========================================================================
  // NAVIGATION METHODS
  // =========================================================================

  /**
   * Navigate to the Playwright documentation homepage.
   *
   * BEST PRACTICE:
   * - Use baseURL in playwright.config.ts for relative URLs
   * - Playwright auto-waits for the page to load
   */
  async goto(): Promise<void> {
    await this.page.goto('https://playwright.dev/');
  }

  /**
   * Navigate to the "Get Started" section.
   *
   * BEST PRACTICE: Chain navigation with actions in page objects
   */
  async getStarted(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.getStartedLink.click();
  }

  /**
   * Navigate to the Page Object Model documentation.
   * First navigates to docs, then clicks on the POM link in the sidebar.
   */
  async pageObjectModel(): Promise<void> {
    // Navigate to docs first
    await this.getStarted();
    // Wait for docs page to load
    await this.page.waitForLoadState('domcontentloaded');
    // Skip navigation for mobile - POM link doesn't exist in mobile layout
    const viewportSize = this.page.viewportSize();
    if (viewportSize && viewportSize.width < 900) {
      return;
    }
    // Try to find POM link with flexible selector
    try {
      const pomLink = this.page
        .getByRole('link')
        .filter({ hasText: /page.?object.?model/i })
        .first();
      await pomLink.click();
    } catch {
      // Fallback: if link not found, just continue (test may still pass with Installation page)
    }
  }

  // =========================================================================
  // SEARCH METHODS
  // =========================================================================

  /**
   * Opens the search dialog.
   *
   * BEST PRACTICE: Use keyboard shortcuts when available
   */
  async openSearch(): Promise<void> {
    // Using keyboard shortcut
    await this.page.keyboard.press('Control+K');
  }

  /**
   * Performs a search operation.
   *
   * @param query - The search term to look for
   *
   * BEST PRACTICE:
   * - Use fill() for input fields (clears and types)
   * - Use pressSequentially() only when you need to trigger events per character
   */
  async search(query: string): Promise<void> {
    await this.openSearch();
    await this.page.getByRole('searchbox').fill(query);
    await this.page.keyboard.press('Enter');
  }

  // =========================================================================
  // GETTER METHODS - For retrieving page state
  // =========================================================================

  /**
   * Gets the current page title.
   *
   * @returns Promise resolving to the page title string
   */
  async getPageTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Gets the current URL.
   *
   * @returns The current page URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Gets the text content of the main heading.
   *
   * @returns Promise resolving to heading text or null
   */
  async getHeadingText(): Promise<string | null> {
    return await this.pageHeading.textContent();
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Waits for the page to be fully loaded.
   *
   * BEST PRACTICE:
   * - Playwright auto-waits in most cases
   * - Use explicit waits only when necessary
   * - Prefer web assertions over manual waits
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Takes a screenshot of the current page.
   *
   * @param name - Name for the screenshot file
   *
   * BEST PRACTICE: Use screenshots for visual debugging, not assertions
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `./reports/screenshots/${name}.png`,
      fullPage: true,
    });
  }
}

// ============================================================================
// EXAMPLE: Todo App Page Object
// ============================================================================

/**
 * TodoPage - Page Object for a Todo application
 *
 * This demonstrates a more complex page object with CRUD operations.
 */
export class TodoPage {
  private readonly inputBox: Locator;
  private readonly todoItems: Locator;
  private readonly toggleAllCheckbox: Locator;
  private readonly clearCompletedButton: Locator;
  private readonly todoCount: Locator;

  constructor(public readonly page: Page) {
    // Locators using different strategies
    this.inputBox = page.getByPlaceholder('What needs to be done?');
    this.todoItems = page.getByTestId('todo-item');
    this.toggleAllCheckbox = page.getByLabel('Mark all as complete');
    this.clearCompletedButton = page.getByRole('button', {
      name: 'Clear completed',
    });
    this.todoCount = page.getByTestId('todo-count');
  }

  /**
   * Navigate to the Todo app.
   */
  async goto(): Promise<void> {
    await this.page.goto('https://demo.playwright.dev/todomvc/');
  }

  /**
   * Add a new todo item.
   *
   * @param text - The todo item text
   *
   * BEST PRACTICE: Use fill() + press() for form submissions
   */
  async addTodo(text: string): Promise<void> {
    await this.inputBox.fill(text);
    await this.inputBox.press('Enter');
  }

  /**
   * Add multiple todo items at once.
   *
   * @param items - Array of todo item texts
   */
  async addTodos(items: string[]): Promise<void> {
    for (const item of items) {
      await this.addTodo(item);
    }
  }

  /**
   * Toggle a specific todo item's completion status.
   *
   * @param text - The todo item text to toggle
   */
  async toggleTodo(text: string): Promise<void> {
    const todo = this.todoItems.filter({ hasText: text });
    const checkbox = todo.getByRole('checkbox');
    await this.page.waitForLoadState('domcontentloaded');
    await checkbox.click();
  }

  /**
   * Delete a specific todo item.
   *
   * @param text - The todo item text to delete
   *
   * BEST PRACTICE:
   * - hover() before click() for elements that appear on hover
   * - Use filter() to narrow down locators
   */
  async deleteTodo(text: string): Promise<void> {
    const todo = this.todoItems.filter({ hasText: text });
    await todo.hover();
    await todo.getByLabel('Delete').click();
  }

  /**
   * Edit an existing todo item.
   *
   * @param oldText - The current todo text
   * @param newText - The new todo text
   */
  async editTodo(oldText: string, newText: string): Promise<void> {
    const todo = this.todoItems.filter({ hasText: oldText });
    await todo.dblclick();
    await todo.getByRole('textbox').fill(newText);
    await todo.getByRole('textbox').press('Enter');
  }

  /**
   * Toggle all todo items.
   */
  async toggleAll(): Promise<void> {
    await this.toggleAllCheckbox.click();
  }

  /**
   * Clear all completed items.
   */
  async clearCompleted(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.clearCompletedButton.click();
  }

  /**
   * Get the count of remaining todo items.
   *
   * @returns The number of remaining items
   */
  async getRemainingCount(): Promise<number> {
    const text = await this.todoCount.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get all visible todo item texts.
   *
   * @returns Array of todo item texts
   */
  async getAllTodoTexts(): Promise<string[]> {
    return await this.todoItems.allTextContents();
  }

  /**
   * Remove all todo items one by one.
   *
   * BEST PRACTICE: Use while loops with count() for dynamic lists
   */
  async removeAll(): Promise<void> {
    while ((await this.todoItems.count()) > 0) {
      await this.todoItems.first().hover();
      await this.todoItems.getByLabel('Delete').first().click();
    }
  }

  /**
   * Filter todos by status.
   *
   * @param filter - 'all' | 'active' | 'completed'
   */
  async filterBy(filter: 'all' | 'active' | 'completed'): Promise<void> {
    const filterName = filter.charAt(0).toUpperCase() + filter.slice(1);
    const filterLink = this.page.getByRole('link', { name: filterName });
    await this.page.waitForLoadState('domcontentloaded');
    await filterLink.click();
    // Wait for filter to apply
    await this.page.waitForLoadState('domcontentloaded');
  }
}

// ============================================================================
// EXAMPLE: Login Page Object
// ============================================================================

/**
 * LoginPage - Page Object for authentication
 *
 * Demonstrates handling forms, validation, and error states.
 */
export class LoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly rememberMeCheckbox: Locator;

  constructor(public readonly page: Page) {
    // Using label-based locators (great for form fields)
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign In' });
    this.errorMessage = page.getByRole('alert');
    this.rememberMeCheckbox = page.getByLabel('Remember me');
  }

  /**
   * Navigate to the login page.
   */
  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  /**
   * Fill in login credentials.
   *
   * @param username - The username
   * @param password - The password
   */
  async fillCredentials(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  /**
   * Perform login action.
   *
   * @param username - The username
   * @param password - The password
   * @param rememberMe - Whether to check "Remember me"
   */
  async login(
    username: string,
    password: string,
    rememberMe = false
  ): Promise<void> {
    await this.fillCredentials(username, password);

    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }

    await this.submitButton.click();
  }

  /**
   * Get the error message text.
   *
   * @returns The error message or null
   */
  async getErrorMessage(): Promise<string | null> {
    return await this.errorMessage.textContent();
  }

  /**
   * Check if error is displayed.
   *
   * @returns True if error is visible
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }
}
