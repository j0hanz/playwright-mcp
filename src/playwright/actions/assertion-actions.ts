import config from '../../config/server-config.js';
import { Logger } from '../../utils/logger.js';
import { SessionManager } from '../session-manager.js';
import { executePageOperation } from '../utils/execution-helper.js';

const TIMEOUTS = {
  ASSERTION: config.timeouts.assertion,
} as const;

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
          await locator.waitFor({ state: 'hidden', timeout });
          return { success: true, hidden: true };
        } catch {
          const isHidden = await locator.isHidden().catch(() => true);
          return { success: false, hidden: isHidden };
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
          await locator.waitFor({ state: 'visible', timeout });
          return { success: true, visible: true };
        } catch {
          const isVisible = await locator.isVisible().catch(() => false);
          return { success: false, visible: isVisible };
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
          await locator.waitFor({ state: 'visible', timeout });

          const actualText = (await locator.textContent({ timeout })) ?? '';
          const trimmedActual = actualText.trim();
          const trimmedExpected = expectedText.trim();

          const matches = exact
            ? trimmedActual === trimmedExpected
            : trimmedActual.includes(trimmedExpected);

          if (matches) {
            return { success: true, actualText: trimmedActual };
          }

          return { success: false, actualText: trimmedActual };
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
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert attribute',
      async (page) => {
        const { timeout } = options;
        try {
          await page.waitForSelector(selector, { state: 'attached', timeout });
          await page.waitForFunction(
            ({ selector, attribute, expectedValue }) => {
              const el = document.querySelector(selector);
              return el?.getAttribute(attribute) === expectedValue;
            },
            { selector, attribute, expectedValue },
            { timeout }
          );
          return { success: true, actualValue: expectedValue };
        } catch {
          const actualValue = await page
            .getAttribute(selector, attribute)
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
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert value',
      async (page) => {
        const { timeout } = options;
        try {
          await page.waitForSelector(selector, { state: 'attached', timeout });
          await page.waitForFunction(
            ({ selector, expectedValue }) => {
              const el = document.querySelector(
                selector
              ) as unknown as HTMLInputElement | null;
              return el?.value === expectedValue;
            },
            { selector, expectedValue },
            { timeout }
          );
          return { success: true, actualValue: expectedValue };
        } catch {
          const actualValue = await page
            .inputValue(selector)
            .catch(() => undefined);
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
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert checked',
      async (page) => {
        const { timeout } = options;
        try {
          await page.waitForSelector(selector, { state: 'attached', timeout });
          await page.waitForFunction(
            ({ selector, checked }) => {
              const el = document.querySelector(
                selector
              ) as unknown as HTMLInputElement | null;
              return el?.checked === checked;
            },
            { selector, checked },
            { timeout }
          );
          return { success: true, isChecked: checked };
        } catch {
          const isChecked = await page
            .isChecked(selector)
            .catch(() => undefined);
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
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert URL',
      async (page) => {
        try {
          await page.waitForURL(expectedUrl, { timeout: options.timeout });
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
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Assert title',
      async (page) => {
        try {
          await page.waitForFunction(
            (title) => document.title === title,
            expectedTitle,
            { timeout: options.timeout }
          );
          return { success: true, actualTitle: expectedTitle };
        } catch {
          return { success: false, actualTitle: await page.title() };
        }
      },
      { expectedTitle }
    );
  }
}
