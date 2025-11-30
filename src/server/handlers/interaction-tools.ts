/**
 * Interaction Tool Handlers
 *
 * Handles element interaction operations using CSS selectors:
 * - element_click: Click element by selector
 * - element_fill: Fill input by selector
 * - element_hover: Hover over element
 * - select_option: Select dropdown option
 * - drag_and_drop: Drag element to target
 *
 * Note: Role-based and semantic locator tools (click_by_role, fill_by_label, etc.)
 * are in locator-tools.ts to follow DRY principle.
 */
import { z } from 'zod';

import {
  basePageInput,
  textContent,
  timeoutOption,
  type ToolContext,
} from './types.js';

export function registerInteractionTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // Click Element Tool
  server.registerTool(
    'element_click',
    {
      title: 'Click Element',
      description: 'Click on an element using a CSS selector',
      inputSchema: {
        ...basePageInput,
        selector: z.string().describe('CSS selector for the element'),
        force: z
          .boolean()
          .default(false)
          .describe('Force click even if element is not visible'),
        button: z
          .enum(['left', 'middle', 'right'])
          .default('left')
          .describe('Mouse button to use'),
        clickCount: z
          .number()
          .min(1)
          .max(3)
          .default(1)
          .describe('Number of clicks (1=single, 2=double, 3=triple)'),
        modifiers: z
          .array(z.enum(['Alt', 'Control', 'Meta', 'Shift']))
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
      },
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        selector,
        force,
        button,
        clickCount,
        modifiers,
        delay,
      }) => {
        const result = await browserManager.clickElement({
          sessionId,
          pageId,
          selector,
          force,
          button,
          clickCount,
          modifiers,
          delay,
        });

        return {
          content: [textContent(`Clicked element: ${selector}`)],
          structuredContent: result,
        };
      },
      'Error clicking element'
    )
  );

  // Fill Input Tool
  server.registerTool(
    'element_fill',
    {
      title: 'Fill Input',
      description: 'Fill text into an input field',
      inputSchema: {
        ...basePageInput,
        selector: z.string().describe('CSS selector for the input'),
        text: z.string().describe('Text to fill'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, selector, text }) => {
      const result = await browserManager.fillInput({
        sessionId,
        pageId,
        selector,
        text,
      });

      return {
        content: [textContent(`Filled input ${selector} with text`)],
        structuredContent: result,
      };
    }, 'Error filling input')
  );

  // Hover Element Tool
  server.registerTool(
    'element_hover',
    {
      title: 'Hover Element',
      description: 'Hover over an element',
      inputSchema: {
        ...basePageInput,
        selector: z.string().describe('CSS selector for the element'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, selector }) => {
      const result = await browserManager.hoverElement({
        sessionId,
        pageId,
        selector,
      });

      return {
        content: [textContent(`Hovered over element: ${selector}`)],
        structuredContent: result,
      };
    }, 'Error hovering element')
  );

  // Select Option Tool
  server.registerTool(
    'select_option',
    {
      title: 'Select Option',
      description: 'Select an option from a dropdown/select element',
      inputSchema: {
        ...basePageInput,
        selector: z.string().describe('CSS selector for the select element'),
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
        const result = await browserManager.selectOption(
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

  // Note: element_check (setChecked) tool can be added once the method is implemented
  // in BrowserManager. The page-actions.ts module provides the underlying functionality.

  // Drag and Drop Tool
  server.registerTool(
    'drag_and_drop',
    {
      title: 'Drag and Drop',
      description: 'Drag an element and drop it on another element',
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
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        sourceSelector,
        targetSelector,
        timeout,
      }) => {
        const result = await browserManager.dragAndDrop(
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
}
