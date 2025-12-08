// Interaction Actions - Direct Playwright locator-based interactions
// @see https://playwright.dev/docs/actionability
// @see https://playwright.dev/docs/locators

import config from '../../config/server-config.js';
import type {
  ElementInteractionOptions,
  AriaRole,
} from '../../config/types.js';
import { validateUploadPath } from '../security.js';
import { BaseAction } from './base-action.js';

const TIMEOUTS = {
  ACTION: config.timeouts.action,
} as const;

/** Common click options for all click methods */
interface ClickOptions {
  force?: boolean;
  timeout?: number;
  trial?: boolean;
  button?: 'left' | 'middle' | 'right';
  clickCount?: number;
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  delay?: number;
}

/** Common text match options */
interface TextMatchOptions {
  exact?: boolean;
  timeout?: number;
}

/**
 * Unified action module for element interactions with Playwright actionability checks.
 *
 * Provides both CSS selector-based and semantic locator methods in a single class.
 * All methods use direct Playwright locator API - no delegation to page-actions.ts.
 *
 * Locator priority (from Playwright best practices):
 * 1. Role-based (getByRole) - most reliable, accessibility-aware
 * 2. Label-based (getByLabel) - form inputs
 * 3. Text-based (getByText) - non-interactive elements
 * 4. TestId-based (getByTestId) - when code control available
 * 5. CSS selectors - last resort fallback
 *
 * @see https://playwright.dev/docs/actionability for actionability checks
 * @see https://playwright.dev/docs/locators for locator strategies
 */
export class InteractionActions extends BaseAction {
  // ============================================================================
  // CSS Selector-Based Methods (for backward compatibility)
  // ============================================================================

