/**
 * Page Actions - Wrapper functions around Playwright API
 *
 * This module provides high-level wrapper functions that abstract
 * common Playwright operations. Following MCP best practices for
 * separating browser logic from transport/tool definitions.
 *
 * **Design Principles:**
 * - Use Playwright's recommended locator strategies
 * - Auto-waiting is built into all interactions
 * - Consistent error propagation for upstream handling
 * - Single responsibility - each function does one thing well
 *
 * **Locator Priority (Playwright Best Practices):**
 * 1. getByRole() - Best for interactive elements, reflects accessibility
 * 2. getByLabel() - Best for form inputs with labels
 * 3. getByPlaceholder() - For inputs without visible labels
 * 4. getByText() - For elements identified by text content
 * 5. getByTestId() - For stable test automation selectors
 * 6. CSS/XPath - Last resort, avoid when possible
 *
 * **Benefits:**
 * - Consistent error handling across all operations
 * - Reusable across different MCP tools
 * - Easy to test in isolation
 * - Single point for adding logging, metrics, etc.
 *
 * @see https://playwright.dev/docs/locators
 * @see https://playwright.dev/docs/best-practices
 */
import type { Page } from 'playwright';

import { timeoutOptions } from '../config/playwright-config.js';
import type {
  AriaRole,
  KeyModifier,
  MouseButton,
  WaitUntilState,
} from '../types/index.js';

// ============================================
// Navigation Actions
// ============================================

/**
 * Navigate to a URL with configurable wait conditions
 */
export async function navigateTo(
  page: Page,
  url: string,
  options: { waitUntil?: WaitUntilState; timeout?: number } = {}
): Promise<{ url: string; title: string }> {
  const { waitUntil = 'load', timeout = timeoutOptions.navigation } = options;

  await page.goto(url, { waitUntil, timeout });

  return {
    url: page.url(),
    title: await page.title(),
  };
}

/**
 * Navigate back in browser history
 */
export async function navigateBack(
  page: Page,
  options: { timeout?: number } = {}
): Promise<{ url: string }> {
  const { timeout = timeoutOptions.navigation } = options;

  await page.goBack({ timeout });

  return { url: page.url() };
}

/**
 * Navigate forward in browser history
 */
export async function navigateForward(
  page: Page,
  options: { timeout?: number } = {}
): Promise<{ url: string }> {
  const { timeout = timeoutOptions.navigation } = options;

  await page.goForward({ timeout });

  return { url: page.url() };
}

/**
 * Reload the current page
 */
export async function reload(
  page: Page,
  options: { waitUntil?: WaitUntilState; timeout?: number } = {}
): Promise<{ url: string; title: string }> {
  const { waitUntil = 'load', timeout = timeoutOptions.navigation } = options;

  await page.reload({ waitUntil, timeout });

  return {
    url: page.url(),
    title: await page.title(),
  };
}

// ============================================
// Element Interaction Actions
// ============================================

/**
 * Click on an element using a CSS selector
 */
export async function clickElement(
  page: Page,
  selector: string,
  options: {
    force?: boolean;
    button?: MouseButton;
    clickCount?: number;
    modifiers?: KeyModifier[];
    delay?: number;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.action, ...clickOptions } = options;

  await page.locator(selector).click({ ...clickOptions, timeout });

  return { success: true };
}

/**
 * Click on an element by its ARIA role.
 *
 * **This is the most recommended locator strategy by Playwright.**
 *
 * Role-based locators are resilient to DOM changes and ensure accessibility.
 * They reflect how users and assistive technologies perceive the page.
 *
 * @see https://playwright.dev/docs/locators#locate-by-role
 *
 * @param page - Playwright Page instance
 * @param role - ARIA role (button, link, checkbox, textbox, etc.)
 * @param options - Locator and click options
 *
 * @example
 * ```typescript
 * // Click submit button
 * await clickByRole(page, 'button', { name: 'Submit' });
 *
 * // Click link with exact text
 * await clickByRole(page, 'link', { name: 'Learn more', exact: true });
 * ```
 */
