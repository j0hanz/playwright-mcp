/**
 * Assertion Tool Handlers
 *
 * Web-first assertion tools following Playwright best practices:
 * - assert_visible: Assert element is visible
 * - assert_hidden: Assert element is hidden
 * - assert_text: Assert element has specific text
 * - assert_attribute: Assert element has attribute value
 * - assert_value: Assert input has specific value
 * - assert_checked: Assert checkbox/radio state
 * - assert_url: Assert page URL
 * - assert_title: Assert page title
 * - assert_enabled: Assert element is enabled
 * - assert_disabled: Assert element is disabled
 * - assert_focused: Assert element has focus
 * - assert_count: Assert element count
 * - assert_css: Assert CSS property value
 */
import { z } from 'zod';

import {
  baseLocatorInput,
  selectorWithTimeout,
  type ToolContext,
} from './types.js';

export function registerAssertionTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // Assert Visible Tool
  server.registerTool(
    'assert_visible',
    {
      title: 'Assert Element Visible',
      description:
        'Assert that an element is visible on the page (web-first assertion with auto-waiting)',
      inputSchema: selectorWithTimeout,
      outputSchema: {
        success: z.boolean(),
        visible: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, selector, timeout }) => {
      const result = await browserManager.assertVisible(
        sessionId,
        pageId,
        selector,
        { timeout }
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: result.success
              ? `✓ Element ${selector} is visible`
              : `✗ Element ${selector} is NOT visible`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error asserting visibility')
  );

  // Assert Hidden Tool
  server.registerTool(
    'assert_hidden',
    {
      title: 'Assert Element Hidden',
      description:
        'Assert that an element is hidden or not present (web-first assertion with auto-waiting)',
      inputSchema: selectorWithTimeout,
      outputSchema: {
        success: z.boolean(),
        hidden: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, selector, timeout }) => {
      const result = await browserManager.assertHidden(
        sessionId,
        pageId,
        selector,
        { timeout }
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: result.success
              ? `✓ Element ${selector} is hidden`
              : `✗ Element ${selector} is NOT hidden`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error asserting hidden')
  );

  // Assert Text Tool
  server.registerTool(
    'assert_text',
    {
      title: 'Assert Element Text',
      description:
        'Assert that an element has or contains specific text (web-first assertion)',
      inputSchema: {
        ...selectorWithTimeout,
        expectedText: z.string().describe('Expected text content'),
        exact: z
          .boolean()
          .default(false)
          .describe('Whether to match exact text or just contain'),
      },
      outputSchema: {
        success: z.boolean(),
        actualText: z.string().optional(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, expectedText, exact, timeout }) => {
        const result = await browserManager.assertText(
          sessionId,
          pageId,
          selector,
          expectedText,
          { exact, timeout }
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: result.success
                ? `✓ Text assertion passed`
                : `✗ Expected "${expectedText}", got "${result.actualText}"`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error asserting text'
    )
  );

  // Assert Attribute Tool
  server.registerTool(
    'assert_attribute',
    {
      title: 'Assert Element Attribute',
      description: 'Assert that an element has a specific attribute value',
      inputSchema: {
        ...selectorWithTimeout,
        attribute: z.string().describe('Attribute name'),
        expectedValue: z.string().describe('Expected attribute value'),
      },
      outputSchema: {
        success: z.boolean(),
        actualValue: z.string().optional(),
      },
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        selector,
        attribute,
        expectedValue,
        timeout,
      }) => {
        const result = await browserManager.assertAttribute(
          sessionId,
          pageId,
          selector,
          attribute,
          expectedValue,
          { timeout }
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: result.success
                ? `✓ Attribute ${attribute}="${expectedValue}"`
                : `✗ Expected ${attribute}="${expectedValue}", got "${result.actualValue}"`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error asserting attribute'
    )
  );

  // Assert Value Tool
  server.registerTool(
    'assert_value',
    {
      title: 'Assert Input Value',
      description: 'Assert that an input element has a specific value',
      inputSchema: {
        ...selectorWithTimeout,
        expectedValue: z.string().describe('Expected input value'),
      },
      outputSchema: {
        success: z.boolean(),
        actualValue: z.string().optional(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, expectedValue, timeout }) => {
        const result = await browserManager.assertValue(
          sessionId,
          pageId,
          selector,
          expectedValue,
          { timeout }
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: result.success
                ? `✓ Input value="${expectedValue}"`
                : `✗ Expected "${expectedValue}", got "${result.actualValue}"`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error asserting value'
    )
  );

  // Assert Checked Tool
  server.registerTool(
    'assert_checked',
    {
      title: 'Assert Checkbox Checked',
      description:
        'Assert that a checkbox or radio button is checked or unchecked',
      inputSchema: {
        ...selectorWithTimeout,
        checked: z.boolean().default(true).describe('Expected checked state'),
      },
      outputSchema: {
        success: z.boolean(),
        isChecked: z.boolean().optional(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, checked, timeout }) => {
        const result = await browserManager.assertChecked(
          sessionId,
          pageId,
          selector,
          checked,
          { timeout }
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: result.success
                ? `✓ Element is ${checked ? 'checked' : 'unchecked'}`
                : `✗ Expected ${checked ? 'checked' : 'unchecked'}, got ${result.isChecked ? 'checked' : 'unchecked'}`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error asserting checked'
    )
  );

  // Assert URL Tool
  server.registerTool(
    'assert_url',
    {
      title: 'Assert Page URL',
      description: 'Assert that the page has a specific URL',
      inputSchema: {
        ...baseLocatorInput,
        expectedUrl: z
          .string()
          .describe('Expected URL (string or regex pattern)'),
      },
      outputSchema: {
        success: z.boolean(),
        actualUrl: z.string().optional(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, expectedUrl, timeout }) => {
      const result = await browserManager.assertUrl(
        sessionId,
        pageId,
        expectedUrl,
        { timeout }
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: result.success
              ? `✓ URL matches "${expectedUrl}"`
              : `✗ Expected URL "${expectedUrl}", got "${result.actualUrl}"`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error asserting URL')
  );

  // Assert Title Tool
  server.registerTool(
    'assert_title',
    {
      title: 'Assert Page Title',
      description: 'Assert that the page has a specific title',
      inputSchema: {
        ...baseLocatorInput,
        expectedTitle: z.string().describe('Expected page title'),
      },
      outputSchema: {
        success: z.boolean(),
        actualTitle: z.string().optional(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, expectedTitle, timeout }) => {
      const result = await browserManager.assertTitle(
        sessionId,
        pageId,
        expectedTitle,
        { timeout }
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: result.success
              ? `✓ Title matches "${expectedTitle}"`
              : `✗ Expected title "${expectedTitle}", got "${result.actualTitle}"`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error asserting title')
  );

  // Assert Enabled Tool
  server.registerTool(
    'assert_enabled',
    {
      title: 'Assert Element Enabled',
      description:
        'Assert that an element is enabled (web-first assertion with auto-waiting)',
      inputSchema: selectorWithTimeout,
      outputSchema: {
        success: z.boolean(),
        enabled: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, selector, timeout }) => {
      const result = await browserManager.assertEnabled(
        sessionId,
        pageId,
        selector,
        { timeout }
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: result.success
              ? `✓ Element ${selector} is enabled`
              : `✗ Element ${selector} is NOT enabled`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error asserting enabled')
  );

  // Assert Disabled Tool
  server.registerTool(
    'assert_disabled',
    {
      title: 'Assert Element Disabled',
      description:
        'Assert that an element is disabled (web-first assertion with auto-waiting)',
      inputSchema: selectorWithTimeout,
      outputSchema: {
        success: z.boolean(),
        disabled: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, selector, timeout }) => {
      const result = await browserManager.assertDisabled(
        sessionId,
        pageId,
        selector,
        { timeout }
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: result.success
              ? `✓ Element ${selector} is disabled`
              : `✗ Element ${selector} is NOT disabled`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error asserting disabled')
  );

  // Assert Focused Tool
  server.registerTool(
    'assert_focused',
    {
      title: 'Assert Element Focused',
      description:
        'Assert that an element has focus (web-first assertion with auto-waiting)',
      inputSchema: selectorWithTimeout,
      outputSchema: {
        success: z.boolean(),
        focused: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, selector, timeout }) => {
      const result = await browserManager.assertFocused(
        sessionId,
        pageId,
        selector,
        { timeout }
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: result.success
              ? `✓ Element ${selector} has focus`
              : `✗ Element ${selector} does NOT have focus`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error asserting focused')
  );

  // Assert Count Tool
  server.registerTool(
    'assert_count',
    {
      title: 'Assert Element Count',
      description:
        'Assert that the number of elements matching the selector equals expected count',
      inputSchema: {
        ...selectorWithTimeout,
        expectedCount: z.number().describe('Expected number of elements'),
      },
      outputSchema: {
        success: z.boolean(),
        actualCount: z.number(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, expectedCount, timeout }) => {
        const result = await browserManager.assertCount(
          sessionId,
          pageId,
          selector,
          expectedCount,
          { timeout }
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: result.success
                ? `✓ Found ${expectedCount} element(s) matching ${selector}`
                : `✗ Expected ${expectedCount} element(s), found ${result.actualCount}`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error asserting count'
    )
  );

  // Assert CSS Tool
  server.registerTool(
    'assert_css',
    {
      title: 'Assert CSS Property',
      description: 'Assert that an element has a specific CSS property value',
      inputSchema: {
        ...selectorWithTimeout,
        property: z
          .string()
          .describe('CSS property name (e.g., "color", "display")'),
        expectedValue: z.string().describe('Expected CSS property value'),
      },
      outputSchema: {
        success: z.boolean(),
        actualValue: z.string().optional(),
      },
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        selector,
        property,
        expectedValue,
        timeout,
      }) => {
        const result = await browserManager.assertCss(
          sessionId,
          pageId,
          selector,
          property,
          expectedValue,
          { timeout }
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: result.success
                ? `✓ CSS ${property}="${expectedValue}"`
                : `✗ Expected ${property}="${expectedValue}", got "${result.actualValue}"`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error asserting CSS'
    )
  );
}
