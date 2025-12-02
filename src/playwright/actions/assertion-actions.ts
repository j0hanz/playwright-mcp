// Assertion Actions - Web-first assertions with auto-retry
// @see https://playwright.dev/docs/test-assertions

import { expect, type Locator, type Page } from '@playwright/test';

import config from '../../config/server-config.js';
import { BaseAction } from './base-action.js';

const DEFAULT_TIMEOUT = config.timeouts.assertion;

/** Creates a standardized assertion result object */
function result<T extends Record<string, unknown>>(
  success: boolean,
  data: T
): { success: boolean } & T {
  return { success, ...data };
}

export class AssertionActions extends BaseAction {
  /** Execute a locator-based assertion with standardized error handling */
  private async assertLocator<T extends Record<string, unknown>>(
    sessionId: string,
    pageId: string,
    selector: string,
    operation: string,
    assertFn: (locator: Locator, timeout: number) => Promise<void>,
    getActual: (locator: Locator) => Promise<T>,
    successData: T,
    timeout = DEFAULT_TIMEOUT
  ): Promise<{ success: boolean } & T> {
    return this.executePageOperation(
      sessionId,
      pageId,
      operation,
      async (page) => {
        const locator = page.locator(selector);
        try {
          await assertFn(locator, timeout);
          return result(true, successData);
        } catch {
          return result(false, await getActual(locator));
        }
      },
      { selector }
    );
  }

  /** Execute a page-level assertion with standardized error handling */
  private async assertPage<T extends Record<string, unknown>>(
    sessionId: string,
    pageId: string,
    operation: string,
    assertFn: (page: Page, timeout: number) => Promise<void>,
    getActual: (page: Page) => Promise<T>,
    successData: T,
    timeout = DEFAULT_TIMEOUT,
    meta?: Record<string, unknown>
  ): Promise<{ success: boolean } & T> {
    return this.executePageOperation(
      sessionId,
      pageId,
      operation,
      async (page) => {
        try {
          await assertFn(page, timeout);
          return result(true, successData);
        } catch {
          return result(false, await getActual(page));
        }
      },
      meta
    );
  }

