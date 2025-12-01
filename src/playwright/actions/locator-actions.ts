// Locator Actions - Playwright recommended locator strategies
// @see https://playwright.dev/docs/locators#filtering-locators

import config from '../../config/server-config.js';
import type { AriaRole } from '../../config/types.js';
import { Logger } from '../../utils/logger.js';
import * as pageActions from '../page-actions.js';
import { SessionManager } from '../session-manager.js';
import { executePageOperation } from '../utils/execution-helper.js';

const TIMEOUTS = {
  ACTION: config.timeouts.action,
} as const;

export class LocatorActions {
  constructor(
    private sessionManager: SessionManager,
    private logger: Logger
  ) {}

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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

    return executePageOperation(
      this.sessionManager,
      this.logger,
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

  // Locator Composition (and/or)

  async clickWithAnd(
    sessionId: string,
    pageId: string,
    selector1: string,
    selector2: string,
    options: { force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { force, timeout = TIMEOUTS.ACTION } = options;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Click with AND locator',
      async (page) => {
        const locator1 = page.locator(selector1);
        const locator2 = page.locator(selector2);
        await locator1.and(locator2).click({ force, timeout });
        return { success: true };
      },
      { selector1, selector2 }
    );
  }

  async clickWithOr(
    sessionId: string,
    pageId: string,
    selector1: string,
    selector2: string,
    options: { force?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { force, timeout = TIMEOUTS.ACTION } = options;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Click with OR locator',
      async (page) => {
        const locator1 = page.locator(selector1);
        const locator2 = page.locator(selector2);
        await locator1.or(locator2).click({ force, timeout });
        return { success: true };
      },
      { selector1, selector2 }
    );
  }

  async fillWithAnd(
    sessionId: string,
    pageId: string,
    selector1: string,
    selector2: string,
    text: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const timeout = options.timeout ?? TIMEOUTS.ACTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Fill with AND locator',
      async (page) => {
        const locator1 = page.locator(selector1);
        const locator2 = page.locator(selector2);
        await locator1.and(locator2).fill(text, { timeout });
        return { success: true };
      },
      { selector1, selector2 }
    );
  }

  async getElementWithAnd(
    sessionId: string,
    pageId: string,
    selector1: string,
    selector2: string
  ): Promise<{
    found: boolean;
    count: number;
    textContent?: string;
  }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Get element with AND locator',
      async (page) => {
        const locator1 = page.locator(selector1);
        const locator2 = page.locator(selector2);
        const combined = locator1.and(locator2);
        const count = await combined.count();

        if (count === 0) {
          return { found: false, count: 0 };
        }

        const textContent = (await combined.first().textContent()) ?? undefined;
        return { found: true, count, textContent };
      },
      { selector1, selector2 }
    );
  }

  async isVisibleWithAnd(
    sessionId: string,
    pageId: string,
    selector1: string,
    selector2: string
  ): Promise<{ visible: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Check visibility with AND locator',
      async (page) => {
        const locator1 = page.locator(selector1);
        const locator2 = page.locator(selector2);
        const visible = await locator1.and(locator2).isVisible();
        return { visible };
      },
      { selector1, selector2 }
    );
  }

  async clickByRoleWithFilter(
    sessionId: string,
    pageId: string,
    role: AriaRole,
    filterSelector: string,
    options: {
      name?: string;
      exact?: boolean;
      force?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{ success: boolean }> {
    const { name, exact, force, timeout = TIMEOUTS.ACTION } = options;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Click by role with filter',
      async (page) => {
        const roleLocator = page.getByRole(role, { name, exact });
        const filterLocator = page.locator(filterSelector);
        await roleLocator.and(filterLocator).click({ force, timeout });
        return { success: true };
      },
      { role, filterSelector, name }
    );
  }
}
