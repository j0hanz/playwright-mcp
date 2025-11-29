/**
 * Selector Utilities
 *
 * Utilities for building robust locators following Playwright best practices.
 * Prioritizes user-facing attributes over implementation details.
 *
 * @see https://playwright.dev/docs/best-practices#use-locators
 */
import type { Locator, Page } from 'playwright';

import type { AriaRole } from '../../types/index.js';

// ============================================
// Locator Priority (Playwright Best Practices)
// ============================================
// 1. getByRole - ARIA roles (most resilient)
// 2. getByLabel - Form inputs by label
// 3. getByPlaceholder - Inputs by placeholder
// 4. getByText - Content-based selection
// 5. getByTestId - data-testid attribute
// 6. CSS/XPath - Last resort
// ============================================

/**
 * Create a role-based locator (highest priority)
 * Most resilient to DOM changes
 */
export function byRole(
  page: Page,
  role: AriaRole,
  options?: { name?: string | RegExp; exact?: boolean }
): Locator {
  return page.getByRole(role, options);
}

/**
 * Create a label-based locator for form inputs
 */
export function byLabel(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return page.getByLabel(text, options);
}

/**
 * Create a placeholder-based locator for inputs
 */
export function byPlaceholder(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return page.getByPlaceholder(text, options);
}

/**
 * Create a text-based locator
 */
export function byText(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return page.getByText(text, options);
}

/**
 * Create a test ID locator (data-testid attribute)
 */
export function byTestId(page: Page, testId: string | RegExp): Locator {
  return page.getByTestId(testId);
}

/**
 * Create an alt text locator for images
 */
export function byAltText(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return page.getByAltText(text, options);
}

/**
 * Create a title attribute locator
 */
export function byTitle(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return page.getByTitle(text, options);
}

/**
 * Create a CSS selector locator (use sparingly)
 */
export function bySelector(page: Page, selector: string): Locator {
  return page.locator(selector);
}

// ============================================
// Composite Locator Builders
// ============================================

/**
 * Find a button by its text content
 */
export function button(
  page: Page,
  name: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('button', { name, exact });
}

/**
 * Find a link by its text content
 */
export function link(
  page: Page,
  name: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('link', { name, exact });
}

/**
 * Find a heading by its text and level
 */
export function heading(
  page: Page,
  name: string | RegExp,
  options?: { level?: 1 | 2 | 3 | 4 | 5 | 6; exact?: boolean }
): Locator {
  return page.getByRole('heading', { name, ...options });
}

/**
 * Find a textbox/input by name
 */
export function textbox(
  page: Page,
  name?: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('textbox', name ? { name, exact } : undefined);
}

/**
 * Find a checkbox by name
 */
export function checkbox(
  page: Page,
  name?: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('checkbox', name ? { name, exact } : undefined);
}

/**
 * Find a radio button by name
 */
export function radio(
  page: Page,
  name?: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('radio', name ? { name, exact } : undefined);
}

/**
 * Find a combobox/select by name
 */
export function combobox(
  page: Page,
  name?: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('combobox', name ? { name, exact } : undefined);
}

/**
 * Find a list item by text
 */
export function listitem(
  page: Page,
  name?: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('listitem', name ? { name, exact } : undefined);
}

/**
 * Find a navigation element by name
 */
export function navigation(page: Page, name?: string | RegExp): Locator {
  return page.getByRole('navigation', name ? { name } : undefined);
}

/**
 * Find a dialog/modal by name
 */
export function dialog(page: Page, name?: string | RegExp): Locator {
  return page.getByRole('dialog', name ? { name } : undefined);
}

/**
 * Find an alert by name
 */
export function alert(page: Page, name?: string | RegExp): Locator {
  return page.getByRole('alert', name ? { name } : undefined);
}

/**
 * Find a tab by name
 */
export function tab(page: Page, name: string | RegExp, exact = false): Locator {
  return page.getByRole('tab', { name, exact });
}

/**
 * Find a menu item by name
 */
export function menuitem(
  page: Page,
  name: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('menuitem', { name, exact });
}

// ============================================
// Locator Chain Helpers
// ============================================

/**
 * Filter a locator by text content
 */
export function filterByText(
  locator: Locator,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return locator.filter({ hasText: text, ...options });
}

/**
 * Filter a locator to exclude text content
 */
export function filterByNotText(
  locator: Locator,
  text: string | RegExp
): Locator {
  return locator.filter({ hasNotText: text });
}

/**
 * Filter a locator by having a child element
 */
export function filterByChild(locator: Locator, child: Locator): Locator {
  return locator.filter({ has: child });
}

/**
 * Filter a locator by NOT having a child element
 */
export function filterByNotChild(locator: Locator, child: Locator): Locator {
  return locator.filter({ hasNot: child });
}

/**
 * Get the nth element from a locator
 */
export function nth(locator: Locator, index: number): Locator {
  return locator.nth(index);
}

/**
 * Get the first element from a locator
 */
export function first(locator: Locator): Locator {
  return locator.first();
}

/**
 * Get the last element from a locator
 */
export function last(locator: Locator): Locator {
  return locator.last();
}

// ============================================
// Frame Locators
// ============================================

/**
 * Create a frame locator by selector
 */
export function frame(page: Page, selector: string) {
  return page.frameLocator(selector);
}

/**
 * Create a frame locator by name or URL
 */
export function frameByNameOrUrl(
  page: Page,
  options: { name?: string; url?: string | RegExp }
) {
  return page.frame(options);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Build a CSS selector from parts
 * @example cssSelector('button', { class: 'primary', 'data-action': 'submit' })
 * // Returns: button.primary[data-action="submit"]
 */
export function cssSelector(
  tag: string,
  attributes: Record<string, string | boolean> = {}
): string {
  let selector = tag;

  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'class' && typeof value === 'string') {
      // Class names are prefixed with dot
      selector += value
        .split(' ')
        .map((c) => `.${c}`)
        .join('');
    } else if (key === 'id' && typeof value === 'string') {
      // ID is prefixed with hash
      selector += `#${value}`;
    } else if (typeof value === 'boolean' && value) {
      // Boolean attributes (e.g., disabled)
      selector += `[${key}]`;
    } else if (typeof value === 'string') {
      // Regular attribute
      selector += `[${key}="${value}"]`;
    }
  }

  return selector;
}

/**
 * Build an XPath expression (use sparingly)
 * @example xpath('//button[contains(text(), "Submit")]')
 */
export function xpath(expression: string): string {
  return `xpath=${expression}`;
}

/**
 * Check if a selector is valid
 */
export function isValidSelector(selector: string): boolean {
  try {
    // Try to create a selector - this will throw if invalid
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

export default {
  // Primary locators (in priority order)
  byRole,
  byLabel,
  byPlaceholder,
  byText,
  byTestId,
  byAltText,
  byTitle,
  bySelector,
  // Composite builders
  button,
  link,
  heading,
  textbox,
  checkbox,
  radio,
  combobox,
  listitem,
  navigation,
  dialog,
  alert,
  tab,
  menuitem,
  // Chain helpers
  filterByText,
  filterByNotText,
  filterByChild,
  filterByNotChild,
  nth,
  first,
  last,
  // Frame locators
  frame,
  frameByNameOrUrl,
  // Utilities
  cssSelector,
  xpath,
  isValidSelector,
};
