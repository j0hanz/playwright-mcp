/**
 * Locator Tool Handlers
 *
 * Role-based and semantic locator tools following Playwright best practices:
 * - click_by_role: Click using ARIA role (recommended)
 * - fill_by_label: Fill input by label text
 * - click_by_text: Click by visible text
 * - fill_by_placeholder: Fill by placeholder text
 * - click_by_testid: Click by data-testid
 * - fill_by_testid: Fill by data-testid
 * - click_by_alt_text: Click image by alt text
 */
import { z } from 'zod';

import { ARIA_ROLES } from '../../types/index.js';
import {
  baseLocatorInput,
  exactMatchOption,
  forceOption,
  textContent,
  type ToolContext,
} from './types.js';

export function registerLocatorTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // Click by Role Tool (Primary recommended locator)
  server.registerTool(
    'click_by_role',
    {
      title: 'Click Element by Role',
      description:
        'Click an element using its ARIA role (recommended by Playwright). Roles include: button, link, checkbox, textbox, heading, etc.',
      inputSchema: {
        ...baseLocatorInput,
        role: z.enum(ARIA_ROLES).describe('ARIA role of the element'),
        name: z
          .string()
          .optional()
          .describe(
            'Accessible name to filter by (button text, link text, etc.)'
          ),
        ...exactMatchOption,
        ...forceOption,
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
          role,
          { name, exact, force, timeout }
        );

        return {
          content: [textContent(`Clicked ${role}${name ? ` "${name}"` : ''}`)],
          structuredContent: result,
        };
      },
      'Error clicking by role'
    )
  );

  // Fill by Label Tool (Primary for form inputs)
  server.registerTool(
    'fill_by_label',
    {
      title: 'Fill Input by Label',
      description:
        'Fill an input field using its associated label text (recommended for forms)',
      inputSchema: {
        ...baseLocatorInput,
        label: z.string().describe('Label text of the input field'),
        text: z.string().describe('Text to fill'),
        ...exactMatchOption,
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
          content: [textContent(`Filled input labeled "${label}"`)],
          structuredContent: result,
        };
      },
      'Error filling input by label'
    )
  );

  // Click by Text Tool
  server.registerTool(
    'click_by_text',
    {
      title: 'Click Element by Text',
      description: 'Click an element containing specific text',
      inputSchema: {
        ...baseLocatorInput,
        text: z.string().describe('Text content to find'),
        ...exactMatchOption,
        ...forceOption,
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
          content: [textContent(`Clicked element with text "${text}"`)],
          structuredContent: result,
        };
      },
      'Error clicking by text'
    )
  );

  // Fill by Placeholder Tool
  server.registerTool(
    'fill_by_placeholder',
    {
      title: 'Fill Input by Placeholder',
      description: 'Fill an input field using its placeholder text',
      inputSchema: {
        ...baseLocatorInput,
        placeholder: z.string().describe('Placeholder text of the input'),
        text: z.string().describe('Text to fill'),
        ...exactMatchOption,
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
            textContent(`Filled input with placeholder "${placeholder}"`),
          ],
          structuredContent: result,
        };
      },
      'Error filling by placeholder'
    )
  );

  // Click by TestId Tool
  server.registerTool(
    'click_by_testid',
    {
      title: 'Click Element by Test ID',
      description: 'Click an element using data-testid attribute',
      inputSchema: {
        ...baseLocatorInput,
        testId: z.string().describe('Test ID (data-testid value)'),
        ...forceOption,
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
        content: [textContent(`Clicked element with testId "${testId}"`)],
        structuredContent: result,
      };
    }, 'Error clicking by testId')
  );

  // Fill by TestId Tool
  server.registerTool(
    'fill_by_testid',
    {
      title: 'Fill Input by Test ID',
      description: 'Fill an input field using data-testid attribute',
      inputSchema: {
        ...baseLocatorInput,
        testId: z.string().describe('Test ID (data-testid value)'),
        text: z.string().describe('Text to fill'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, testId, text, timeout }) => {
      const result = await browserManager.fillByTestId(
        sessionId,
        pageId,
        testId,
        text,
        { timeout }
      );

      return {
        content: [textContent(`Filled input with testId "${testId}"`)],
        structuredContent: result,
      };
    }, 'Error filling by testId')
  );

  // Click by Alt Text Tool (for images)
  server.registerTool(
    'click_by_alt_text',
    {
      title: 'Click Element by Alt Text',
      description:
        'Click an image element using its alt text attribute (useful for accessibility testing)',
      inputSchema: {
        ...baseLocatorInput,
        altText: z.string().describe('Alt text of the image'),
        ...exactMatchOption,
        ...forceOption,
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, altText, exact, force, timeout }) => {
        const result = await browserManager.clickByAltText(
          sessionId,
          pageId,
          altText,
          { exact, force, timeout }
        );

        return {
          content: [textContent(`Clicked image with alt text "${altText}"`)],
          structuredContent: result,
        };
      },
      'Error clicking by alt text'
    )
  );
}