export async function clickByRole(
  page: Page,
  role: AriaRole,
  options: {
    name?: string;
    exact?: boolean;
    force?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { name, exact, force, timeout = timeoutOptions.action } = options;

  const locator = page.getByRole(role, { name, exact });
  await locator.click({ force, timeout });

  return { success: true };
}

/**
 * Click on an element by its text content.
 *
 * Uses Playwright's getByText() locator which finds elements containing
 * the specified text. By default, it matches substrings case-sensitively.
 *
 * @see https://playwright.dev/docs/locators#locate-by-text
 *
 * @param page - Playwright Page instance
 * @param text - Text content to search for
 * @param options - Match and click options
 *
 * @example
 * ```typescript
 * // Click element containing "Welcome"
 * await clickByText(page, 'Welcome');
 *
 * // Click with exact text match
 * await clickByText(page, 'Click me', { exact: true });
 * ```
 */
export async function clickByText(
  page: Page,
  text: string,
  options: {
    exact?: boolean;
    force?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { exact, force, timeout = timeoutOptions.action } = options;

  const locator = page.getByText(text, { exact });
  await locator.click({ force, timeout });

  return { success: true };
}

/**
 * Click on an element by data-testid.
 *
 * **Use when semantic locators aren't suitable.**
 * Test IDs provide stable selectors independent of implementation.
 *
 * @see https://playwright.dev/docs/locators#locate-by-test-id
 *
 * @param page - Playwright Page instance
 * @param testId - Value of the data-testid attribute
 * @param options - Click options
 *
 * @example
 * ```typescript
 * // HTML: <button data-testid="submit-btn">Submit</button>
 * await clickByTestId(page, 'submit-btn');
 * ```
 */
export async function clickByTestId(
  page: Page,
  testId: string,
  options: {
    force?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { force, timeout = timeoutOptions.action } = options;

  const locator = page.getByTestId(testId);
  await locator.click({ force, timeout });

  return { success: true };
}

/**
 * Fill an input field with text
 */
export async function fillInput(
  page: Page,
  selector: string,
  text: string,
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.action } = options;

  await page.fill(selector, text, { timeout });

  return { success: true };
}

/**
 * Fill an input by its label.
 *
 * **Recommended for form inputs** - matches how users identify form fields.
 *
 * Works with:
 * - <label for="id"> associations
 * - Inputs nested inside <label>
 * - aria-labelledby references
 * - aria-label attributes
 *
 * @see https://playwright.dev/docs/locators#locate-by-label
 *
 * @param page - Playwright Page instance
 * @param label - Label text to match
 * @param text - Text to fill into the input
 * @param options - Match and fill options
 *
 * @example
 * ```typescript
 * // Fill input labeled "Email"
 * await fillByLabel(page, 'Email', 'user@example.com');
 *
 * // With exact matching
 * await fillByLabel(page, 'Password', 'secret', { exact: true });
 * ```
 */
export async function fillByLabel(
  page: Page,
  label: string,
  text: string,
  options: {
    exact?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { exact, timeout = timeoutOptions.action } = options;

  const locator = page.getByLabel(label, { exact });
  await locator.fill(text, { timeout });

  return { success: true };
}

/**
 * Fill an input by its placeholder.
 *
 * **Use when labels aren't available.**
 * Placeholder text provides a reasonable fallback for identifying inputs.
 *
 * @see https://playwright.dev/docs/locators#locate-by-placeholder
 *
 * @param page - Playwright Page instance
 * @param placeholder - Placeholder attribute text
 * @param text - Text to fill into the input
 * @param options - Match and fill options
 *
 * @example
 * ```typescript
 * // Fill input with placeholder "Enter email..."
 * await fillByPlaceholder(page, 'Enter email...', 'user@example.com');
 * ```
 */
export async function fillByPlaceholder(
  page: Page,
  placeholder: string,
  text: string,
  options: {
    exact?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean }> {
  const { exact, timeout = timeoutOptions.action } = options;

  const locator = page.getByPlaceholder(placeholder, { exact });
  await locator.fill(text, { timeout });

  return { success: true };
}

/**
 * Hover over an element
 */
export async function hoverElement(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.action } = options;

  await page.hover(selector, { timeout });

  return { success: true };
}

/**
 * Select an option from a dropdown
 */
export async function selectOption(
  page: Page,
  selector: string,
  value: string | string[],
  options: { timeout?: number } = {}
): Promise<{ success: boolean; selected: string[] }> {
  const { timeout = timeoutOptions.action } = options;

  const selected = await page.selectOption(selector, value, { timeout });

  return { success: true, selected };
}

/**
 * Check or uncheck a checkbox/radio
 */
export async function setChecked(
  page: Page,
  selector: string,
  checked: boolean,
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.action } = options;

  await page.setChecked(selector, checked, { timeout });

  return { success: true };
}

// ============================================
// Keyboard Actions
// ============================================

/**
 * Press a key or key combination
 */
export async function pressKey(
  page: Page,
  key: string,
  options: { delay?: number } = {}
): Promise<{ success: boolean }> {
  await page.keyboard.press(key, options);

  return { success: true };
}

/**
 * Type text character by character
 */
export async function typeText(
  page: Page,
  text: string,
  options: { delay?: number } = {}
): Promise<{ success: boolean }> {
  await page.keyboard.type(text, options);

  return { success: true };
}

// ============================================
// Mouse Actions
// ============================================

/**
 * Move mouse to coordinates
 */
export async function moveMouse(
  page: Page,
  x: number,
  y: number,
  options: { steps?: number } = {}
): Promise<{ success: boolean }> {
  await page.mouse.move(x, y, options);

  return { success: true };
}

/**
 * Click at coordinates
 */
export async function clickAt(
  page: Page,
  x: number,
  y: number,
  options: {
    button?: MouseButton;
    clickCount?: number;
    delay?: number;
  } = {}
): Promise<{ success: boolean }> {
  await page.mouse.click(x, y, options);

  return { success: true };
}

/**
 * Drag and drop from source to target
 */
export async function dragAndDrop(
  page: Page,
  source: string,
  target: string,
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.action } = options;

  await page.dragAndDrop(source, target, { timeout });

  return { success: true };
}

// ============================================
// Wait Actions
// ============================================

/**
 * Wait for a selector to be in a specific state using locator.waitFor().
 *
 * **Best Practice**: Use locator.waitFor() instead of page.waitForSelector()
 * as it's the recommended approach and handles auto-retry better.
 *
 * @see https://playwright.dev/docs/api/class-locator#locator-wait-for
 */
export async function waitForSelector(
  page: Page,
  selector: string,
  options: {
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
    timeout?: number;
  } = {}
): Promise<{ found: boolean }> {
  const { state = 'visible', timeout = timeoutOptions.action } = options;

  try {
    // Use locator.waitFor() as recommended by Playwright docs
    await page.locator(selector).waitFor({ state, timeout });
    return { found: true };
  } catch {
    return { found: false };
  }
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(
  page: Page,
  options: {
    url?: string | RegExp;
    waitUntil?: WaitUntilState;
    timeout?: number;
  } = {}
): Promise<{ url: string }> {
  const { timeout = timeoutOptions.navigation, ...waitOptions } = options;

  await page.waitForURL(waitOptions.url ?? '**/*', { timeout, ...waitOptions });

  return { url: page.url() };
}

/**
 * Wait for page load state
 */
export async function waitForLoadState(
  page: Page,
  state: 'load' | 'domcontentloaded' | 'networkidle' = 'load',
  options: { timeout?: number } = {}
): Promise<{ success: boolean }> {
  const { timeout = timeoutOptions.navigation } = options;

  await page.waitForLoadState(state, { timeout });

  return { success: true };
}

// ============================================
// Page Content Actions
// ============================================

/**
 * Get page HTML content
 */
export async function getContent(
  page: Page
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    page.content(),
    page.innerText('body').catch(() => ''),
  ]);

  return { html, text };
}

