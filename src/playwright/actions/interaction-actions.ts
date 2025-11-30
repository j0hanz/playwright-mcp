// Interaction Actions - Element interactions with Playwright actionability checks
// @see https://playwright.dev/docs/actionability

import type { ElementInteractionOptions } from '../../config/types.js';
import { Logger } from '../../utils/logger.js';
import * as pageActions from '../page-actions.js';
import * as security from '../security.js';
import { SessionManager } from '../session-manager.js';
import { executePageOperation } from '../utils/execution-helper.js';

export class InteractionActions {
  constructor(
    private sessionManager: SessionManager,
    private logger: Logger
  ) {}

  async clickElement(options: ElementInteractionOptions): Promise<{
    success: boolean;
    elementInfo?: Record<string, unknown> | null;
    trialRun?: boolean;
  }> {
    const { sessionId, pageId, selector, timeout, force, trial } = options;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      trial ? 'Trial click element' : 'Click element',
      async (page) => {
        const elementInfo = await pageActions.getElementInfo(page, selector);
        // Use locator.click with trial option for dry-run validation
        await page.locator(selector).click({ force, timeout, trial });
        return { success: true, elementInfo, trialRun: trial ?? false };
      },
      { selector, trial }
    );
  }

  async fillInput(
    options: ElementInteractionOptions & { text: string }
  ): Promise<{ success: boolean }> {
    const { sessionId, pageId, selector, text, timeout } = options;
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Fill input',
      async (page) => {
        await pageActions.fillInput(page, selector, text, { timeout });
        return { success: true };
      },
      { selector }
    );
  }

  async hoverElement(
    options: ElementInteractionOptions
  ): Promise<{ success: boolean; trialRun?: boolean }> {
    const { sessionId, pageId, selector, timeout, trial } = options;
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      trial ? 'Trial hover element' : 'Hover element',
      async (page) => {
        // Use locator.hover with trial option
        await page.locator(selector).hover({ timeout, trial });
        return { success: true, trialRun: trial ?? false };
      },
      { selector, trial }
    );
  }

  async selectOption(
    sessionId: string,
    pageId: string,
    selector: string,
    value: string | string[],
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; selectedValues: string[] }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Select option',
      async (page) => {
        const result = await pageActions.selectOption(
          page,
          selector,
          value,
          options
        );
        return { success: true, selectedValues: result.selected };
      },
      { selector, value }
    );
  }

  async dragAndDrop(
    sessionId: string,
    pageId: string,
    sourceSelector: string,
    targetSelector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Drag and drop',
      async (page) => {
        await pageActions.dragAndDrop(
          page,
          sourceSelector,
          targetSelector,
          options
        );
        return { success: true };
      },
      { sourceSelector, targetSelector }
    );
  }

  async keyboardPress(
    sessionId: string,
    pageId: string,
    key: string,
    options: { delay?: number } = {}
  ): Promise<{ success: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Keyboard press',
      async (page) => {
        return pageActions.pressKey(page, key, options);
      },
      { key }
    );
  }

  async keyboardType(
    sessionId: string,
    pageId: string,
    text: string,
    options: { delay?: number } = {}
  ): Promise<{ success: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Keyboard type',
      async (page) => {
        return pageActions.typeText(page, text, options);
      },
      { textLength: text.length }
    );
  }

  async mouseMove(
    sessionId: string,
    pageId: string,
    x: number,
    y: number,
    options: { steps?: number } = {}
  ): Promise<{ success: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Mouse move',
      async (page) => {
        return pageActions.moveMouse(page, x, y, options);
      },
      { x, y }
    );
  }

  async mouseClick(
    sessionId: string,
    pageId: string,
    x: number,
    y: number,
    options: {
      button?: 'left' | 'middle' | 'right';
      clickCount?: number;
      delay?: number;
    } = {}
  ): Promise<{ success: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Mouse click',
      async (page) => {
        return pageActions.clickAt(page, x, y, options);
      },
      { x, y, ...options }
    );
  }

  async doubleClickElement(
    options: ElementInteractionOptions
  ): Promise<{ success: boolean; trialRun?: boolean }> {
    const { sessionId, pageId, selector, timeout, force, trial } = options;

    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      trial ? 'Trial double-click element' : 'Double-click element',
      async (page) => {
        await page.locator(selector).dblclick({ force, timeout, trial });
        return { success: true, trialRun: trial ?? false };
      },
      { selector, trial }
    );
  }

  async focusElement(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Focus element',
      async (page) => {
        await page.locator(selector).focus({ timeout: options.timeout });
        return { success: true };
      },
      { selector }
    );
  }

  async blurElement(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Blur element',
      async (page) => {
        await page.locator(selector).blur({ timeout: options.timeout });
        return { success: true };
      },
      { selector }
    );
  }

  async clearInput(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Clear input',
      async (page) => {
        await page.locator(selector).clear({ timeout: options.timeout });
        return { success: true };
      },
      { selector }
    );
  }

  async uploadFiles(
    sessionId: string,
    pageId: string,
    selector: string,
    filePaths: string[]
  ): Promise<{ success: boolean; filesUploaded: number }> {
    return executePageOperation(
      this.sessionManager,
      this.logger,
      sessionId,
      pageId,
      'Upload files',
      async (page) => {
        const validatedPaths: string[] = [];
        for (const filePath of filePaths) {
          validatedPaths.push(await security.validateUploadPath(filePath));
        }
        await page.locator(selector).setInputFiles(validatedPaths);
        return { success: true, filesUploaded: validatedPaths.length };
      },
      { selector, fileCount: filePaths.length }
    );
  }
}
