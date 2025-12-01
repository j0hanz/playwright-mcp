// Browser Tool Handlers - Browser lifecycle and session management
// @see https://playwright.dev/docs/api/class-browser

import { z } from 'zod';

import type { ToolContext } from '../../config/types.js';
import {
  basePageInput,
  browserTypeSchema,
  colorSchemeSchema,
  geolocationSchema,
  proxySchema,
  recordVideoSchema,
  reducedMotionSchema,
  viewportSchema,
} from './schemas.js';
import { textContent } from './types.js';

export function registerBrowserTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // Browser Launch Tool
  server.registerTool(
    'browser_launch',
    {
      title: 'Launch Browser',
      description:
        'Launch a new browser instance (Chromium, Firefox, or WebKit) with optional authentication state and video recording',
      inputSchema: {
        browserType: browserTypeSchema
          .default('chromium')
          .describe('Browser type to launch'),
        headless: z.boolean().default(true).describe('Run in headless mode'),
        viewportWidth: z
          .number()
          .min(320)
          .max(3840)
          .default(1920)
          .describe('Viewport width'),
        viewportHeight: z
          .number()
          .min(240)
          .max(2160)
          .default(1080)
          .describe('Viewport height'),
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
        storageState: z
          .string()
          .optional()
          .describe('Path to storage state file for authentication reuse'),
        proxy: proxySchema,
        recordVideo: recordVideoSchema,
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
        storageState,
        proxy,
        recordVideo,
      }) => {
        const result = await browserManager.launchBrowser({
          browserType,
          headless,
          viewport: { width: viewportWidth, height: viewportHeight },
          channel,
          slowMo,
          storageState,
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
            textContent(
              `Browser launched: ${result.browserType}${storageState ? ' (with auth)' : ''}${result.recordingVideo ? ' (recording video)' : ''}`
            ),
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
      outputSchema: { success: z.boolean() },
    },
    createToolHandler(async ({ sessionId }) => {
      const result = await browserManager.closeBrowser(sessionId);
      return {
        content: [textContent(`Browser session ${sessionId} closed`)],
        structuredContent: result,
      };
    }, 'Error closing browser')
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
      const result = await browserManager.pageOperations.manageTabs(
        sessionId,
        action,
        pageId,
        url
      );
      const messages: Record<string, string> = {
        list: `Found ${result.tabs?.length ?? 0} tab(s)`,
        create: `Created new tab${result.newPageId ? ` (${result.newPageId})` : ''}`,
        close: `Closed tab ${pageId}`,
        select: `Selected tab ${pageId}`,
      };
      return {
        content: [textContent(messages[action])],
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
        content: [textContent(`Active sessions: ${sessions.length}`)],
        structuredContent: { sessions },
      };
    }
  );

  // Save Storage State Tool
  server.registerTool(
    'save_storage_state',
    {
      title: 'Save Storage State',
      description:
        'Save browser storage state (cookies, localStorage) for authentication reuse',
      inputSchema: {
        sessionId: z.string().describe('Browser session ID'),
        path: z
          .string()
          .optional()
          .describe('Path to save the storage state file'),
      },
      outputSchema: { success: z.boolean(), path: z.string() },
    },
    createToolHandler(async ({ sessionId, path }) => {
      const result = await browserManager.saveStorageState(sessionId, path);
      return {
        content: [textContent(`Storage state saved to ${result.path}`)],
        structuredContent: result,
      };
    }, 'Error saving storage state')
  );

  // Session Reset State Tool
  server.registerTool(
    'session_reset_state',
    {
      title: 'Reset Session State',
      description:
        'Clear cookies, localStorage, and sessionStorage for a browser session (useful for test isolation)',
      inputSchema: { sessionId: z.string().describe('Browser session ID') },
      outputSchema: {
        success: z.boolean(),
        clearedCookies: z.boolean(),
        clearedStorage: z.boolean(),
      },
    },
    createToolHandler(async ({ sessionId }) => {
      const result =
        await browserManager.pageOperations.resetSessionState(sessionId);
      return {
        content: [
          textContent(
            'Session state cleared (cookies, localStorage, sessionStorage)'
          ),
        ],
        structuredContent: result,
      };
    }, 'Error resetting session state')
  );

  // Page Prepare Tool
  server.registerTool(
    'page_prepare',
    {
      title: 'Prepare Page',
      description:
        'Configure page settings for testing (viewport, geolocation, permissions, color scheme, etc.)',
      inputSchema: {
        ...basePageInput,
        viewport: viewportSchema.optional().describe('Viewport size'),
        extraHTTPHeaders: z
          .record(z.string(), z.string())
          .optional()
          .describe('Extra HTTP headers to send'),
        geolocation: geolocationSchema
          .optional()
          .describe('Geolocation override'),
        permissions: z
          .array(z.string())
          .optional()
          .describe('Permissions to grant (e.g., geolocation, notifications)'),
        colorScheme: colorSchemeSchema
          .optional()
          .describe('Color scheme preference'),
        reducedMotion: reducedMotionSchema
          .optional()
          .describe('Reduced motion preference'),
      },
      outputSchema: {
        success: z.boolean(),
        appliedSettings: z.array(z.string()),
      },
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        viewport,
        extraHTTPHeaders,
        geolocation,
        permissions,
        colorScheme,
        reducedMotion,
      }) => {
        const result = await browserManager.pageOperations.preparePage(
          sessionId,
          pageId,
          {
            viewport,
            extraHTTPHeaders,
            geolocation,
            permissions,
            colorScheme,
            reducedMotion,
          }
        );
        return {
          content: [
            textContent(
              `Page prepared with settings: ${result.appliedSettings.join(', ') || 'none'}`
            ),
          ],
          structuredContent: result,
        };
      },
      'Error preparing page'
    )
  );
}
