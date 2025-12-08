// Locator Actions - Playwright recommended locator strategies
// @see https://playwright.dev/docs/locators#filtering-locators

import config from '../../config/server-config.js';
import type { AriaRole } from '../../config/types.js';
import * as pageActions from '../page-actions.js';
import { BaseAction } from './base-action.js';

const TIMEOUTS = {
  ACTION: config.timeouts.action,
} as const;

/**
 * Action module for Playwright's recommended locator strategies.
 *
 * Provides semantic locator methods that follow Playwright best practices:
 * 1. Role-based locators (most reliable)
 * 2. Label-based locators (for form fields)
 * 3. Text-based locators (for non-interactive elements)
 * 4. TestId-based locators (when code control is available)
 * 5. Alt text/title locators (for images and elements with titles)
 *
 * These locators are preferred over CSS selectors as they are more resilient
 * to DOM changes and reflect how users interact with the page.
 *
 * @see https://playwright.dev/docs/locators for locator documentation
 */
export class LocatorActions extends BaseAction {
  async clickByRole(
    sessionId: string,
    pageId: string,
    role: AriaRole,
    options: {
      name?: string;
      exact?: boolean;
      force?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{ success: boolean }> {
    const { timeout = TIMEOUTS.ACTION, ...roleOptions } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Click by role',
      async (page) => {
        return pageActions.clickByRole(page, role, { ...roleOptions, timeout });
      },
      { role, name: options.name }
    );
  }

  async fillByLabel(
    sessionId: string,
    pageId: string,
    label: string,
    text: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { timeout = TIMEOUTS.ACTION, ...labelOptions } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Fill by label',
      async (page) => {
        return pageActions.fillByLabel(page, label, text, {
          ...labelOptions,
          timeout,
        });
      },
      { label }
    );
  }

  async clickByText(
    sessionId: string,
    pageId: string,
    text: string,
    options: { exact?: boolean; force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { timeout = TIMEOUTS.ACTION, ...textOptions } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Click by text',
      async (page) => {
        return pageActions.clickByText(page, text, { ...textOptions, timeout });
      },
      { text }
    );
  }

  async fillByPlaceholder(
    sessionId: string,
    pageId: string,
    placeholder: string,
    text: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { timeout = TIMEOUTS.ACTION, ...placeholderOptions } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Fill by placeholder',
      async (page) => {
        return pageActions.fillByPlaceholder(page, placeholder, text, {
          ...placeholderOptions,
          timeout,
        });
      },
      { placeholder }
    );
  }

  async clickByTestId(
    sessionId: string,
    pageId: string,
    testId: string,
    options: { force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { timeout = TIMEOUTS.ACTION, ...testIdOptions } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Click by testId',
      async (page) => {
        return pageActions.clickByTestId(page, testId, {
          ...testIdOptions,
          timeout,
        });
      },
      { testId }
    );
  }

  async fillByTestId(
    sessionId: string,
    pageId: string,
    testId: string,
    text: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const timeout = options.timeout ?? TIMEOUTS.ACTION;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Fill by testId',
      async (page) => {
        await page.getByTestId(testId).fill(text, { timeout });
        return { success: true };
      },
      { testId }
    );
  }

  async clickByAltText(
    sessionId: string,
    pageId: string,
    altText: string,
    options: { exact?: boolean; force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { exact, force, timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Click by alt text',
      async (page) => {
        await page.getByAltText(altText, { exact }).click({ force, timeout });
        return { success: true };
      },
      { altText }
    );
  }

  async clickByTitle(
    sessionId: string,
    pageId: string,
    title: string,
    options: { exact?: boolean; force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { exact, force, timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Click by title',
      async (page) => {
        await page.getByTitle(title, { exact }).click({ force, timeout });
        return { success: true };
      },
      { title }
    );
  }

  async hoverByRole(
    sessionId: string,
    pageId: string,
    role: AriaRole,
    options: {
      name?: string;
      exact?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{ success: boolean }> {
    const { name, exact, timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Hover by role',
      async (page) => {
        await page.getByRole(role, { name, exact }).hover({ timeout });
        return { success: true };
      },
      { role, name }
    );
  }

  async hoverByText(
    sessionId: string,
    pageId: string,
    text: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { exact, timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Hover by text',
      async (page) => {
        await page.getByText(text, { exact }).hover({ timeout });
        return { success: true };
      },
      { text }
    );
  }

  async hoverByTestId(
    sessionId: string,
    pageId: string,
    testId: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Hover by testId',
      async (page) => {
        await page.getByTestId(testId).hover({ timeout });
        return { success: true };
      },
      { testId }
    );
  }
}
