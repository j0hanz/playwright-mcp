// Assertion Actions - Web-first assertions with auto-retry
// @see https://playwright.dev/docs/test-assertions

import { expect } from '@playwright/test';

import config from '../../config/server-config.js';
import { Logger } from '../../utils/logger.js';
import { SessionManager } from '../session-manager.js';
import { executePageOperation } from '../utils/execution-helper.js';

const TIMEOUTS = {
  ASSERTION: config.timeouts.assertion,
} as const;

/** Creates a standardized assertion result object */
function createAssertionResult<T extends Record<string, unknown>>(
  success: boolean,
  result: T
): { success: boolean } & T {
  return { success, ...result };
}

export class AssertionActions {
  constructor(
    private sessionManager: SessionManager,
    private logger: Logger
  ) {}

  async assertHidden(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; hidden: boolean }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert hidden',
      async (page) => {
        const locator = page.locator(selector);
        try {
          await expect(locator).toBeHidden({ timeout });
          return createAssertionResult(true, { hidden: true });
        } catch {
          const isHidden = await locator.isHidden().catch(() => true);
          return createAssertionResult(false, { hidden: isHidden });
        }
      },
      { selector }
    );
  }

  async assertVisible(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; visible: boolean }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert visible',
      async (page) => {
        const locator = page.locator(selector);
        try {
          await expect(locator).toBeVisible({ timeout });
          return createAssertionResult(true, { visible: true });
        } catch {
          const isVisible = await locator.isVisible().catch(() => false);
          return createAssertionResult(false, { visible: isVisible });
        }
      },
      { selector }
    );
  }

  async assertText(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedText: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean; actualText?: string }> {
    const { exact = false, timeout = TIMEOUTS.ASSERTION } = options;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert text',
      async (page) => {
        const locator = page.locator(selector);

        try {
          // Use Playwright's built-in web-first assertions
          if (exact) {
            await expect(locator).toHaveText(expectedText, { timeout });
          } else {
            await expect(locator).toContainText(expectedText, { timeout });
          }
          const actualText = (await locator.textContent()) ?? '';
          return { success: true, actualText: actualText.trim() };
        } catch {
          const actualText = await locator.textContent().catch(() => undefined);
          return { success: false, actualText: actualText?.trim() };
        }
      },
      { selector, expectedText }
    );
  }

  async assertAttribute(
    sessionId: string,
    pageId: string,
    selector: string,
    attribute: string,
    expectedValue: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualValue?: string }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert attribute',
      async (page) => {
        const locator = page.locator(selector);
        try {
          // Use Playwright's built-in web-first assertion
          await expect(locator).toHaveAttribute(attribute, expectedValue, {
            timeout,
          });
          return { success: true, actualValue: expectedValue };
        } catch {
          const actualValue = await locator
            .getAttribute(attribute)
            .catch(() => null);
          return { success: false, actualValue: actualValue ?? undefined };
        }
      },
      { selector, attribute, expectedValue }
    );
  }

  async assertValue(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedValue: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualValue?: string }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert value',
      async (page) => {
        const locator = page.locator(selector);
        try {
          // Use Playwright's built-in web-first assertion
          await expect(locator).toHaveValue(expectedValue, { timeout });
          return { success: true, actualValue: expectedValue };
        } catch {
          const actualValue = await locator.inputValue().catch(() => undefined);
          return { success: false, actualValue };
        }
      },
      { selector, expectedValue }
    );
  }

  async assertChecked(
    sessionId: string,
    pageId: string,
    selector: string,
    checked: boolean,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; isChecked?: boolean }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert checked',
      async (page) => {
        const locator = page.locator(selector);
        try {
          // Use Playwright's built-in web-first assertion
          await expect(locator).toBeChecked({ checked, timeout });
          return { success: true, isChecked: checked };
        } catch {
          const isChecked = await locator.isChecked().catch(() => undefined);
          return { success: false, isChecked };
        }
      },
      { selector, checked }
    );
  }

  async assertUrl(
    sessionId: string,
    pageId: string,
    expectedUrl: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualUrl?: string }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert URL',
      async (page) => {
        try {
          // Use Playwright's built-in web-first page assertion
          await expect(page).toHaveURL(expectedUrl, { timeout });
          return { success: true, actualUrl: page.url() };
        } catch {
          return { success: false, actualUrl: page.url() };
        }
      },
      { expectedUrl }
    );
  }

  async assertTitle(
    sessionId: string,
    pageId: string,
    expectedTitle: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualTitle?: string }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert title',
      async (page) => {
        try {
          // Use Playwright's built-in web-first page assertion
          await expect(page).toHaveTitle(expectedTitle, { timeout });
          return { success: true, actualTitle: expectedTitle };
        } catch {
          return { success: false, actualTitle: await page.title() };
        }
      },
      { expectedTitle }
    );
  }

  async assertEnabled(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; enabled: boolean }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert enabled',
      async (page) => {
        const locator = page.locator(selector);
        try {
          await expect(locator).toBeEnabled({ timeout });
          return createAssertionResult(true, { enabled: true });
        } catch {
          const isEnabled = await locator.isEnabled().catch(() => false);
          return createAssertionResult(false, { enabled: isEnabled });
        }
      },
      { selector }
    );
  }

  async assertDisabled(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; disabled: boolean }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert disabled',
      async (page) => {
        const locator = page.locator(selector);
        try {
          await expect(locator).toBeDisabled({ timeout });
          return createAssertionResult(true, { disabled: true });
        } catch {
          const isDisabled = await locator.isDisabled().catch(() => false);
          return createAssertionResult(false, { disabled: isDisabled });
        }
      },
      { selector }
    );
  }

  async assertFocused(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; focused: boolean }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert focused',
      async (page) => {
        const locator = page.locator(selector);
        try {
          await expect(locator).toBeFocused({ timeout });
          return createAssertionResult(true, { focused: true });
        } catch {
          const focused = await page
            .evaluate(
              (sel) => document.activeElement === document.querySelector(sel),
              selector
            )
            .catch(() => false);
          return createAssertionResult(false, { focused });
        }
      },
      { selector }
    );
  }

  async assertCount(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedCount: number,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualCount: number }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert count',
      async (page) => {
        const locator = page.locator(selector);
        try {
          await expect(locator).toHaveCount(expectedCount, { timeout });
          return { success: true, actualCount: expectedCount };
        } catch {
          const actualCount = await locator.count();
          return { success: false, actualCount };
        }
      },
      { selector, expectedCount }
    );
  }

  async assertCss(
    sessionId: string,
    pageId: string,
    selector: string,
    property: string,
    expectedValue: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualValue?: string }> {
    const timeout = options.timeout ?? TIMEOUTS.ASSERTION;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert CSS',
      async (page) => {
        const locator = page.locator(selector);
        try {
          await expect(locator).toHaveCSS(property, expectedValue, { timeout });
          return { success: true, actualValue: expectedValue };
        } catch {
          const actualValue = await locator
            .evaluate(
              (el, prop) => getComputedStyle(el).getPropertyValue(prop),
              property
            )
            .catch(() => undefined);
          return { success: false, actualValue };
        }
      },
      { selector, property, expectedValue }
    );
  }
}
