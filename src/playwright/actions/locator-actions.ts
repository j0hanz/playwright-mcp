import config from '../../config/server-config.js';
import { AriaRole } from '../../types/index.js';
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
}
