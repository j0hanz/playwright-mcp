// Navigation Tool Handlers - Page navigation and history operations
// @see https://playwright.dev/docs/api/class-page#page-goto

import { z } from 'zod';

import type { ToolContext } from '../../config/types.js';
import { basePageInput, textContent } from './types.js';

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
      const result = await browserManager.navigationActions.navigateToPage({
        sessionId,
        url,
        waitUntil,
      });

      return {
        content: [textContent(`Navigated to: ${result.title} (${result.url})`)],
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
      const result = await browserManager.navigationActions.navigateBack(
        sessionId,
        pageId
      );

      return {
        content: [
          textContent(`Navigated back${result.url ? ` to ${result.url}` : ''}`),
        ],
        structuredContent: result,
      };
    }, 'Error navigating back')
  );
}