/**
 * Take a screenshot
 */
export async function takeScreenshot(
  page: Page,
  options: {
    path?: string;
    fullPage?: boolean;
    type?: 'png' | 'jpeg';
    quality?: number;
  } = {}
): Promise<{ base64?: string; path?: string }> {
  const buffer = await page.screenshot(options);

  return {
    base64: buffer.toString('base64'),
    path: options.path,
  };
}

/**
 * Generate PDF (Chromium only)
 */
export async function generatePdf(
  page: Page,
  options: {
    path?: string;
    format?: 'A4' | 'Letter' | 'Legal';
    landscape?: boolean;
    printBackground?: boolean;
  } = {}
): Promise<{ base64?: string; path?: string }> {
  const buffer = await page.pdf(options);

  return {
    base64: buffer.toString('base64'),
    path: options.path,
  };
}

/**
 * Execute JavaScript in page context
 */
export async function evaluate<T>(
  page: Page,
  script: string | ((arg: unknown) => T),
  arg?: unknown
): Promise<{ result: T }> {
  const result = await page.evaluate(script as (arg: unknown) => T, arg);

  return { result };
}

// ============================================
// Element Info Actions
// ============================================

/**
 * Get element information
 */
export async function getElementInfo(
  page: Page,
  selector: string
): Promise<Record<string, unknown> | null> {
  const locator = page.locator(selector).first();

  if ((await locator.count()) === 0) return null;

  const [tagName, textContent, attributes, boundingBox, isVisible, isEnabled] =
    await Promise.all([
      locator.evaluate((el: Element) => el.tagName.toLowerCase()),
      locator.textContent(),
      locator.evaluate((el: Element) => {
        const attrs: Record<string, string> = {};
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes.item(i);
          if (attr) {
            attrs[attr.name] = attr.value;
          }
        }
        return attrs;
      }),
      locator.boundingBox(),
      locator.isVisible(),
      locator.isEnabled(),
    ]);

  return {
    tagName,
    textContent: textContent?.trim() ?? '',
    attributes,
    boundingBox,
    isVisible,
    isEnabled,
  };
}

/**
 * Get all matching elements count
 */
export async function getElementCount(
  page: Page,
  selector: string
): Promise<{ count: number }> {
  const locator = page.locator(selector);
  const count = await locator.count();

  return { count };
}
