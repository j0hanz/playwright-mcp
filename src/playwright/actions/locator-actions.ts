import config from '../../config/server-config.js';
import { AriaRole } from '../../types/index.js';
import { Logger } from '../../utils/logger.js';
import * as pageActions from '../page-actions.js';
import { SessionManager } from '../session-manager.js';
import { executePageOperation } from '../utils/execution-helper.js';

const TIMEOUTS = {
  ACTION: config.timeouts.action,
} as const;

/**
 * Locator Actions Module
 *
 * Implements Playwright's recommended locator strategies with support for
 * locator composition using and()/or() methods.
 *
 * **Locator Composition (locator.and()/locator.or())**:
 * - `and()`: Matches elements that satisfy BOTH locators (intersection)
 * - `or()`: Matches elements that satisfy EITHER locator (union)
 *
 * @see https://playwright.dev/docs/locators#filtering-locators
 */
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

  // ============================================
  // Locator Composition (and/or)
  // ============================================

  /**
   * Click element matching BOTH selectors (intersection).
   *
   * Uses locator.and() to narrow down selection by requiring both conditions.
   *
   * @example
   * // Click a button that ALSO has the class "primary"
   * await clickWithAnd(sessionId, pageId, 'button', '.primary');
   *
   * @see https://playwright.dev/docs/api/class-locator#locator-and
   */
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

  /**
   * Click element matching EITHER selector (union).
   *
   * Uses locator.or() to match elements satisfying any of the conditions.
   *
   * @example
   * // Click either a submit button or an anchor with "Submit" text
   * await clickWithOr(sessionId, pageId, 'button[type="submit"]', 'a:has-text("Submit")');
   *
   * @see https://playwright.dev/docs/api/class-locator#locator-or
   */
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

  /**
   * Fill input matching BOTH selectors (intersection).
   *
   * @see https://playwright.dev/docs/api/class-locator#locator-and
   */
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

  /**
   * Get element info using combined locators with AND logic.
   *
   * Useful for querying elements that match multiple criteria.
   *
   * @see https://playwright.dev/docs/api/class-locator#locator-and
   */
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

  /**
   * Check if element matching BOTH selectors is visible.
   *
   * @see https://playwright.dev/docs/api/class-locator#locator-and
   */
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

  /**
   * Click by role with additional selector filter using AND.
   *
   * Combines role-based locator with additional CSS selector for precise targeting.
   *
   * @example
   * // Click a button with role AND specific class
   * await clickByRoleWithFilter(sessionId, pageId, 'button', '.primary', { name: 'Submit' });
   */
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
