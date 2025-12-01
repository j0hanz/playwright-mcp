// Assertion Actions - Web-first assertions with auto-retry
// @see https://playwright.dev/docs/test-assertions

import { expect, type Locator } from '@playwright/test';
import type { Page } from 'playwright';

import config from '../../config/server-config.js';
import { BaseAction } from './base-action.js';

const DEFAULT_ASSERTION_TIMEOUT = config.timeouts.assertion;

/** Creates a standardized assertion result object */
function createResult<T extends Record<string, unknown>>(
  success: boolean,
  result: T
): { success: boolean } & T {
  return { success, ...result };
}

/** Generic assertion executor - eliminates duplication across all assertion methods */
async function runAssertion<T extends Record<string, unknown>>(
  baseAction: BaseAction,
  sessionId: string,
  pageId: string,
  operationName: string,
  assertFn: (page: Page) => Promise<void>,
  getActual: (page: Page) => Promise<T>,
  successResult: T,
  meta?: Record<string, unknown>
): Promise<{ success: boolean } & T> {
  return (baseAction as AssertionActions).runPageAssertion(
    sessionId,
    pageId,
    operationName,
    assertFn,
    getActual,
    successResult,
    meta
  );
}

/** Locator-based assertion executor for element assertions */
async function runLocatorAssertion<T extends Record<string, unknown>>(
  baseAction: BaseAction,
  sessionId: string,
  pageId: string,
  selector: string,
  operationName: string,
  assertFn: (locator: Locator, timeout: number) => Promise<void>,
  getActual: (locator: Locator) => Promise<T>,
  successResult: T,
  timeout: number = DEFAULT_ASSERTION_TIMEOUT
): Promise<{ success: boolean } & T> {
  return (baseAction as AssertionActions).runLocatorPageAssertion(
    sessionId,
    pageId,
    selector,
    operationName,
    assertFn,
    getActual,
    successResult,
    timeout
  );
}

export class AssertionActions extends BaseAction {
  /** Internal helper for page-level assertions */
  async runPageAssertion<T extends Record<string, unknown>>(
    sessionId: string,
    pageId: string,
    operationName: string,
    assertFn: (page: Page) => Promise<void>,
    getActual: (page: Page) => Promise<T>,
    successResult: T,
    meta?: Record<string, unknown>
  ): Promise<{ success: boolean } & T> {
    return this.executePageOperation(
      sessionId,
      pageId,
      operationName,
      async (page) => {
        try {
          await assertFn(page);
          return createResult(true, successResult);
        } catch {
          const actual = await getActual(page);
          return createResult(false, actual);
        }
      },
      meta
    );
  }

  /** Internal helper for locator-based assertions */
  async runLocatorPageAssertion<T extends Record<string, unknown>>(
    sessionId: string,
    pageId: string,
    selector: string,
    operationName: string,
    assertFn: (locator: Locator, timeout: number) => Promise<void>,
    getActual: (locator: Locator) => Promise<T>,
    successResult: T,
    timeout: number = DEFAULT_ASSERTION_TIMEOUT
  ): Promise<{ success: boolean } & T> {
    return this.executePageOperation(
      sessionId,
      pageId,
      operationName,
      async (page) => {
        const locator = page.locator(selector);
        try {
          await assertFn(locator, timeout);
          return createResult(true, successResult);
        } catch {
          const actual = await getActual(locator);
          return createResult(false, actual);
        }
      },
      { selector }
    );
  }

