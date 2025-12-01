// Navigation Tool Handlers - Page navigation and history operations
// @see https://playwright.dev/docs/api/class-page#page-goto

import { z } from 'zod';

import type { ToolContext } from '../../config/types.js';
import {
  basePageInput,
  navigationAnnotations,
  waitUntilSchema,
} from './schemas.js';
import { textContent } from './types.js';

// ============================================================================
// Schemas - Local schemas specific to navigation
// ============================================================================

const schemas = {
  // Navigation input with URL and wait options
  navigateInput: {
    sessionId: z.string().describe('Browser session ID'),
    url: z.string().url().describe('URL to navigate to'),
    waitUntil: waitUntilSchema
      .default('load')
      .describe('When to consider navigation successful'),
  },

  // Reload options
  reloadInput: {
    ...basePageInput,
    waitUntil: waitUntilSchema
      .default('load')
      .describe('When to consider reload successful'),
  },

  // History navigation input
  historyInput: {
    ...basePageInput,
    direction: z
      .enum(['back', 'forward'])
      .describe('Direction to navigate in browser history'),
  },

  // Output schemas
  pageResult: {
    pageId: z.string(),
    title: z.string(),
    url: z.string(),
  },
  historyResult: {
    success: z.boolean(),
    url: z.string().optional(),
  },
} as const;

export function registerNavigationTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // ============================================================================
  // Primary Navigation
  // ============================================================================

  server.registerTool(
    'browser_navigate',
    {
      title: 'Navigate to URL',
      description: 'Navigate to a URL in the browser',
      annotations: navigationAnnotations,
      inputSchema: schemas.navigateInput,
      outputSchema: schemas.pageResult,
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

  // ============================================================================
  // History Navigation (consolidated back/forward)
  // ============================================================================

  server.registerTool(
    'browser_history',
    {
      title: 'Navigate Browser History',
      description: 'Navigate back or forward in browser history',
      annotations: navigationAnnotations,
      inputSchema: schemas.historyInput,
      outputSchema: schemas.historyResult,
    },
    createToolHandler(async ({ sessionId, pageId, direction }) => {
      const result =
        direction === 'back'
          ? await browserManager.navigationActions.navigateBack(
              sessionId,
              pageId
            )
          : await browserManager.navigationActions.navigateForward(
              sessionId,
              pageId
            );

      return {
        content: [
          textContent(
            `Navigated ${direction}${result.url ? ` to ${result.url}` : ''}`
          ),
        ],
        structuredContent: result,
      };
    }, 'Error navigating history')
  );

  // ============================================================================
  // Page Reload
  // ============================================================================

  server.registerTool(
    'browser_reload',
    {
      title: 'Reload Page',
      description: 'Reload the current page',
      annotations: navigationAnnotations,
      inputSchema: schemas.reloadInput,
      outputSchema: schemas.historyResult,
    },
    createToolHandler(async ({ sessionId, pageId, waitUntil }) => {
      const result = await browserManager.navigationActions.reloadPage(
        sessionId,
        pageId,
        { waitUntil }
      );

      return {
        content: [
          textContent(`Page reloaded${result.url ? `: ${result.url}` : ''}`),
        ],
        structuredContent: result,
      };
    }, 'Error reloading page')
  );
}
