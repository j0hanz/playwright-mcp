// Selector Utilities - Robust locator builders following Playwright best practices
// @see https://playwright.dev/docs/best-practices#use-locators

import type { Locator, Page } from 'playwright';

import type { AriaRole } from '../../config/types.js';

// Primary Locators

export function byRole(
  page: Page,
  role: AriaRole,
  options?: { name?: string | RegExp; exact?: boolean }
): Locator {
  return page.getByRole(role, options);
}

export function byLabel(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return page.getByLabel(text, options);
}

export function byPlaceholder(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return page.getByPlaceholder(text, options);
}

export function byText(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return page.getByText(text, options);
}

export function byTestId(page: Page, testId: string | RegExp): Locator {
  return page.getByTestId(testId);
}

export function byAltText(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return page.getByAltText(text, options);
}

export function byTitle(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return page.getByTitle(text, options);
}

export function bySelector(page: Page, selector: string): Locator {
  return page.locator(selector);
}

// Composite Locator Builders

export function button(
  page: Page,
  name: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('button', { name, exact });
}

export function link(
  page: Page,
  name: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('link', { name, exact });
}

export function heading(
  page: Page,
  name: string | RegExp,
  options?: { level?: 1 | 2 | 3 | 4 | 5 | 6; exact?: boolean }
): Locator {
  return page.getByRole('heading', { name, ...options });
}

export function textbox(
  page: Page,
  name?: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('textbox', name ? { name, exact } : undefined);
}

export function checkbox(
  page: Page,
  name?: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('checkbox', name ? { name, exact } : undefined);
}

export function radio(
  page: Page,
  name?: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('radio', name ? { name, exact } : undefined);
}

export function combobox(
  page: Page,
  name?: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('combobox', name ? { name, exact } : undefined);
}

export function listitem(
  page: Page,
  name?: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('listitem', name ? { name, exact } : undefined);
}

export function navigation(page: Page, name?: string | RegExp): Locator {
  return page.getByRole('navigation', name ? { name } : undefined);
}

export function dialog(page: Page, name?: string | RegExp): Locator {
  return page.getByRole('dialog', name ? { name } : undefined);
}

export function alert(page: Page, name?: string | RegExp): Locator {
  return page.getByRole('alert', name ? { name } : undefined);
}

export function tab(page: Page, name: string | RegExp, exact = false): Locator {
  return page.getByRole('tab', { name, exact });
}

export function menuitem(
  page: Page,
  name: string | RegExp,
  exact = false
): Locator {
  return page.getByRole('menuitem', { name, exact });
}

// Locator Chain Helpers

export function filterByText(
  locator: Locator,
  text: string | RegExp,
  options?: { exact?: boolean }
): Locator {
  return locator.filter({ hasText: text, ...options });
}

export function filterByNotText(
  locator: Locator,
  text: string | RegExp
): Locator {
  return locator.filter({ hasNotText: text });
}

export function filterByChild(locator: Locator, child: Locator): Locator {
  return locator.filter({ has: child });
}

export function filterByNotChild(locator: Locator, child: Locator): Locator {
  return locator.filter({ hasNot: child });
}

export function nth(locator: Locator, index: number): Locator {
  return locator.nth(index);
}

export function first(locator: Locator): Locator {
  return locator.first();
}

export function last(locator: Locator): Locator {
  return locator.last();
}

// Frame Locators

export function frame(page: Page, selector: string) {
  return page.frameLocator(selector);
}

export function frameByNameOrUrl(
  page: Page,
  options: { name?: string; url?: string | RegExp }
) {
  return page.frame(options);
}

// Utility Functions

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

export function xpath(expression: string): string {
  return `xpath=${expression}`;
}

/**
 * Basic CSS selector validation (Node.js compatible)
 * Note: Full validation requires browser context. This validates common patterns.
 */
export function isValidSelector(selector: string): boolean {
  if (!selector || typeof selector !== 'string') return false;

  // Reject obviously invalid selectors
  const invalidPatterns = [
    /^\s*$/, // Empty or whitespace only
    /[{}]/, // Contains braces (CSS rule, not selector)
    /^\d/, // Starts with digit (invalid CSS identifier)
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(selector)) return false;
  }

  // Basic structural validation for common selector patterns
  // Allow: #id, .class, tag, [attr], tag.class#id, tag[attr="value"], etc.
  const validSelectorPattern = /^[a-zA-Z_#.[\]="'\-:>+~*\s,()\d^$|]+$/;
  return validSelectorPattern.test(selector);
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