  async assertHidden(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; hidden: boolean }> {
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert hidden',
      async (locator, timeout) => {
        await expect(locator).toBeHidden({ timeout });
      },
      async (locator) => ({
        hidden: await locator.isHidden().catch(() => true),
      }),
      { hidden: true },
      options.timeout
    );
  }

  async assertVisible(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; visible: boolean }> {
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert visible',
      async (locator, timeout) => {
        await expect(locator).toBeVisible({ timeout });
      },
      async (locator) => ({
        visible: await locator.isVisible().catch(() => false),
      }),
      { visible: true },
      options.timeout
    );
  }

  async assertText(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedText: string,
    options: { exact?: boolean; timeout?: number } = {}
  ): Promise<{ success: boolean; actualText?: string }> {
    const { exact = false, timeout = DEFAULT_ASSERTION_TIMEOUT } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Assert text',
      async (page) => {
        const locator = page.locator(selector);
        try {
          const assertion = exact
            ? expect(locator).toHaveText(expectedText, { timeout })
            : expect(locator).toContainText(expectedText, { timeout });
          await assertion;
          const actualText = (await locator.textContent()) ?? '';
          return createResult(true, { actualText: actualText.trim() });
        } catch {
          const actualText = await locator.textContent().catch(() => undefined);
          return createResult(false, { actualText: actualText?.trim() });
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
    const timeout = options.timeout ?? DEFAULT_ASSERTION_TIMEOUT;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Assert attribute',
      async (page) => {
        const locator = page.locator(selector);
        try {
          await expect(locator).toHaveAttribute(attribute, expectedValue, {
            timeout,
          });
          return createResult(true, { actualValue: expectedValue });
        } catch {
          const actualValue = await locator
            .getAttribute(attribute)
            .catch(() => null);
          return createResult(false, { actualValue: actualValue ?? undefined });
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
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert value',
      async (locator, timeout) => {
        await expect(locator).toHaveValue(expectedValue, { timeout });
      },
      async (locator) => ({
        actualValue: await locator.inputValue().catch(() => undefined),
      }),
      { actualValue: expectedValue },
      options.timeout
    );
  }

  async assertChecked(
    sessionId: string,
    pageId: string,
    selector: string,
    checked: boolean,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; isChecked?: boolean }> {
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert checked',
      async (locator, timeout) => {
        await expect(locator).toBeChecked({ checked, timeout });
      },
      async (locator) => ({
        isChecked: await locator.isChecked().catch(() => undefined),
      }),
      { isChecked: checked },
      options.timeout
    );
  }

  async assertUrl(
    sessionId: string,
    pageId: string,
    expectedUrl: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualUrl?: string }> {
    const timeout = options.timeout ?? DEFAULT_ASSERTION_TIMEOUT;

    return runAssertion(
      this,
      sessionId,
      pageId,
      'Assert URL',
      async (page) => {
        await expect(page).toHaveURL(expectedUrl, { timeout });
      },
      (page) => Promise.resolve({ actualUrl: page.url() }),
      { actualUrl: expectedUrl },
      { expectedUrl }
    );
  }

  async assertTitle(
    sessionId: string,
    pageId: string,
    expectedTitle: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualTitle?: string }> {
    const timeout = options.timeout ?? DEFAULT_ASSERTION_TIMEOUT;

    return runAssertion(
      this,
      sessionId,
      pageId,
      'Assert title',
      async (page) => {
        await expect(page).toHaveTitle(expectedTitle, { timeout });
      },
      async (page) => ({ actualTitle: await page.title() }),
      { actualTitle: expectedTitle },
      { expectedTitle }
    );
  }

  async assertEnabled(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; enabled: boolean }> {
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert enabled',
      async (locator, timeout) => {
        await expect(locator).toBeEnabled({ timeout });
      },
      async (locator) => ({
        enabled: await locator.isEnabled().catch(() => false),
      }),
      { enabled: true },
      options.timeout
    );
  }

  async assertDisabled(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; disabled: boolean }> {
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert disabled',
      async (locator, timeout) => {
        await expect(locator).toBeDisabled({ timeout });
      },
      async (locator) => ({
        disabled: await locator.isDisabled().catch(() => false),
      }),
      { disabled: true },
      options.timeout
    );
  }

  async assertFocused(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; focused: boolean }> {
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert focused',
      async (locator, timeout) => {
        await expect(locator).toBeFocused({ timeout });
      },
      async (locator) => {
        const focused = await locator
          .evaluate((el) => document.activeElement === el)
          .catch(() => false);
        return { focused };
      },
      { focused: true },
      options.timeout
    );
  }

  async assertCount(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedCount: number,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualCount: number }> {
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert count',
      async (locator, timeout) => {
        await expect(locator).toHaveCount(expectedCount, { timeout });
      },
      async (locator) => ({ actualCount: await locator.count() }),
      { actualCount: expectedCount },
      options.timeout
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
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert CSS',
      async (locator, timeout) => {
        await expect(locator).toHaveCSS(property, expectedValue, { timeout });
      },
      async (locator) => ({
        actualValue: await locator
          .evaluate(
            (el, prop) => getComputedStyle(el).getPropertyValue(prop),
            property
          )
          .catch(() => undefined),
      }),
      { actualValue: expectedValue },
      options.timeout
    );
  }

  async assertEditable(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; editable: boolean }> {
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert editable',
      async (locator, timeout) => {
        await expect(locator).toBeEditable({ timeout });
      },
      async (locator) => ({
        editable: await locator.isEditable().catch(() => false),
      }),
      { editable: true },
      options.timeout
    );
  }

  async assertAttached(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; attached: boolean }> {
    return runLocatorAssertion(
      this,
      sessionId,
      pageId,
      selector,
      'Assert attached',
      async (locator, timeout) => {
        await expect(locator).toBeAttached({ timeout });
      },
      async (locator) => ({
        attached: (await locator.count()) > 0,
      }),
      { attached: true },
      options.timeout
    );
  }

  async assertInViewport(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number; ratio?: number } = {}
  ): Promise<{ success: boolean; inViewport: boolean }> {
    const { ratio, timeout = DEFAULT_ASSERTION_TIMEOUT } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Assert in viewport',
      async (page) => {
        const locator = page.locator(selector);
        try {
          await expect(locator).toBeInViewport({ timeout, ratio });
          return createResult(true, { inViewport: true });
        } catch {
          // Check actual viewport intersection
          const inViewport = await locator
            .evaluate((el, r) => {
              const rect = el.getBoundingClientRect();
              const viewportHeight = window.innerHeight;
              const viewportWidth = window.innerWidth;

              // Calculate intersection area
              const visibleWidth =
                Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
              const visibleHeight =
                Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);

              if (visibleWidth <= 0 || visibleHeight <= 0) return false;

              const visibleArea = visibleWidth * visibleHeight;
              const totalArea = rect.width * rect.height;

              if (totalArea === 0) return false;

              const visibleRatio = visibleArea / totalArea;
              return r ? visibleRatio >= r : visibleRatio > 0;
            }, ratio)
            .catch(() => false);

          return createResult(false, { inViewport });
        }
      },
      { selector, ratio }
    );
  }

  async assertTextWithRegex(
    sessionId: string,
    pageId: string,
    selector: string,
    pattern: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualText?: string }> {
    const timeout = options.timeout ?? DEFAULT_ASSERTION_TIMEOUT;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Assert text with regex',
      async (page) => {
        const locator = page.locator(selector);
        try {
          const regex = new RegExp(pattern);
          await expect(locator).toHaveText(regex, { timeout });
          const actualText = (await locator.textContent()) ?? '';
          return createResult(true, { actualText: actualText.trim() });
        } catch {
          const actualText = await locator.textContent().catch(() => undefined);
          return createResult(false, { actualText: actualText?.trim() });
        }
      },
      { selector, pattern }
    );
  }

  async assertUrlWithRegex(
    sessionId: string,
    pageId: string,
    pattern: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualUrl?: string }> {
    const timeout = options.timeout ?? DEFAULT_ASSERTION_TIMEOUT;

    return runAssertion(
      this,
      sessionId,
      pageId,
      'Assert URL with regex',
      async (page) => {
        const regex = new RegExp(pattern);
        await expect(page).toHaveURL(regex, { timeout });
      },
      (page) => Promise.resolve({ actualUrl: page.url() }),
      { actualUrl: pattern },
      { pattern }
    );
  }

  async assertTitleWithRegex(
    sessionId: string,
    pageId: string,
    pattern: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualTitle?: string }> {
    const timeout = options.timeout ?? DEFAULT_ASSERTION_TIMEOUT;

    return runAssertion(
      this,
      sessionId,
      pageId,
      'Assert title with regex',
      async (page) => {
        const regex = new RegExp(pattern);
        await expect(page).toHaveTitle(regex, { timeout });
      },
      async (page) => ({ actualTitle: await page.title() }),
      { actualTitle: pattern },
      { pattern }
    );
  }
}
