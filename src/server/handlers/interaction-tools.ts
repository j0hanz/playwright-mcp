// Interaction Tool Handlers - Unified element interactions with multiple locator strategies
// @see https://playwright.dev/docs/locators

import { z } from 'zod';

import { ARIA_ROLES, type ToolContext } from '../../config/types.js';
import { withRetry, formatRetryInfo } from '../../utils/retry.js';
import {
  basePageInput,
  clickLocatorTypeSchema,
  destructiveAnnotations,
  exactMatchOption,
  fillLocatorTypeSchema,
  hoverLocatorTypeSchema,
  interactionAnnotations,
  keyModifiersSchema,
  mouseButtonSchema,
  retryOptions,
  selectorInput,
  timeoutOption,
} from './schemas.js';
import { textContent } from './types.js';

// ============================================================================
// Shared Schemas (local to this file)
// ============================================================================

const forceSchema = z
  .boolean()
  .default(false)
  .describe('Force action even if element is not visible');

export function registerInteractionTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // ============================================================================
  // Unified Click Tool - Consolidates all click operations
  // ============================================================================

  server.registerTool(
    'element_click',
    {
      title: 'Click Element',
      description: `Click an element using various locator strategies. 
Locator types (in recommended priority order):
- 'role': ARIA role (button, link, checkbox, etc.) - RECOMMENDED for accessibility
- 'text': Visible text content
- 'testid': data-testid attribute
- 'title': Element's title attribute
- 'altText': Image alt text
- 'selector': CSS selector (least recommended, use as fallback)

Supports automatic retries for flaky elements.`,
      annotations: interactionAnnotations,
      inputSchema: {
        ...basePageInput,
        locatorType: clickLocatorTypeSchema.describe(
          'Type of locator to use for finding the element'
        ),
        // Locator value - meaning depends on locatorType
        value: z
          .string()
          .describe(
            'Locator value: CSS selector, role name, text, testid, or alt text'
          ),
        // Role-specific options
        name: z
          .string()
          .optional()
          .describe(
            'Accessible name for role locator (button text, link text, etc.)'
          ),
        role: z
          .enum(ARIA_ROLES)
          .optional()
          .describe('ARIA role (required when locatorType is "role")'),
        // Common options
        ...exactMatchOption,
        force: forceSchema,
        ...timeoutOption,
        ...retryOptions,
        // Advanced click options
        button: mouseButtonSchema
          .default('left')
          .describe('Mouse button to use'),
        clickCount: z
          .number()
          .min(1)
          .max(3)
          .default(1)
          .describe('Number of clicks (1=single, 2=double, 3=triple)'),
        modifiers: keyModifiersSchema
          .optional()
          .describe('Keyboard modifiers to hold'),
        delay: z
          .number()
          .min(0)
          .max(1000)
          .optional()
          .describe('Time between mousedown and mouseup in ms'),
      },
      outputSchema: {
        success: z.boolean(),
        elementInfo: z.record(z.string(), z.unknown()).optional(),
        retriesUsed: z.number().optional(),
      },
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        locatorType,
        value,
        name,
        role,
        exact,
        force,
        timeout,
        retries,
        retryDelay,
        button,
        clickCount,
        modifiers,
        delay,
      }) => {
        let result: { success: boolean } = { success: false };
        let description: string;
        let retriesUsed = 0;

        const executeClick = async () => {
          switch (locatorType) {
            case 'role': {
              // Role requires the role parameter, value is used as name if name not provided
              const roleValue = role ?? (value as (typeof ARIA_ROLES)[number]);
              const roleName = name ?? (role ? value : undefined);
              return browserManager.locatorActions.clickByRole(
                sessionId,
                pageId,
                roleValue,
                { name: roleName, exact, force, timeout }
              );
            }
            case 'text':
              return browserManager.locatorActions.clickByText(
                sessionId,
                pageId,
                value,
                { exact, force, timeout }
              );
            case 'testid':
              return browserManager.locatorActions.clickByTestId(
                sessionId,
                pageId,
                value,
                { force, timeout }
              );
            case 'altText':
              return browserManager.locatorActions.clickByAltText(
                sessionId,
                pageId,
                value,
                { exact, force, timeout }
              );
            case 'title':
              return browserManager.locatorActions.clickByTitle(
                sessionId,
                pageId,
                value,
                { exact, force, timeout }
              );
            case 'selector':
            default:
              return browserManager.interactionActions.clickElement({
                sessionId,
                pageId,
                selector: value,
                force,
                button,
                clickCount,
                modifiers,
                delay,
              });
          }
        };

        // Execute with retry support
        if (retries > 0) {
          const retryResult = await withRetry(executeClick, {
            retries,
            retryDelay,
          });
          result = retryResult.result;
          retriesUsed = retryResult.retriesUsed;
        } else {
          result = await executeClick();
        }

        // Build description based on locator type
        switch (locatorType) {
          case 'role': {
            const roleValue = role ?? value;
            const roleName = name ?? (role ? value : undefined);
            description = `Clicked ${roleValue}${roleName ? ` "${roleName}"` : ''}`;
            break;
          }
          case 'text':
            description = `Clicked element with text "${value}"`;
            break;
          case 'testid':
            description = `Clicked element with testId "${value}"`;
            break;
          case 'altText':
            description = `Clicked image with alt text "${value}"`;
            break;
          case 'title':
            description = `Clicked element with title "${value}"`;
            break;
          default:
            description = `Clicked element: ${value}`;
        }

        if (retriesUsed > 0) {
          description += ` ${formatRetryInfo(retriesUsed)}`;
        }

        return {
          content: [textContent(description)],
          structuredContent: { ...result, retriesUsed },
        };
      },
      'Error clicking element'
    )
  );

  // ============================================================================
  // Unified Fill Tool - Consolidates all fill operations
  // ============================================================================

  server.registerTool(
    'element_fill',
    {
      title: 'Fill Input',
      description: `Fill text into an input field using various locator strategies.
Locator types (in recommended priority order):
- 'label': Input's associated label text - RECOMMENDED for accessibility
- 'placeholder': Input's placeholder text
- 'testid': data-testid attribute
- 'selector': CSS selector (least recommended, use as fallback)

Supports automatic retries for flaky elements.`,
      annotations: interactionAnnotations,
      inputSchema: {
        ...basePageInput,
        locatorType: fillLocatorTypeSchema.describe(
          'Type of locator to use for finding the input'
        ),
        // Locator value - meaning depends on locatorType
        value: z
          .string()
          .describe(
            'Locator value: CSS selector, label text, placeholder text, or testid'
          ),
        text: z.string().describe('Text to fill into the input'),
        // Common options
        ...exactMatchOption,
        ...timeoutOption,
        ...retryOptions,
      },
      outputSchema: {
        success: z.boolean(),
        retriesUsed: z.number().optional(),
      },
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        locatorType,
        value,
        text,
        exact,
        timeout,
        retries,
        retryDelay,
      }) => {
        let result: { success: boolean };
        let description: string;
        let retriesUsed = 0;

        const executeFill = async () => {
          switch (locatorType) {
            case 'label':
              return browserManager.locatorActions.fillByLabel(
                sessionId,
                pageId,
                value,
                text,
                { exact, timeout }
              );
            case 'placeholder':
              return browserManager.locatorActions.fillByPlaceholder(
                sessionId,
                pageId,
                value,
                text,
                { exact, timeout }
              );
            case 'testid':
              return browserManager.locatorActions.fillByTestId(
                sessionId,
                pageId,
                value,
                text,
                { timeout }
              );
            case 'selector':
            default:
              return browserManager.interactionActions.fillInput({
                sessionId,
                pageId,
                selector: value,
                text,
              });
          }
        };

        // Execute with retry support
        if (retries > 0) {
          const retryResult = await withRetry(executeFill, {
            retries,
            retryDelay,
          });
          result = retryResult.result;
          retriesUsed = retryResult.retriesUsed;
        } else {
          result = await executeFill();
        }

        switch (locatorType) {
          case 'label':
            description = `Filled input labeled "${value}"`;
            break;
          case 'placeholder':
            description = `Filled input with placeholder "${value}"`;
            break;
          case 'testid':
            description = `Filled input with testId "${value}"`;
            break;
          default:
            description = `Filled input ${value}`;
        }

        if (retriesUsed > 0) {
          description += ` ${formatRetryInfo(retriesUsed)}`;
        }

        return {
          content: [textContent(description)],
          structuredContent: { ...result, retriesUsed },
        };
      },
      'Error filling input'
    )
  );

  // ============================================================================
  // Unified Hover Tool - Enhanced with locator strategies
  // ============================================================================

  server.registerTool(
    'element_hover',
    {
      title: 'Hover Element',
      description: `Hover over an element using various locator strategies.
Locator types (in recommended priority order):
- 'role': ARIA role (button, link, etc.) - RECOMMENDED for accessibility
- 'text': Visible text content
- 'testid': data-testid attribute
- 'selector': CSS selector (least recommended, use as fallback)`,
      annotations: interactionAnnotations,
      inputSchema: {
        ...basePageInput,
        locatorType: hoverLocatorTypeSchema
          .default('selector')
          .describe('Type of locator to use for finding the element'),
        // Locator value - meaning depends on locatorType
        value: z
          .string()
          .describe('Locator value: CSS selector, role name, text, or testid'),
        // Role-specific options
        name: z
          .string()
          .optional()
          .describe(
            'Accessible name for role locator (button text, link text, etc.)'
          ),
        role: z
          .enum(ARIA_ROLES)
          .optional()
          .describe('ARIA role (required when locatorType is "role")'),
        // Common options
        ...exactMatchOption,
        ...timeoutOption,
      },
      outputSchema: { success: z.boolean() },
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        locatorType,
        value,
        name,
        role,
        exact,
        timeout,
      }) => {
        let result: { success: boolean };
        let description: string;

        switch (locatorType) {
          case 'role': {
            const roleValue = role ?? (value as (typeof ARIA_ROLES)[number]);
            const roleName = name ?? (role ? value : undefined);
            result = await browserManager.locatorActions.hoverByRole(
              sessionId,
              pageId,
              roleValue,
              { name: roleName, exact, timeout }
            );
            description = `Hovered ${roleValue}${roleName ? ` "${roleName}"` : ''}`;
            break;
          }
          case 'text':
            result = await browserManager.locatorActions.hoverByText(
              sessionId,
              pageId,
              value,
              { exact, timeout }
            );
            description = `Hovered element with text "${value}"`;
            break;
          case 'testid':
            result = await browserManager.locatorActions.hoverByTestId(
              sessionId,
              pageId,
              value,
              { timeout }
            );
            description = `Hovered element with testId "${value}"`;
            break;
          case 'selector':
          default:
            result = await browserManager.interactionActions.hoverElement({
              sessionId,
              pageId,
              selector: value,
              timeout,
            });
            description = `Hovered over element: ${value}`;
            break;
        }

        return {
          content: [textContent(description)],
          structuredContent: result,
        };
      },
      'Error hovering element'
    )
  );

  // Select Option Tool
  server.registerTool(
    'select_option',
    {
      title: 'Select Option',
      description: 'Select an option from a dropdown/select element',
      annotations: interactionAnnotations,
      inputSchema: {
        ...selectorInput,
        value: z
          .union([z.string(), z.array(z.string())])
          .describe('Value(s) to select'),
        ...timeoutOption,
      },
      outputSchema: {
        success: z.boolean(),
        selectedValues: z.array(z.string()),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, value, timeout }) => {
        const result = await browserManager.interactionActions.selectOption(
          sessionId,
          pageId,
          selector,
          value,
          { timeout }
        );
        return {
          content: [textContent(`Selected option(s) in ${selector}`)],
          structuredContent: result,
        };
      },
      'Error selecting option'
    )
  );

  // Drag and Drop Tool
  server.registerTool(
    'drag_and_drop',
    {
      title: 'Drag and Drop',
      description: 'Drag an element and drop it on another element',
      annotations: interactionAnnotations,
      inputSchema: {
        ...basePageInput,
        sourceSelector: z
          .string()
          .describe('CSS selector for the source element'),
        targetSelector: z
          .string()
          .describe('CSS selector for the target element'),
        ...timeoutOption,
      },
      outputSchema: { success: z.boolean() },
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        sourceSelector,
        targetSelector,
        timeout,
      }) => {
        const result = await browserManager.interactionActions.dragAndDrop(
          sessionId,
          pageId,
          sourceSelector,
          targetSelector,
          { timeout }
        );
        return {
          content: [
            textContent(`Dragged ${sourceSelector} to ${targetSelector}`),
          ],
          structuredContent: result,
        };
      },
      'Error during drag and drop'
    )
  );

  // ============================================================================
  // Keyboard Tools
  // ============================================================================

  server.registerTool(
    'keyboard_press',
    {
      title: 'Press Keyboard Key',
      description: `Press a keyboard key or key combination. 
Examples: 'Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
'Control+a', 'Control+c', 'Control+v', 'Shift+Tab', 'Alt+F4', 'Meta+Enter'`,
      annotations: interactionAnnotations,
      inputSchema: {
        ...basePageInput,
        key: z
          .string()
          .describe(
            'Key to press (e.g., Enter, Tab, Escape, Control+a, Shift+Tab)'
          ),
        delay: z
          .number()
          .min(0)
          .max(1000)
          .optional()
          .describe('Time between keydown and keyup in milliseconds'),
      },
      outputSchema: { success: z.boolean() },
    },
    createToolHandler(async ({ sessionId, pageId, key, delay }) => {
      const result = await browserManager.interactionActions.keyboardPress(
        sessionId,
        pageId,
        key,
        { delay }
      );
      return {
        content: [textContent(`Pressed key: ${key}`)],
        structuredContent: result,
      };
    }, 'Error pressing keyboard key')
  );

  server.registerTool(
    'keyboard_type',
    {
      title: 'Type Text',
      description:
        'Type text character by character (simulates real typing). Use element_fill for faster input, use this for character-by-character typing simulation.',
      annotations: interactionAnnotations,
      inputSchema: {
        ...basePageInput,
        text: z.string().describe('Text to type'),
        delay: z
          .number()
          .min(0)
          .max(500)
          .optional()
          .describe('Delay between key presses in milliseconds'),
      },
      outputSchema: { success: z.boolean() },
    },
    createToolHandler(async ({ sessionId, pageId, text, delay }) => {
      const result = await browserManager.interactionActions.keyboardType(
        sessionId,
        pageId,
        text,
        { delay }
      );
      return {
        content: [textContent(`Typed ${text.length} characters`)],
        structuredContent: result,
      };
    }, 'Error typing text')
  );

  // ============================================================================
  // File Upload Tool
  // ============================================================================

  server.registerTool(
    'file_upload',
    {
      title: 'Upload Files',
      description:
        'Upload one or more files to a file input element. The selector should target an <input type="file"> element.',
      annotations: interactionAnnotations,
      inputSchema: {
        ...basePageInput,
        selector: z
          .string()
          .describe('CSS selector for the file input element'),
        filePaths: z
          .array(z.string())
          .min(1)
          .describe('Array of absolute file paths to upload'),
      },
      outputSchema: {
        success: z.boolean(),
        filesUploaded: z.number(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, selector, filePaths }) => {
      const result = await browserManager.interactionActions.uploadFiles(
        sessionId,
        pageId,
        selector,
        filePaths
      );
      return {
        content: [
          textContent(
            `Uploaded ${result.filesUploaded} file(s) to ${selector}`
          ),
        ],
        structuredContent: result,
      };
    }, 'Error uploading files')
  );

  // ============================================================================
  // Checkbox/Toggle Tool
  // ============================================================================

  server.registerTool(
    'checkbox_set',
    {
      title: 'Set Checkbox State',
      description:
        'Check or uncheck a checkbox element. Works with both <input type="checkbox"> and toggle-like elements.',
      annotations: interactionAnnotations,
      inputSchema: {
        ...basePageInput,
        selector: z.string().describe('CSS selector for the checkbox element'),
        checked: z.boolean().describe('Whether the checkbox should be checked'),
        ...timeoutOption,
      },
      outputSchema: { success: z.boolean() },
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, checked, timeout }) => {
        const result = await browserManager.interactionActions.setChecked(
          sessionId,
          pageId,
          selector,
          checked,
          { timeout }
        );
        return {
          content: [
            textContent(
              `${checked ? 'Checked' : 'Unchecked'} checkbox: ${selector}`
            ),
          ],
          structuredContent: result,
        };
      },
      'Error setting checkbox state'
    )
  );

  // ============================================================================
  // Focus/Blur Tools
  // ============================================================================

  server.registerTool(
    'element_focus',
    {
      title: 'Focus Element',
      description:
        'Focus an element (e.g., to trigger focus events or enable keyboard input)',
      annotations: interactionAnnotations,
      inputSchema: {
        ...selectorInput,
        ...timeoutOption,
      },
      outputSchema: { success: z.boolean() },
    },
    createToolHandler(async ({ sessionId, pageId, selector, timeout }) => {
      const result = await browserManager.interactionActions.focusElement(
        sessionId,
        pageId,
        selector,
        { timeout }
      );
      return {
        content: [textContent(`Focused element: ${selector}`)],
        structuredContent: result,
      };
    }, 'Error focusing element')
  );

  // ============================================================================
  // Clear Input Tool
  // ============================================================================

  server.registerTool(
    'element_clear',
    {
      title: 'Clear Input',
      description: 'Clear the contents of an input or textarea element',
      annotations: destructiveAnnotations,
      inputSchema: {
        ...selectorInput,
        ...timeoutOption,
      },
      outputSchema: { success: z.boolean() },
    },
    createToolHandler(async ({ sessionId, pageId, selector, timeout }) => {
      const result = await browserManager.interactionActions.clearInput(
        sessionId,
        pageId,
        selector,
        { timeout }
      );
      return {
        content: [textContent(`Cleared input: ${selector}`)],
        structuredContent: result,
      };
    }, 'Error clearing input')
  );
}
