/**
 * Interaction Tool Handlers
 *
 * Handles element interaction operations:
 * - element_click: Click element by selector
 * - element_fill: Fill input by selector
 * - element_hover: Hover over element
 * - click_by_role: Click by ARIA role
 * - click_by_text: Click by text content
 * - click_by_testid: Click by data-testid
 * - fill_by_label: Fill input by label
 * - fill_by_placeholder: Fill by placeholder
 */
import { z } from 'zod';

import { ARIA_ROLES, type AriaRole } from '../../types/index.js';
import { type ToolContext } from './types.js';

// Helper to create non-empty tuple for zod enum
function toNonEmptyTuple<T extends readonly [string, ...string[]]>(arr: T): T {
  return arr;
}

export function registerInteractionTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // Click Element Tool
  server.registerTool(
    'element_click',
    {
      title: 'Click Element',
      description: 'Click on an element using a CSS selector',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
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
          content: [
            { type: 'text' as const, text: `Clicked element: ${selector}` },
          ],
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
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
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
        content: [
          {
            type: 'text' as const,
            text: `Filled input ${selector} with text`,
          },
        ],
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
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
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
        content: [
          {
            type: 'text' as const,
            text: `Hovered over element: ${selector}`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error hovering element')
  );

  // Click by Role Tool (Playwright Best Practice)
  server.registerTool(
    'click_by_role',
    {
      title: 'Click Element by Role',
      description:
        'Click an element using its ARIA role (recommended by Playwright). Roles include: button, link, checkbox, textbox, heading, etc.',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
        role: z
          .enum(toNonEmptyTuple(ARIA_ROLES as readonly [string, ...string[]]))
          .describe('ARIA role of the element'), // Uses shared ARIA_ROLES constant for consistency
        name: z
          .string()
          .optional()
          .describe(
            'Accessible name to filter by (button text, link text, etc.)'
          ),
        exact: z
          .boolean()
          .default(false)
          .describe('Whether name match should be exact'),
        force: z
          .boolean()
          .default(false)
          .describe('Force click even if not actionable'),
        timeout: z.number().default(5000).describe('Timeout in milliseconds'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, role, name, exact, force, timeout }) => {
        const result = await browserManager.clickByRole(
          sessionId,
          pageId,
          role as AriaRole,
          { name, exact, force, timeout }
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: `Clicked ${role}${name ? ` "${name}"` : ''}`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error clicking by role'
    )
  );

  // Click by Text Tool
  server.registerTool(
    'click_by_text',
    {
      title: 'Click Element by Text',
      description: 'Click an element containing specific text',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
        text: z.string().describe('Text content to find'),
        exact: z
          .boolean()
          .default(false)
          .describe('Whether text match should be exact'),
        force: z
          .boolean()
          .default(false)
          .describe('Force click even if not actionable'),
        timeout: z.number().default(5000).describe('Timeout in milliseconds'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, text, exact, force, timeout }) => {
        const result = await browserManager.clickByText(
          sessionId,
          pageId,
          text,
          { exact, force, timeout }
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: `Clicked element with text "${text}"`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error clicking by text'
    )
  );

  // Click by TestId Tool
  server.registerTool(
    'click_by_testid',
    {
      title: 'Click Element by Test ID',
      description: 'Click an element using data-testid attribute',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
        testId: z.string().describe('Test ID (data-testid value)'),
        force: z
          .boolean()
          .default(false)
          .describe('Force click even if not actionable'),
        timeout: z.number().default(5000).describe('Timeout in milliseconds'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, testId, force, timeout }) => {
      const result = await browserManager.clickByTestId(
        sessionId,
        pageId,
        testId,
        { force, timeout }
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: `Clicked element with testId "${testId}"`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error clicking by testId')
  );

  // Fill by Label Tool
  server.registerTool(
    'fill_by_label',
    {
      title: 'Fill Input by Label',
      description:
        'Fill an input field using its associated label text (recommended for forms)',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
        label: z.string().describe('Label text of the input field'),
        text: z.string().describe('Text to fill'),
        exact: z
          .boolean()
          .default(false)
          .describe('Whether label match should be exact'),
        timeout: z.number().default(5000).describe('Timeout in milliseconds'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, label, text, exact, timeout }) => {
        const result = await browserManager.fillByLabel(
          sessionId,
          pageId,
          label,
          text,
          { exact, timeout }
        );

        return {
          content: [
            { type: 'text' as const, text: `Filled input labeled "${label}"` },
          ],
          structuredContent: result,
        };
      },
      'Error filling input by label'
    )
  );

  // Fill by Placeholder Tool
  server.registerTool(
    'fill_by_placeholder',
    {
      title: 'Fill Input by Placeholder',
      description: 'Fill an input field using its placeholder text',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
        placeholder: z.string().describe('Placeholder text of the input'),
        text: z.string().describe('Text to fill'),
        exact: z
          .boolean()
          .default(false)
          .describe('Whether placeholder match should be exact'),
        timeout: z.number().default(5000).describe('Timeout in milliseconds'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, placeholder, text, exact, timeout }) => {
        const result = await browserManager.fillByPlaceholder(
          sessionId,
          pageId,
          placeholder,
          text,
          { exact, timeout }
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: `Filled input with placeholder "${placeholder}"`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error filling by placeholder'
    )
  );

  // Select Option Tool
  server.registerTool(
    'select_option',
    {
      title: 'Select Option',
      description: 'Select an option from a dropdown/select element',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
        selector: z.string().describe('CSS selector for the select element'),
        value: z
          .union([z.string(), z.array(z.string())])
          .describe('Value(s) to select'),
        timeout: z.number().default(5000).describe('Timeout in milliseconds'),
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
          content: [
            {
              type: 'text' as const,
              text: `Selected option(s) in ${selector}`,
            },
          ],
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
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
        sourceSelector: z
          .string()
          .describe('CSS selector for the source element'),
        targetSelector: z
          .string()
          .describe('CSS selector for the target element'),
        timeout: z.number().default(5000).describe('Timeout in milliseconds'),
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
            {
              type: 'text' as const,
              text: `Dragged ${sourceSelector} to ${targetSelector}`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error during drag and drop'
    )
  );
}
