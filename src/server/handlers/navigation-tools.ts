/**
 * Navigation Tool Handlers
 *
 * Handles page navigation operations:
 * - browser_navigate: Navigate to URL
 * - browser_navigate_back: Go back in history
 * - wait_for_selector: Wait for element
 * - wait_for_url: Wait for URL change
 * - wait_for_load_state: Wait for page load
 */
import { z } from 'zod';

import type { ToolContext } from './types.js';

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
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
      },
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

  // Wait for Selector Tool
  server.registerTool(
    'wait_for_selector',
    {
      title: 'Wait for Selector',
      description: 'Wait for an element to appear or disappear',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
        selector: z.string().describe('CSS selector'),
        state: z
          .enum(['visible', 'hidden', 'attached', 'detached'])
          .default('visible')
          .describe('State to wait for'),
        timeout: z.number().default(5000).describe('Timeout in milliseconds'),
      },
      outputSchema: {
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
                ? `Element ${selector} is ${state}`
                : `Element ${selector} not found`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error waiting for selector'
    )
  );

  // Note: Additional wait tools (wait_for_url, wait_for_load_state, wait_for_network_idle)
  // can be added once the corresponding methods are implemented in BrowserManager.
  // The page-actions.ts module provides the underlying functionality.
}