  async assertHidden(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; hidden: boolean }> {
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert hidden',
      (loc, t) => expect(loc).toBeHidden({ timeout: t }),
      async (loc) => ({ hidden: await loc.isHidden().catch(() => true) }),
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
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert visible',
      (loc, t) => expect(loc).toBeVisible({ timeout: t }),
      async (loc) => ({ visible: await loc.isVisible().catch(() => false) }),
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
    const { exact = false, timeout = DEFAULT_TIMEOUT } = options;
    const assertFn = exact
      ? (loc: Locator, t: number) =>
          expect(loc).toHaveText(expectedText, { timeout: t })
      : (loc: Locator, t: number) =>
          expect(loc).toContainText(expectedText, { timeout: t });

    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert text',
      assertFn,
      async (loc) => ({
        actualText: (await loc.textContent().catch(() => undefined))?.trim(),
      }),
      { actualText: expectedText },
      timeout
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
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert attribute',
      (loc, t) =>
        expect(loc).toHaveAttribute(attribute, expectedValue, { timeout: t }),
      async (loc) => ({
        actualValue:
          (await loc.getAttribute(attribute).catch(() => null)) ?? undefined,
      }),
      { actualValue: expectedValue },
      options.timeout
    );
  }

  async assertValue(
    sessionId: string,
    pageId: string,
    selector: string,
    expectedValue: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualValue?: string }> {
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert value',
      (loc, t) => expect(loc).toHaveValue(expectedValue, { timeout: t }),
      async (loc) => ({
        actualValue: await loc.inputValue().catch(() => undefined),
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
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert checked',
      (loc, t) => expect(loc).toBeChecked({ checked, timeout: t }),
      async (loc) => ({
        isChecked: await loc.isChecked().catch(() => undefined),
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
    return this.assertPage(
      sessionId,
      pageId,
      'Assert URL',
      (page, t) => expect(page).toHaveURL(expectedUrl, { timeout: t }),
      (page) => Promise.resolve({ actualUrl: page.url() }),
      { actualUrl: expectedUrl },
      options.timeout,
      { expectedUrl }
    );
  }

  async assertTitle(
    sessionId: string,
    pageId: string,
    expectedTitle: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualTitle?: string }> {
    return this.assertPage(
      sessionId,
      pageId,
      'Assert title',
      (page, t) => expect(page).toHaveTitle(expectedTitle, { timeout: t }),
      async (page) => ({ actualTitle: await page.title() }),
      { actualTitle: expectedTitle },
      options.timeout,
      { expectedTitle }
    );
  }

  async assertEnabled(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; enabled: boolean }> {
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert enabled',
      (loc, t) => expect(loc).toBeEnabled({ timeout: t }),
      async (loc) => ({ enabled: await loc.isEnabled().catch(() => false) }),
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
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert disabled',
      (loc, t) => expect(loc).toBeDisabled({ timeout: t }),
      async (loc) => ({ disabled: await loc.isDisabled().catch(() => false) }),
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
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert focused',
      (loc, t) => expect(loc).toBeFocused({ timeout: t }),
      async (loc) => ({
        focused: await loc
          .evaluate((el) => document.activeElement === el)
          .catch(() => false),
      }),
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
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert count',
      (loc, t) => expect(loc).toHaveCount(expectedCount, { timeout: t }),
      async (loc) => ({ actualCount: await loc.count() }),
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
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert CSS',
      (loc, t) =>
        expect(loc).toHaveCSS(property, expectedValue, { timeout: t }),
      async (loc) => ({
        actualValue: await loc
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
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert editable',
      (loc, t) => expect(loc).toBeEditable({ timeout: t }),
      async (loc) => ({ editable: await loc.isEditable().catch(() => false) }),
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
    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert attached',
      (loc, t) => expect(loc).toBeAttached({ timeout: t }),
      async (loc) => ({ attached: (await loc.count()) > 0 }),
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
    const { ratio, timeout = DEFAULT_TIMEOUT } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Assert in viewport',
      async (page) => {
        const locator = page.locator(selector);
        try {
          await expect(locator).toBeInViewport({ timeout, ratio });
          return result(true, { inViewport: true });
        } catch {
          const inViewport = await locator
            .evaluate((el, r) => {
              const rect = el.getBoundingClientRect();
              const { innerHeight, innerWidth } = window;
              const visibleWidth =
                Math.min(rect.right, innerWidth) - Math.max(rect.left, 0);
              const visibleHeight =
                Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0);
              if (visibleWidth <= 0 || visibleHeight <= 0) return false;
              const visibleArea = visibleWidth * visibleHeight;
              const totalArea = rect.width * rect.height;
              if (totalArea === 0) return false;
              const visibleRatio = visibleArea / totalArea;
              return r ? visibleRatio >= r : visibleRatio > 0;
            }, ratio)
            .catch(() => false);
          return result(false, { inViewport });
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
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const regex = new RegExp(pattern);

    return this.assertLocator(
      sessionId,
      pageId,
      selector,
      'Assert text with regex',
      (loc, t) => expect(loc).toHaveText(regex, { timeout: t }),
      async (loc) => ({
        actualText: (await loc.textContent().catch(() => undefined))?.trim(),
      }),
      { actualText: pattern },
      timeout
    );
  }

  async assertUrlWithRegex(
    sessionId: string,
    pageId: string,
    pattern: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualUrl?: string }> {
    const regex = new RegExp(pattern);

    return this.assertPage(
      sessionId,
      pageId,
      'Assert URL with regex',
      (page, t) => expect(page).toHaveURL(regex, { timeout: t }),
      (page) => Promise.resolve({ actualUrl: page.url() }),
      { actualUrl: pattern },
      options.timeout,
      { pattern }
    );
  }

  async assertTitleWithRegex(
    sessionId: string,
    pageId: string,
    pattern: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; actualTitle?: string }> {
    const regex = new RegExp(pattern);

    return this.assertPage(
      sessionId,
      pageId,
      'Assert title with regex',
      (page, t) => expect(page).toHaveTitle(regex, { timeout: t }),
      async (page) => ({ actualTitle: await page.title() }),
      { actualTitle: pattern },
      options.timeout,
      { pattern }
    );
  }
}
