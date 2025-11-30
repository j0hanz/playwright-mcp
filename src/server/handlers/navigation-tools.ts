/**
 * Navigation Tool Handlers
 *
 * Handles page navigation operations:
 * - browser_navigate: Navigate to URL
 * - browser_navigate_back: Go back in history
 *
 * Note: wait_for_selector, wait_for_url, wait_for_load_state tools
 * are in page-tools.ts to follow DRY principle.
 */
import { z } from 'zod';

import { basePageInput, type ToolContext } from './types.js';

export function registerNavigationTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // Navigate Tool
  server.registerTool(
    'browser_navigate',
    {
      title: 'Navigate to URL',
      description: 'Navigate to a URL in the browser',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        url: z.string().url().describe('URL to navigate to'),
        waitUntil: z
          .enum(['load', 'domcontentloaded', 'networkidle', 'commit'])
          .default('load')
          .describe('When to consider navigation successful'),
      },
      outputSchema: {
        pageId: z.string(),
        title: z.string(),
        url: z.string(),
      },
    },
    createToolHandler(async ({ sessionId, url, waitUntil }) => {
      const result = await browserManager.navigateToPage({
        sessionId,
        url,
        waitUntil,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Navigated to: ${result.title} (${result.url})`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error navigating to URL')
  );

  // Navigate Back Tool
  server.registerTool(
    'browser_navigate_back',
    {
      title: 'Navigate Back',
      description: 'Go back to the previous page in browser history',
      inputSchema: basePageInput,
      outputSchema: {
        success: z.boolean(),
        url: z.string().optional(),
      },
    },
    createToolHandler(async ({ sessionId, pageId }) => {
      const result = await browserManager.navigateBack(sessionId, pageId);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Navigated back${result.url ? ` to ${result.url}` : ''}`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error navigating back')
  );
}
