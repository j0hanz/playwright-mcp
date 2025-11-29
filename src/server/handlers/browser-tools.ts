/**
 * Browser Tool Handlers
 *
 * Handles browser lifecycle operations:
 * - browser_launch: Launch new browser instances
 * - browser_close: Close browser sessions
 * - browser_resize: Resize viewport
 * - browser_tabs: Manage browser tabs
 * - sessions_list: List active sessions
 */
import { z } from 'zod';

import type { ToolContext } from './types.js';

export function registerBrowserTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // Browser Launch Tool
  server.registerTool(
    'browser_launch',
    {
      title: 'Launch Browser',
      description:
        'Launch a new browser instance (Chromium, Firefox, or WebKit) with optional video recording',
      inputSchema: {
        browserType: z
          .enum(['chromium', 'firefox', 'webkit'])
          .default('chromium')
          .describe('Browser type to launch'),
        headless: z.boolean().default(true).describe('Run in headless mode'),
        viewportWidth: z.number().default(1920).describe('Viewport width'),
        viewportHeight: z.number().default(1080).describe('Viewport height'),
        channel: z
          .string()
          .optional()
          .describe('Browser channel (e.g., chrome, chrome-beta, msedge)'),
        slowMo: z
          .number()
          .min(0)
          .max(5000)
          .optional()
          .describe('Slow down operations by ms'),
        proxy: z
          .object({
            server: z.string().describe('Proxy server URL'),
            bypass: z.string().optional().describe('Domains to bypass proxy'),
            username: z.string().optional(),
            password: z.string().optional(),
          })
          .optional()
          .describe('Proxy configuration'),
        recordVideo: z
          .object({
            dir: z.string().describe('Directory to save video recordings'),
            width: z
              .number()
              .optional()
              .describe('Video width (defaults to viewport)'),
            height: z
              .number()
              .optional()
              .describe('Video height (defaults to viewport)'),
          })
          .optional()
          .describe('Video recording configuration'),
      },
      outputSchema: {
        sessionId: z.string(),
        browserType: z.string(),
        recordingVideo: z.boolean(),
      },
    },
    createToolHandler(
      async ({
        browserType,
        headless,
        viewportWidth,
        viewportHeight,
        channel,
        slowMo,
        proxy,
        recordVideo,
      }) => {
        const result = await browserManager.launchBrowser({
          browserType,
          headless,
          viewport: { width: viewportWidth, height: viewportHeight },
          channel,
          slowMo,
          proxy,
          recordVideo: recordVideo
            ? {
                dir: recordVideo.dir,
                size:
                  recordVideo.width && recordVideo.height
                    ? { width: recordVideo.width, height: recordVideo.height }
                    : undefined,
              }
            : undefined,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Browser launched: ${result.browserType}${result.recordingVideo ? ' (recording video)' : ''}`,
            },
          ],
          structuredContent: result,
        };
      },
      'Error launching browser'
    )
  );

  // Close Browser Tool
  server.registerTool(
    'browser_close',
    {
      title: 'Close Browser',
      description: 'Close a browser session',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID to close'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId }) => {
      const result = await browserManager.closeBrowser(sessionId);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Browser session ${sessionId} closed`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error closing browser')
  );

  // Browser Resize Tool
  server.registerTool(
    'browser_resize',
    {
      title: 'Resize Browser',
      description: 'Resize the browser viewport',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        pageId: z.string().describe('Page ID'),
        width: z.number().min(320).max(3840).describe('Viewport width'),
        height: z.number().min(240).max(2160).describe('Viewport height'),
      },
      outputSchema: {
        success: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId, pageId, width, height }) => {
      const result = await browserManager.resizeViewport(sessionId, pageId, {
        width,
        height,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Viewport resized to ${width}x${height}`,
          },
        ],
        structuredContent: result,
      };
    }, 'Error resizing viewport')
  );

  // Browser Tabs Tool
  server.registerTool(
    'browser_tabs',
    {
      title: 'Manage Browser Tabs',
      description: 'List, create, close, or select browser tabs',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        action: z
          .enum(['list', 'create', 'close', 'select'])
          .describe('Tab operation to perform'),
        pageId: z
          .string()
          .optional()
          .describe('Page ID for close/select operations'),
        url: z
          .string()
          .url()
          .optional()
          .describe('URL to open in new tab (for create action)'),
      },
      outputSchema: {
        success: z.boolean(),
        tabs: z
          .array(
            z.object({
              pageId: z.string(),
              title: z.string(),
              url: z.string(),
              active: z.boolean(),
            })
          )
          .optional(),
        newPageId: z.string().optional(),
      },
    },
    createToolHandler(async ({ sessionId, action, pageId, url }) => {
      const result = await browserManager.manageTabs(
        sessionId,
        action,
        pageId,
        url
      );

      const message =
        action === 'list'
          ? `Found ${result.tabs?.length ?? 0} tab(s)`
          : action === 'create'
            ? `Created new tab${result.newPageId ? ` (${result.newPageId})` : ''}`
            : action === 'close'
              ? `Closed tab ${pageId}`
              : `Selected tab ${pageId}`;

      return {
        content: [{ type: 'text' as const, text: message }],
        structuredContent: result,
      };
    }, 'Error managing tabs')
  );

  // List Sessions Tool
  server.registerTool(
    'sessions_list',
    {
      title: 'List Browser Sessions',
      description: 'List all active browser sessions',
      inputSchema: {},
      outputSchema: {
        sessions: z.array(
          z.object({
            id: z.string(),
            browserType: z.string(),
            pageCount: z.number(),
            lastActivity: z.date(),
          })
        ),
      },
    },
    () => {
      const sessions = browserManager.listSessions();

      return {
        content: [
          {
            type: 'text' as const,
            text: `Active sessions: ${sessions.length}`,
          },
        ],
        structuredContent: { sessions },
      };
    }
  );
}