  async clickElement(options: ElementInteractionOptions): Promise<{
    success: boolean;
    trialRun?: boolean;
  }> {
    const {
      sessionId,
      pageId,
      selector,
      timeout = TIMEOUTS.ACTION,
      force,
      trial,
      button,
      clickCount,
      modifiers,
      delay,
    } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      trial ? 'Trial click element' : 'Click element',
      async (page) => {
        await page.locator(selector).click({
          force,
          timeout,
          trial,
          button,
          clickCount,
          modifiers,
          delay,
        });
        return { success: true, trialRun: trial ?? false };
      },
      { selector, trial }
    );
  }

  async fillInput(
    options: ElementInteractionOptions & { text: string }
  ): Promise<{ success: boolean }> {
    const {
      sessionId,
      pageId,
      selector,
      text,
      timeout = TIMEOUTS.ACTION,
    } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Fill input',
      async (page) => {
        await page.locator(selector).fill(text, { timeout });
        return { success: true };
      },
      { selector }
    );
  }

  async hoverElement(
    options: ElementInteractionOptions
  ): Promise<{ success: boolean; trialRun?: boolean }> {
    const {
      sessionId,
      pageId,
      selector,
      timeout = TIMEOUTS.ACTION,
      trial,
    } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      trial ? 'Trial hover element' : 'Hover element',
      async (page) => {
        await page.locator(selector).hover({ timeout, trial });
        return { success: true, trialRun: trial ?? false };
      },
      { selector, trial }
    );
  }

  // ============================================================================
  // Role-Based Locators (RECOMMENDED)
  // ============================================================================

  async clickByRole(
    sessionId: string,
    pageId: string,
    role: AriaRole,
    options: ClickOptions & { name?: string; exact?: boolean } = {}
  ): Promise<{ success: boolean }> {
    const {
      name,
      exact,
      force,
      timeout = TIMEOUTS.ACTION,
      ...clickOpts
    } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Click by role',
      async (page) => {
        await page
          .getByRole(role, { name, exact })
          .click({ force, timeout, ...clickOpts });
        return { success: true };
      },
      { role, name }
    );
  }

  async hoverByRole(
    sessionId: string,
    pageId: string,
    role: AriaRole,
    options: TextMatchOptions & { name?: string } = {}
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

  // ============================================================================
  // Label-Based Locators (for form inputs)
  // ============================================================================

  async fillByLabel(
    sessionId: string,
    pageId: string,
    label: string,
    text: string,
    options: TextMatchOptions = {}
  ): Promise<{ success: boolean }> {
    const { exact, timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Fill by label',
      async (page) => {
        await page.getByLabel(label, { exact }).fill(text, { timeout });
        return { success: true };
      },
      { label }
    );
  }

  // ============================================================================
  // Text-Based Locators
  // ============================================================================

  async clickByText(
    sessionId: string,
    pageId: string,
    text: string,
    options: ClickOptions & { exact?: boolean } = {}
  ): Promise<{ success: boolean }> {
    const { exact, force, timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Click by text',
      async (page) => {
        await page.getByText(text, { exact }).click({ force, timeout });
        return { success: true };
      },
      { text }
    );
  }

  async hoverByText(
    sessionId: string,
    pageId: string,
    text: string,
    options: TextMatchOptions = {}
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

  // ============================================================================
  // Placeholder-Based Locators (for inputs without labels)
  // ============================================================================

  async fillByPlaceholder(
    sessionId: string,
    pageId: string,
    placeholder: string,
    text: string,
    options: TextMatchOptions = {}
  ): Promise<{ success: boolean }> {
    const { exact, timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Fill by placeholder',
      async (page) => {
        await page
          .getByPlaceholder(placeholder, { exact })
          .fill(text, { timeout });
        return { success: true };
      },
      { placeholder }
    );
  }

  // ============================================================================
  // TestId-Based Locators
  // ============================================================================

  async clickByTestId(
    sessionId: string,
    pageId: string,
    testId: string,
    options: ClickOptions = {}
  ): Promise<{ success: boolean }> {
    const { force, timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Click by testId',
      async (page) => {
        await page.getByTestId(testId).click({ force, timeout });
        return { success: true };
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
    const { timeout = TIMEOUTS.ACTION } = options;

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

  // ============================================================================
  // Alt Text & Title Locators (for images and titled elements)
  // ============================================================================

  async clickByAltText(
    sessionId: string,
    pageId: string,
    altText: string,
    options: ClickOptions & { exact?: boolean } = {}
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
    options: ClickOptions & { exact?: boolean } = {}
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

  // ============================================================================
  // Form & Selection Methods
  // ============================================================================

  async selectOption(
    sessionId: string,
    pageId: string,
    selector: string,
    value: string | string[],
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; selectedValues: string[] }> {
    const { timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Select option',
      async (page) => {
        const selected = await page
          .locator(selector)
          .selectOption(value, { timeout });
        return { success: true, selectedValues: selected };
      },
      { selector, value }
    );
  }

  async setChecked(
    sessionId: string,
    pageId: string,
    selector: string,
    checked: boolean,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      checked ? 'Check element' : 'Uncheck element',
      async (page) => {
        await page.locator(selector).setChecked(checked, { timeout });
        return { success: true };
      },
      { selector, checked }
    );
  }

  // ============================================================================
  // Keyboard Methods
  // ============================================================================

  async keyboardPress(
    sessionId: string,
    pageId: string,
    key: string,
    options: { delay?: number } = {}
  ): Promise<{ success: boolean }> {
    return this.executePageOperation(
      sessionId,
      pageId,
      'Keyboard press',
      async (page) => {
        await page.keyboard.press(key, options);
        return { success: true };
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
    return this.executePageOperation(
      sessionId,
      pageId,
      'Keyboard type',
      async (page) => {
        await page.keyboard.type(text, options);
        return { success: true };
      },
      { textLength: text.length }
    );
  }

  // ============================================================================
  // Advanced Interactions
  // ============================================================================

  async dragAndDrop(
    sessionId: string,
    pageId: string,
    sourceSelector: string,
    targetSelector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Drag and drop',
      async (page) => {
        await page.dragAndDrop(sourceSelector, targetSelector, { timeout });
        return { success: true };
      },
      { sourceSelector, targetSelector }
    );
  }

  async focusElement(
    sessionId: string,
    pageId: string,
    selector: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean }> {
    const { timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Focus element',
      async (page) => {
        await page.locator(selector).focus({ timeout });
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
    const { timeout = TIMEOUTS.ACTION } = options;

    return this.executePageOperation(
      sessionId,
      pageId,
      'Clear input',
      async (page) => {
        await page.locator(selector).clear({ timeout });
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
    return this.executePageOperation(
      sessionId,
      pageId,
      'Upload files',
      async (page) => {
        const validatedPaths = await Promise.all(
          filePaths.map((fp) => validateUploadPath(fp))
        );
        await page.locator(selector).setInputFiles(validatedPaths);
        return { success: true, filesUploaded: validatedPaths.length };
      },
      { selector, fileCount: filePaths.length }
    );
  }
}
