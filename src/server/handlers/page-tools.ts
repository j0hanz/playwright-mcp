/**
 * Page Tool Handlers
 *
 * Tools for page inspection, screenshots, and waiting:
 * - page_screenshot: Capture page screenshot
 * - page_content: Get page HTML/text content
 * - wait_for_selector: Wait for element to appear
 */
import { z } from 'zod';

import type { ToolContext } from './types.js';

// Shared page input schemas
const basePageInput = {
  sessionId: z.string().describe('Browser session ID'),
  pageId: z.string().describe('Page ID'),
};

const timeoutOption = {
  timeout: z.number().default(30000).describe('Timeout in milliseconds'),
};

export function registerPageTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // Page Screenshot Tool
  server.registerTool(
    'page_screenshot',
    {
      title: 'Take Page Screenshot',
      description:
        'Capture a screenshot of the page. Returns base64-encoded PNG.',
      inputSchema: {
        ...basePageInput,
        fullPage: z
          .boolean()
          .default(false)
          .describe('Capture full scrollable page'),
        path: z
          .string()
          .optional()
          .describe('Optional file path to save screenshot'),
        type: z.enum(['png', 'jpeg']).default('png').describe('Image format'),
        quality: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe('Quality for jpeg (0-100)'),
      },
      outputSchema: {
        success: z.boolean(),
        path: z.string().optional(),
        base64: z.string().optional().describe('Base64-encoded image'),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, fullPage, path, type, quality }) => {
        const result = await browserManager.takeScreenshot({
          sessionId,
          pageId,
          fullPage,
          path,
          type,
          quality,
        });

        // Return as image content when data is available
        if (result.base64) {
          return {
            content: [
              {
                type: 'image' as const,
                data: result.base64,
                mimeType: type === 'jpeg' ? 'image/jpeg' : 'image/png',
              },
            ],
            structuredContent: { success: true, path: result.path },
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: path
                ? `Screenshot saved to ${path}`
                : 'Screenshot captured',
            },
          ],
          structuredContent: { success: true, path: result.path },
        };
      },
      'Error taking screenshot'
    )
  );

  // Page Content Tool
  server.registerTool(
    'page_content',
    {
      title: 'Get Page Content',
      description: 'Retrieve the HTML and text content of the page',
      inputSchema: {
        ...basePageInput,
      },
      outputSchema: {
        success: z.boolean(),
        html: z.string(),
        text: z.string(),
      },
    },
    createToolHandler(async ({ sessionId, pageId }) => {
      const result = await browserManager.getPageContent(sessionId, pageId);

      // Truncate text for display
      const displayText =
        result.text.length > 1000
          ? `${result.text.substring(0, 1000)}... (truncated)`
          : result.text;

      return {
        content: [
          {
            type: 'text' as const,
            text: displayText,
          },
        ],
        structuredContent: { success: true, ...result },
      };
    }, 'Error getting page content')
  );

  // Wait for Selector Tool
  server.registerTool(
    'wait_for_selector',
    {
      title: 'Wait for Selector',
      description:
        'Wait for an element matching the selector to appear or reach a specific state',
      inputSchema: {
        ...basePageInput,
        selector: z.string().describe('CSS selector to wait for'),
        state: z
          .enum(['attached', 'detached', 'visible', 'hidden'])
          .default('visible')
          .describe('Expected element state'),
        ...timeoutOption,
      },
      outputSchema: {
        success: z.boolean(),
        found: z.boolean(),
      },
    },
    createToolHandler(
      async ({ sessionId, pageId, selector, state, timeout }) => {
        const result = await browserManager.waitForSelector(
          sessionId,
          pageId,
          selector,
          { state, timeout }
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: result.found
                ? `Element "${selector}" is ${state}`
                : `Element "${selector}" not found`,
            },
          ],
          structuredContent: { success: result.found, found: result.found },
        };
      },
      'Error waiting for selector'
    )
  );

  // Wait for Download Tool
  server.registerTool(
    'wait_for_download',
    {
      title: 'Wait for Download',
      description:
        'Wait for a file download to complete after triggering an action',
      inputSchema: {
        ...basePageInput,
        ...timeoutOption,
      },
      outputSchema: {
        success: z.boolean(),
        suggestedFilename: z.string().optional(),
        path: z.string().nullable().optional(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, timeout }) => {
      const result = await browserManager.waitForDownload(sessionId, pageId, {
        timeout,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Download complete: ${result.suggestedFilename}`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error waiting for download')
  );
}
