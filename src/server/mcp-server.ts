import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import config from '../config/server-config.js';
import { BrowserManager } from '../playwright/browser-manager.js';
import { ARIA_ROLES } from '../types/index.js';
import { toError } from '../utils/error-handler.js';
import { Logger } from '../utils/logger.js';
import { registerAllHandlers, toolErrorResponse } from './handlers/index.js';

export class MCPPlaywrightServer {
  private server: McpServer;
  protected browserManager: BrowserManager;
  private logger: Logger;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupFailures = 0;
  private static readonly MAX_CLEANUP_FAILURES = 5;

  constructor() {
    this.server = new McpServer({
      name: 'mcp-playwright-server',
      version: '1.0.0',
    });

    this.browserManager = new BrowserManager();
    this.logger = new Logger('MCPPlaywrightServer');

    this.registerTools();
    this.registerResources();
    this.startSessionCleanup();
  }

  private startSessionCleanup(): void {
    // Run session cleanup at configured interval
    this.cleanupInterval = setInterval(() => {
      this.browserManager
        .cleanupExpiredSessions(config.sessionTimeout)
        .then(({ cleaned }) => {
          this.cleanupFailures = 0;
          if (cleaned > 0) {
            this.logger.info('Cleaned up expired sessions', { count: cleaned });
          }
        })
        .catch((error: unknown) => {
          this.cleanupFailures++;
          const err = toError(error);
          this.logger.error('Session cleanup failed', {
            error: err.message,
            stack: err.stack,
            failures: this.cleanupFailures,
          });

          // Stop cleanup interval if failing repeatedly
          if (
            this.cleanupFailures >= MCPPlaywrightServer.MAX_CLEANUP_FAILURES
          ) {
            this.logger.error(
              'Cleanup failing repeatedly, stopping cleanup interval',
              { failures: this.cleanupFailures }
            );
            if (this.cleanupInterval) {
              clearInterval(this.cleanupInterval);
              this.cleanupInterval = null;
            }
          }
        });
    }, config.cleanupInterval);
  }

  async cleanup(): Promise<void> {
    this.logger.info('Starting cleanup...');

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all browser sessions
    const sessions = this.browserManager.listSessions();
    for (const session of sessions) {
      try {
        await this.browserManager.closeBrowser(session.id);
        this.logger.info('Closed browser session', { sessionId: session.id });
      } catch (error) {
        const err = toError(error);
        this.logger.error('Failed to close session during cleanup', {
          sessionId: session.id,
          error: err.message,
        });
      }
    }

    this.logger.info('Cleanup completed');
  }

  /**
   * Higher-order function that wraps tool handlers with consistent error handling.
   * Eliminates repetitive try-catch-toolErrorResponse pattern (DRY principle).
   *
   * @template T - Handler function input type
   * @template R - Handler function return type
   * @param handler - The async handler function
   * @param errorMessage - Custom error message prefix for this tool
   * @returns Wrapped handler with consistent error handling
   */
  private createToolHandler<T, R extends { structuredContent?: unknown }>(
    handler: (input: T) => Promise<R>,
    errorMessage: string
  ): (input: T) => Promise<R | ReturnType<typeof toolErrorResponse>> {
    return async (input: T) => {
      try {
        return await handler(input);
      } catch (error) {
        return toolErrorResponse(errorMessage, error);
      }
    };
  }

  private registerTools(): void {
    // Browser Launch Tool
    this.server.registerTool(
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
      this.createToolHandler(
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
          const result = await this.browserManager.launchBrowser({
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
                type: 'text',
                text: `Browser launched: ${result.browserType}${result.recordingVideo ? ' (recording video)' : ''}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error launching browser'
      )
    );

    // Navigate Tool
    this.server.registerTool(
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
      this.createToolHandler(async ({ sessionId, url, waitUntil }) => {
        const result = await this.browserManager.navigateToPage({
          sessionId,
          url,
          waitUntil,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Navigated to: ${result.title} (${result.url})`,
            },
          ],
          structuredContent: result,
        };
      }, 'Error navigating to URL')
    );

    // Navigate Back Tool
    this.server.registerTool(
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
      this.createToolHandler(async ({ sessionId, pageId }) => {
        const result = await this.browserManager.navigateBack(
          sessionId,
          pageId
        );

        return {
          content: [
            {
              type: 'text',
              text: `Navigated back${result.url ? ` to ${result.url}` : ''}`,
            },
          ],
          structuredContent: result,
        };
      }, 'Error navigating back')
    );

    // Browser Resize Tool
    this.server.registerTool(
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
      this.createToolHandler(async ({ sessionId, pageId, width, height }) => {
        const result = await this.browserManager.resizeViewport(
          sessionId,
          pageId,
          { width, height }
        );

        return {
          content: [
            { type: 'text', text: `Viewport resized to ${width}x${height}` },
          ],
          structuredContent: result,
        };
      }, 'Error resizing viewport')
    );

    // Browser Tabs Tool
    this.server.registerTool(
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
      this.createToolHandler(async ({ sessionId, action, pageId, url }) => {
        const result = await this.browserManager.manageTabs(
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
          content: [{ type: 'text', text: message }],
          structuredContent: result,
        };
      }, 'Error managing tabs')
    );

    // Handle Dialog Tool
    this.server.registerTool(
      'browser_handle_dialog',
      {
        title: 'Handle Dialog',
        description:
          'Accept or dismiss a browser dialog (alert, confirm, prompt)',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          accept: z.boolean().describe('Whether to accept the dialog'),
          promptText: z
            .string()
            .optional()
            .describe('Text to enter in prompt dialog'),
        },
        outputSchema: {
          success: z.boolean(),
          dialogType: z.string().optional(),
          message: z.string().optional(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, accept, promptText }) => {
          const result = await this.browserManager.handleDialog(
            sessionId,
            pageId,
            accept,
            promptText
          );

          return {
            content: [
              {
                type: 'text',
                text: `Dialog ${accept ? 'accepted' : 'dismissed'}${result.dialogType ? ` (${result.dialogType})` : ''}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error handling dialog'
      )
    );

    // File Upload Tool
    this.server.registerTool(
      'browser_file_upload',
      {
        title: 'Upload File',
        description: 'Upload one or more files to a file input element',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          selector: z.string().describe('CSS selector for the file input'),
          filePaths: z
            .array(z.string())
            .describe('Array of file paths to upload'),
        },
        outputSchema: {
          success: z.boolean(),
          filesUploaded: z.number(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, selector, filePaths }) => {
          const result = await this.browserManager.uploadFiles(
            sessionId,
            pageId,
            selector,
            filePaths
          );

          return {
            content: [
              {
                type: 'text',
                text: `Uploaded ${result.filesUploaded} file(s) to ${selector}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error uploading files'
      )
    );

    // Click Element Tool
    this.server.registerTool(
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
      this.createToolHandler(
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
          const result = await this.browserManager.clickElement({
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
            content: [{ type: 'text', text: `Clicked element: ${selector}` }],
            structuredContent: result,
          };
        },
        'Error clicking element'
      )
    );

    // Fill Input Tool
    this.server.registerTool(
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
      this.createToolHandler(async ({ sessionId, pageId, selector, text }) => {
        const result = await this.browserManager.fillInput({
          sessionId,
          pageId,
          selector,
          text,
        });

        return {
          content: [
            { type: 'text', text: `Filled input ${selector} with text` },
          ],
          structuredContent: result,
        };
      }, 'Error filling input')
    );

    // Hover Element Tool
    this.server.registerTool(
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
      this.createToolHandler(async ({ sessionId, pageId, selector }) => {
        const result = await this.browserManager.hoverElement({
          sessionId,
          pageId,
          selector,
        });

        return {
          content: [
            { type: 'text', text: `Hovered over element: ${selector}` },
          ],
          structuredContent: result,
        };
      }, 'Error hovering element')
    );

    // Screenshot Tool
    this.server.registerTool(
      'page_screenshot',
      {
        title: 'Take Screenshot',
        description: 'Capture a screenshot of the page',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          fullPage: z
            .boolean()
            .default(false)
            .describe('Capture full scrollable page'),
          path: z.string().optional().describe('Path to save the screenshot'),
          type: z
            .enum(['png', 'jpeg'])
            .default('png')
            .describe('Screenshot format'),
          quality: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe('JPEG quality (0-100)'),
        },
        outputSchema: {
          path: z.string().optional(),
          base64: z.string().optional(),
          mimeType: z.string().optional(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, fullPage, path, type, quality }) => {
          const result = await this.browserManager.takeScreenshot({
            sessionId,
            pageId,
            fullPage,
            path,
            type,
            quality,
          });
          const mimeType: 'image/png' | 'image/jpeg' =
            type === 'jpeg' ? 'image/jpeg' : 'image/png';

          return {
            content: [
              {
                type: 'text',
                text: `Screenshot captured${path ? ` and saved to ${path}` : ''}`,
              },
              ...(result.base64
                ? [
                    {
                      type: 'image' as const,
                      data: result.base64,
                      mimeType,
                    },
                  ]
                : []),
            ],
            structuredContent: { ...result, mimeType },
          };
        },
        'Error taking screenshot'
      )
    );

    // Get Page Content Tool
    this.server.registerTool(
      'page_content',
      {
        title: 'Get Page Content',
        description: 'Get the HTML and text content of the page',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
        },
        outputSchema: {
          html: z.string(),
          text: z.string(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId }) => {
        const result = await this.browserManager.getPageContent(
          sessionId,
          pageId
        );

        return {
          content: [
            {
              type: 'text',
              text: `Page content retrieved (${result.html.length} chars HTML, ${result.text.length} chars text)`,
            },
          ],
          structuredContent: result,
        };
      }, 'Error getting page content')
    );

    // Wait for Selector Tool
    this.server.registerTool(
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
      this.createToolHandler(
        async ({ sessionId, pageId, selector, state, timeout }) => {
          const result = await this.browserManager.waitForSelector(
            sessionId,
            pageId,
            selector,
            { state, timeout }
          );

          return {
            content: [
              {
                type: 'text',
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

    // Execute Script Tool
    this.server.registerTool(
      'execute_script',
      {
        title: 'Execute JavaScript',
        description: 'Execute JavaScript code in the page context',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          script: z.string().describe('JavaScript code to execute'),
        },
        outputSchema: {
          result: z.unknown(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId, script }) => {
        const result = await this.browserManager.evaluateScript(
          sessionId,
          pageId,
          script
        );

        return {
          content: [
            {
              type: 'text',
              text: `Script executed. Result: ${JSON.stringify(result.result)}`,
            },
          ],
          structuredContent: result,
        };
      }, 'Error executing script')
    );

    // Close Browser Tool
    this.server.registerTool(
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
      this.createToolHandler(async ({ sessionId }) => {
        const result = await this.browserManager.closeBrowser(sessionId);

        return {
          content: [
            { type: 'text', text: `Browser session ${sessionId} closed` },
          ],
          structuredContent: result,
        };
      }, 'Error closing browser')
    );

    // List Sessions Tool
    this.server.registerTool(
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
      this.createToolHandler(
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => {
          const sessions = this.browserManager.listSessions();

          return {
            content: [
              { type: 'text', text: `Active sessions: ${sessions.length}` },
            ],
            structuredContent: { sessions },
          };
        },
        'Error listing sessions'
      )
    );

    // Keyboard Press Tool
    this.server.registerTool(
      'keyboard_press',
      {
        title: 'Keyboard Press',
        description: 'Press a key or key combination on the keyboard',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          key: z
            .string()
            .describe('Key to press (e.g., Enter, Tab, ArrowDown, Control+a)'),
          delay: z
            .number()
            .min(0)
            .max(1000)
            .optional()
            .describe('Delay between keydown and keyup in ms'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId, key, delay }) => {
        const result = await this.browserManager.keyboardPress(
          sessionId,
          pageId,
          key,
          delay ? { delay } : undefined
        );

        return {
          content: [{ type: 'text', text: `Pressed key: ${key}` }],
          structuredContent: result,
        };
      }, 'Error pressing key')
    );

    // Keyboard Type Tool
    this.server.registerTool(
      'keyboard_type',
      {
        title: 'Keyboard Type',
        description:
          'Type text character by character (useful for inputs that need keystroke events)',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          text: z.string().describe('Text to type'),
          delay: z
            .number()
            .min(0)
            .max(500)
            .optional()
            .describe('Delay between each keystroke in ms'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId, text, delay }) => {
        const result = await this.browserManager.keyboardType(
          sessionId,
          pageId,
          text,
          delay ? { delay } : undefined
        );

        return {
          content: [{ type: 'text', text: `Typed ${text.length} characters` }],
          structuredContent: result,
        };
      }, 'Error typing text')
    );

    // Mouse Move Tool
    this.server.registerTool(
      'mouse_move',
      {
        title: 'Mouse Move',
        description: 'Move the mouse to specific coordinates',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          x: z.number().describe('X coordinate'),
          y: z.number().describe('Y coordinate'),
          steps: z
            .number()
            .min(1)
            .max(100)
            .default(1)
            .describe('Number of intermediate steps for smooth movement'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId, x, y, steps }) => {
        const result = await this.browserManager.mouseMove(
          sessionId,
          pageId,
          x,
          y,
          steps ? { steps } : undefined
        );

        return {
          content: [{ type: 'text', text: `Mouse moved to (${x}, ${y})` }],
          structuredContent: result,
        };
      }, 'Error moving mouse')
    );

    // Mouse Click Tool
    this.server.registerTool(
      'mouse_click',
      {
        title: 'Mouse Click',
        description: 'Click at specific coordinates',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          x: z.number().describe('X coordinate'),
          y: z.number().describe('Y coordinate'),
          button: z
            .enum(['left', 'middle', 'right'])
            .default('left')
            .describe('Mouse button'),
          clickCount: z
            .number()
            .min(1)
            .max(3)
            .default(1)
            .describe('Number of clicks'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, x, y, button, clickCount }) => {
          const result = await this.browserManager.mouseClick(
            sessionId,
            pageId,
            x,
            y,
            { button, clickCount }
          );

          return {
            content: [
              {
                type: 'text',
                text: `Mouse ${clickCount > 1 ? `${clickCount}x ` : ''}clicked at (${x}, ${y})`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error clicking mouse'
      )
    );

    // Tracing Start Tool
    this.server.registerTool(
      'tracing_start',
      {
        title: 'Start Tracing',
        description: 'Start recording a trace for debugging',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          screenshots: z
            .boolean()
            .default(true)
            .describe('Capture screenshots'),
          snapshots: z
            .boolean()
            .default(true)
            .describe('Capture DOM snapshots'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(async ({ sessionId, screenshots, snapshots }) => {
        const result = await this.browserManager.startTracing(sessionId, {
          screenshots,
          snapshots,
        });

        return {
          content: [{ type: 'text', text: 'Tracing started' }],
          structuredContent: result,
        };
      }, 'Error starting trace')
    );

    // Tracing Stop Tool
    this.server.registerTool(
      'tracing_stop',
      {
        title: 'Stop Tracing',
        description: 'Stop recording and save the trace',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          path: z.string().describe('Path to save the trace file'),
        },
        outputSchema: {
          success: z.boolean(),
          path: z.string(),
        },
      },
      this.createToolHandler(async ({ sessionId, path }) => {
        const result = await this.browserManager.stopTracing(sessionId, path);

        return {
          content: [{ type: 'text', text: `Trace saved to ${path}` }],
          structuredContent: result,
        };
      }, 'Error stopping trace')
    );

    // Network Route Tool
    this.server.registerTool(
      'network_route',
      {
        title: 'Route Network Requests',
        description:
          'Intercept and modify network requests with support for mocking, delay injection, and failure simulation',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          urlPattern: z
            .string()
            .describe('URL pattern to match (glob or regex)'),
          response: z
            .object({
              status: z.number().optional().describe('Response status code'),
              body: z.string().optional().describe('Response body'),
              contentType: z
                .string()
                .optional()
                .describe('Content-Type header'),
              headers: z
                .record(z.string(), z.string())
                .optional()
                .describe('Response headers'),
              delay: z
                .number()
                .min(0)
                .max(60000)
                .optional()
                .describe('Delay in ms before responding'),
              failureMode: z
                .enum(['timeout', 'abort', 'malformed-json'])
                .optional()
                .describe(
                  'Simulate network failures: timeout (no response), abort (connection failed), malformed-json (invalid JSON response)'
                ),
            })
            .optional()
            .describe('Response configuration'),
        },
        outputSchema: {
          success: z.boolean(),
          routeId: z.string(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, urlPattern, response }) => {
          const result = await this.browserManager.addNetworkRoute(
            sessionId,
            pageId,
            urlPattern,
            response ?? { status: 200, body: '' }
          );

          const modeInfo = response?.failureMode
            ? ` (failure mode: ${response.failureMode})`
            : '';
          const delayInfo = response?.delay
            ? ` (delay: ${response.delay}ms)`
            : '';

          return {
            content: [
              {
                type: 'text',
                text: `Network route added for ${urlPattern}${delayInfo}${modeInfo}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error adding network route'
      )
    );

    // Network Unroute Tool
    this.server.registerTool(
      'network_unroute',
      {
        title: 'Remove Network Route',
        description: 'Remove all network routes for a page',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId }) => {
        const result = await this.browserManager.removeNetworkRoutes(
          sessionId,
          pageId
        );

        return {
          content: [{ type: 'text', text: 'Network routes removed' }],
          structuredContent: result,
        };
      }, 'Error removing network routes')
    );

    // ==========================================
    // Role-Based Locator Tools (Best Practice)
    // ==========================================

    // Click by Role Tool
    this.server.registerTool(
      'click_by_role',
      {
        title: 'Click Element by Role',
        description:
          'Click an element using its ARIA role (recommended by Playwright). Roles include: button, link, checkbox, textbox, heading, etc.',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          role: z.enum(ARIA_ROLES).describe('ARIA role of the element'),
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
      this.createToolHandler(
        async ({ sessionId, pageId, role, name, exact, force, timeout }) => {
          const result = await this.browserManager.clickByRole(
            sessionId,
            pageId,
            role,
            { name, exact, force, timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: `Clicked ${role}${name ? ` "${name}"` : ''}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error clicking by role'
      )
    );

    // Fill by Label Tool
    this.server.registerTool(
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
      this.createToolHandler(
        async ({ sessionId, pageId, label, text, exact, timeout }) => {
          const result = await this.browserManager.fillByLabel(
            sessionId,
            pageId,
            label,
            text,
            { exact, timeout }
          );

          return {
            content: [
              { type: 'text', text: `Filled input labeled "${label}"` },
            ],
            structuredContent: result,
          };
        },
        'Error filling input by label'
      )
    );

    // Click by Text Tool
    this.server.registerTool(
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
      this.createToolHandler(
        async ({ sessionId, pageId, text, exact, force, timeout }) => {
          const result = await this.browserManager.clickByText(
            sessionId,
            pageId,
            text,
            { exact, force, timeout }
          );

          return {
            content: [
              { type: 'text', text: `Clicked element with text "${text}"` },
            ],
            structuredContent: result,
          };
        },
        'Error clicking by text'
      )
    );

    // Fill by Placeholder Tool
    this.server.registerTool(
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
      this.createToolHandler(
        async ({ sessionId, pageId, placeholder, text, exact, timeout }) => {
          const result = await this.browserManager.fillByPlaceholder(
            sessionId,
            pageId,
            placeholder,
            text,
            { exact, timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: `Filled input with placeholder "${placeholder}"`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error filling by placeholder'
      )
    );

    // Click by TestId Tool
    this.server.registerTool(
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
      this.createToolHandler(
        async ({ sessionId, pageId, testId, force, timeout }) => {
          const result = await this.browserManager.clickByTestId(
            sessionId,
            pageId,
            testId,
            { force, timeout }
          );

          return {
            content: [
              { type: 'text', text: `Clicked element with testId "${testId}"` },
            ],
            structuredContent: result,
          };
        },
        'Error clicking by testId'
      )
    );

    // Fill by TestId Tool
    this.server.registerTool(
      'fill_by_testid',
      {
        title: 'Fill Input by Test ID',
        description: 'Fill an input field using data-testid attribute',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          testId: z.string().describe('Test ID (data-testid value)'),
          text: z.string().describe('Text to fill'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, testId, text, timeout }) => {
          const result = await this.browserManager.fillByTestId(
            sessionId,
            pageId,
            testId,
            text,
            { timeout }
          );

          return {
            content: [
              { type: 'text', text: `Filled input with testId "${testId}"` },
            ],
            structuredContent: result,
          };
        },
        'Error filling by testId'
      )
    );

    // ==========================================
    // Web-First Assertion Tools
    // ==========================================

    // Assert Visible Tool
    this.server.registerTool(
      'assert_visible',
      {
        title: 'Assert Element Visible',
        description:
          'Assert that an element is visible on the page (web-first assertion with auto-waiting)',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          selector: z.string().describe('CSS selector for the element'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
          visible: z.boolean(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, selector, timeout }) => {
          const result = await this.browserManager.assertVisible(
            sessionId,
            pageId,
            selector,
            { timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: result.success
                  ? `✓ Element ${selector} is visible`
                  : `✗ Element ${selector} is NOT visible`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error asserting visibility'
      )
    );

    // Assert Hidden Tool
    this.server.registerTool(
      'assert_hidden',
      {
        title: 'Assert Element Hidden',
        description:
          'Assert that an element is hidden or not present (web-first assertion with auto-waiting)',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          selector: z.string().describe('CSS selector for the element'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
          hidden: z.boolean(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, selector, timeout }) => {
          const result = await this.browserManager.assertHidden(
            sessionId,
            pageId,
            selector,
            { timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: result.success
                  ? `✓ Element ${selector} is hidden`
                  : `✗ Element ${selector} is NOT hidden`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error asserting hidden'
      )
    );

    // Assert Text Tool
    this.server.registerTool(
      'assert_text',
      {
        title: 'Assert Element Text',
        description:
          'Assert that an element has or contains specific text (web-first assertion)',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          selector: z.string().describe('CSS selector for the element'),
          expectedText: z.string().describe('Expected text content'),
          exact: z
            .boolean()
            .default(false)
            .describe('Whether to match exact text or just contain'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
          actualText: z.string().optional(),
        },
      },
      this.createToolHandler(
        async ({
          sessionId,
          pageId,
          selector,
          expectedText,
          exact,
          timeout,
        }) => {
          const result = await this.browserManager.assertText(
            sessionId,
            pageId,
            selector,
            expectedText,
            { exact, timeout }
          );

          return {
            content: [
              {
                type: 'text',
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
    this.server.registerTool(
      'assert_attribute',
      {
        title: 'Assert Element Attribute',
        description: 'Assert that an element has a specific attribute value',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          selector: z.string().describe('CSS selector for the element'),
          attribute: z.string().describe('Attribute name'),
          expectedValue: z.string().describe('Expected attribute value'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
          actualValue: z.string().optional(),
        },
      },
      this.createToolHandler(
        async ({
          sessionId,
          pageId,
          selector,
          attribute,
          expectedValue,
          timeout,
        }) => {
          const result = await this.browserManager.assertAttribute(
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
                type: 'text',
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
    this.server.registerTool(
      'assert_value',
      {
        title: 'Assert Input Value',
        description: 'Assert that an input element has a specific value',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          selector: z.string().describe('CSS selector for the input'),
          expectedValue: z.string().describe('Expected input value'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
          actualValue: z.string().optional(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, selector, expectedValue, timeout }) => {
          const result = await this.browserManager.assertValue(
            sessionId,
            pageId,
            selector,
            expectedValue,
            { timeout }
          );

          return {
            content: [
              {
                type: 'text',
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
    this.server.registerTool(
      'assert_checked',
      {
        title: 'Assert Checkbox Checked',
        description:
          'Assert that a checkbox or radio button is checked or unchecked',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          selector: z.string().describe('CSS selector for the checkbox/radio'),
          checked: z.boolean().default(true).describe('Expected checked state'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
          isChecked: z.boolean().optional(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, selector, checked, timeout }) => {
          const result = await this.browserManager.assertChecked(
            sessionId,
            pageId,
            selector,
            checked,
            { timeout }
          );

          return {
            content: [
              {
                type: 'text',
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
    this.server.registerTool(
      'assert_url',
      {
        title: 'Assert Page URL',
        description: 'Assert that the page has a specific URL',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          expectedUrl: z
            .string()
            .describe('Expected URL (string or regex pattern)'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
          actualUrl: z.string().optional(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, expectedUrl, timeout }) => {
          const result = await this.browserManager.assertUrl(
            sessionId,
            pageId,
            expectedUrl,
            { timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: result.success
                  ? `✓ URL matches "${expectedUrl}"`
                  : `✗ Expected URL "${expectedUrl}", got "${result.actualUrl}"`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error asserting URL'
      )
    );

    // Assert Title Tool
    this.server.registerTool(
      'assert_title',
      {
        title: 'Assert Page Title',
        description: 'Assert that the page has a specific title',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          expectedTitle: z.string().describe('Expected page title'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
          actualTitle: z.string().optional(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, expectedTitle, timeout }) => {
          const result = await this.browserManager.assertTitle(
            sessionId,
            pageId,
            expectedTitle,
            { timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: result.success
                  ? `✓ Title matches "${expectedTitle}"`
                  : `✗ Expected title "${expectedTitle}", got "${result.actualTitle}"`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error asserting title'
      )
    );

    // ==========================================
    // Form Interaction Tools
    // ==========================================

    // Select Option Tool
    this.server.registerTool(
      'element_select',
      {
        title: 'Select Dropdown Option',
        description: 'Select an option from a dropdown/select element',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          selector: z.string().describe('CSS selector for the select element'),
          value: z
            .union([z.string(), z.array(z.string())])
            .describe('Value(s) to select - can be value, label, or index'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
          selectedValues: z.array(z.string()),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, selector, value, timeout }) => {
          const result = await this.browserManager.selectOption(
            sessionId,
            pageId,
            selector,
            value,
            { timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: `Selected: ${result.selectedValues.join(', ')}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error selecting option'
      )
    );

    // Check/Uncheck Tool
    this.server.registerTool(
      'element_check',
      {
        title: 'Check/Uncheck Element',
        description: 'Check or uncheck a checkbox or radio button',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          selector: z.string().describe('CSS selector for the checkbox/radio'),
          checked: z
            .boolean()
            .default(true)
            .describe('Whether to check or uncheck'),
          force: z
            .boolean()
            .default(false)
            .describe('Force action even if not actionable'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, selector, checked, force, timeout }) => {
          const result = await this.browserManager.checkElement(
            sessionId,
            pageId,
            selector,
            checked,
            { force, timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: `Element ${checked ? 'checked' : 'unchecked'}: ${selector}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error checking element'
      )
    );

    // ==========================================
    // Drag and Drop Tool
    // ==========================================

    this.server.registerTool(
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
          sourcePosition: z
            .object({
              x: z.number(),
              y: z.number(),
            })
            .optional()
            .describe('Position within source element'),
          targetPosition: z
            .object({
              x: z.number(),
              y: z.number(),
            })
            .optional()
            .describe('Position within target element'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(
        async ({
          sessionId,
          pageId,
          sourceSelector,
          targetSelector,
          sourcePosition,
          targetPosition,
          timeout,
        }) => {
          const result = await this.browserManager.dragAndDrop(
            sessionId,
            pageId,
            sourceSelector,
            targetSelector,
            { sourcePosition, targetPosition, timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: `Dragged ${sourceSelector} to ${targetSelector}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error dragging'
      )
    );

    // ==========================================
    // Frame/Iframe Tools
    // ==========================================

    this.server.registerTool(
      'frame_click',
      {
        title: 'Click in Frame',
        description: 'Click an element inside an iframe',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          frameSelector: z.string().describe('CSS selector for the iframe'),
          elementSelector: z
            .string()
            .describe('CSS selector for element inside the frame'),
          force: z.boolean().default(false).describe('Force click'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(
        async ({
          sessionId,
          pageId,
          frameSelector,
          elementSelector,
          force,
          timeout,
        }) => {
          const result = await this.browserManager.clickInFrame(
            sessionId,
            pageId,
            frameSelector,
            elementSelector,
            { force, timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: `Clicked ${elementSelector} in frame ${frameSelector}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error clicking in frame'
      )
    );

    this.server.registerTool(
      'frame_fill',
      {
        title: 'Fill in Frame',
        description: 'Fill an input inside an iframe',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          frameSelector: z.string().describe('CSS selector for the iframe'),
          elementSelector: z
            .string()
            .describe('CSS selector for input inside the frame'),
          text: z.string().describe('Text to fill'),
          timeout: z.number().default(5000).describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(
        async ({
          sessionId,
          pageId,
          frameSelector,
          elementSelector,
          text,
          timeout,
        }) => {
          const result = await this.browserManager.fillInFrame(
            sessionId,
            pageId,
            frameSelector,
            elementSelector,
            text,
            { timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: `Filled ${elementSelector} in frame ${frameSelector}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error filling in frame'
      )
    );

    // ==========================================
    // Storage State / Authentication Tools
    // ==========================================

    this.server.registerTool(
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
        outputSchema: {
          success: z.boolean(),
          path: z.string(),
        },
      },
      this.createToolHandler(async ({ sessionId, path }) => {
        const result = await this.browserManager.saveStorageState(
          sessionId,
          path
        );

        return {
          content: [
            { type: 'text', text: `Storage state saved to ${result.path}` },
          ],
          structuredContent: result,
        };
      }, 'Error saving storage state')
    );

    this.server.registerTool(
      'launch_with_auth',
      {
        title: 'Launch Browser with Auth',
        description:
          'Launch a new browser session with saved authentication state',
        inputSchema: {
          browserType: z
            .enum(['chromium', 'firefox', 'webkit'])
            .default('chromium'),
          headless: z.boolean().default(true),
          storageState: z.string().describe('Path to storage state file'),
          viewportWidth: z.number().default(1920),
          viewportHeight: z.number().default(1080),
        },
        outputSchema: {
          sessionId: z.string(),
          browserType: z.string(),
        },
      },
      this.createToolHandler(
        async ({
          browserType,
          headless,
          storageState,
          viewportWidth,
          viewportHeight,
        }) => {
          const result = await this.browserManager.launchWithStorageState({
            browserType,
            headless,
            storageState,
            viewport: { width: viewportWidth, height: viewportHeight },
          });

          return {
            content: [
              {
                type: 'text',
                text: `Browser launched with auth from ${storageState}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error launching with auth'
      )
    );

    // ==========================================
    // Download Handling Tool
    // ==========================================

    this.server.registerTool(
      'wait_for_download',
      {
        title: 'Wait for Download',
        description: 'Wait for a file download to complete',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          timeout: z
            .number()
            .default(30000)
            .describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
          suggestedFilename: z.string(),
          path: z.string().nullable(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId, timeout }) => {
        const result = await this.browserManager.waitForDownload(
          sessionId,
          pageId,
          { timeout }
        );

        return {
          content: [
            {
              type: 'text',
              text: `Download completed: ${result.suggestedFilename}`,
            },
          ],
          structuredContent: result,
        };
      }, 'Error waiting for download')
    );

    // ==========================================
    // Session Management / Fixture Tools
    // ==========================================

    this.server.registerTool(
      'session_reset_state',
      {
        title: 'Reset Session State',
        description:
          'Clear cookies, localStorage, and sessionStorage for a browser session (useful for test isolation)',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
        },
        outputSchema: {
          success: z.boolean(),
          clearedCookies: z.boolean(),
          clearedStorage: z.boolean(),
        },
      },
      this.createToolHandler(async ({ sessionId }) => {
        const result = await this.browserManager.resetSessionState(sessionId);

        return {
          content: [
            {
              type: 'text',
              text: 'Session state cleared (cookies, localStorage, sessionStorage)',
            },
          ],
          structuredContent: result,
        };
      }, 'Error resetting session state')
    );

    this.server.registerTool(
      'page_prepare',
      {
        title: 'Prepare Page',
        description:
          'Configure page settings for testing (viewport, geolocation, permissions, color scheme, etc.)',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          viewport: z
            .object({
              width: z.number().min(320).max(3840),
              height: z.number().min(240).max(2160),
            })
            .optional()
            .describe('Viewport size'),
          extraHTTPHeaders: z
            .record(z.string(), z.string())
            .optional()
            .describe('Extra HTTP headers to send'),
          geolocation: z
            .object({
              latitude: z.number().min(-90).max(90),
              longitude: z.number().min(-180).max(180),
              accuracy: z.number().optional(),
            })
            .optional()
            .describe('Geolocation override'),
          permissions: z
            .array(z.string())
            .optional()
            .describe(
              'Permissions to grant (e.g., geolocation, notifications)'
            ),
          colorScheme: z
            .enum(['light', 'dark', 'no-preference'])
            .optional()
            .describe('Color scheme preference'),
          reducedMotion: z
            .enum(['reduce', 'no-preference'])
            .optional()
            .describe('Reduced motion preference'),
        },
        outputSchema: {
          success: z.boolean(),
          appliedSettings: z.array(z.string()),
        },
      },
      this.createToolHandler(
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
          const result = await this.browserManager.preparePage(
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
              {
                type: 'text',
                text: `Page prepared with settings: ${result.appliedSettings.join(', ') || 'none'}`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error preparing page'
      )
    );

    // ==========================================
    // Additional Locator Tools
    // ==========================================

    this.server.registerTool(
      'click_by_alt_text',
      {
        title: 'Click Element by Alt Text',
        description:
          'Click an image element using its alt text attribute (useful for accessibility testing)',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          altText: z.string().describe('Alt text of the image'),
          exact: z
            .boolean()
            .default(false)
            .describe('Whether alt text match should be exact'),
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
      this.createToolHandler(
        async ({ sessionId, pageId, altText, exact, force, timeout }) => {
          const result = await this.browserManager.clickByAltText(
            sessionId,
            pageId,
            altText,
            { exact, force, timeout }
          );

          return {
            content: [
              {
                type: 'text',
                text: `Clicked image with alt text "${altText}"`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error clicking by alt text'
      )
    );

    // ==========================================
    // Accessibility Scanning Tool
    // ==========================================

    this.server.registerTool(
      'accessibility_scan',
      {
        title: 'Run Accessibility Scan',
        description:
          'Scan the page for accessibility violations using axe-core. Returns WCAG violations with remediation guidance.',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          tags: z
            .array(z.string())
            .optional()
            .describe(
              'WCAG tags to filter by (e.g., wcag2a, wcag2aa, wcag21aa, best-practice)'
            ),
          includedImpacts: z
            .array(z.enum(['minor', 'moderate', 'serious', 'critical']))
            .optional()
            .describe('Filter violations by impact level'),
          selector: z
            .string()
            .optional()
            .describe('CSS selector to limit the scan to a specific element'),
        },
        outputSchema: {
          success: z.boolean(),
          violations: z.array(
            z.object({
              id: z.string(),
              impact: z.string(),
              description: z.string(),
              help: z.string(),
              helpUrl: z.string(),
              nodes: z.array(
                z.object({
                  html: z.string(),
                  target: z.array(z.string()),
                  failureSummary: z.string(),
                })
              ),
            })
          ),
          passes: z.number(),
          incomplete: z.number(),
          inapplicable: z.number(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, tags, includedImpacts, selector }) => {
          const result = await this.browserManager.runAccessibilityScan(
            sessionId,
            pageId,
            { tags, includedImpacts, selector }
          );

          const summary =
            result.violations.length === 0
              ? '✓ No accessibility violations found'
              : `✗ Found ${result.violations.length} accessibility violation(s)`;

          return {
            content: [
              {
                type: 'text',
                text: `${summary} (${result.passes} passed, ${result.incomplete} incomplete, ${result.inapplicable} inapplicable)`,
              },
            ],
            structuredContent: result,
          };
        },
        'Error running accessibility scan'
      )
    );

    // ==========================================
    // Adaptive Wait Tools (Best Practice for SPAs)
    // ==========================================

    // Wait for Load State Tool
    this.server.registerTool(
      'page_wait_for_load_state',
      {
        title: 'Wait for Load State',
        description:
          'Wait for the page to reach a specific load state. Recommended: use domcontentloaded for SPAs, networkidle for pages with async data loading.',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          state: z
            .enum(['load', 'domcontentloaded', 'networkidle'])
            .default('domcontentloaded')
            .describe(
              'Load state to wait for: load (all resources), domcontentloaded (DOM ready), networkidle (no network requests for 500ms)'
            ),
          timeout: z
            .number()
            .default(30000)
            .describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId, state, timeout }) => {
        const page = this.browserManager['getPage'](sessionId, pageId);
        await page.waitForLoadState(state, { timeout });
        this.browserManager['updateSessionActivity'](sessionId);
        return {
          content: [{ type: 'text', text: `Page reached ${state} state` }],
          structuredContent: { success: true },
        };
      }, 'Error waiting for load state')
    );

    // Wait for Network Idle Tool
    this.server.registerTool(
      'wait_for_network_idle',
      {
        title: 'Wait for Network Idle',
        description:
          'Wait until there are no network connections for at least 500ms. Useful for pages with async data loading.',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          timeout: z
            .number()
            .default(30000)
            .describe('Timeout in milliseconds'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId, timeout }) => {
        const page = this.browserManager['getPage'](sessionId, pageId);
        await page.waitForLoadState('networkidle', { timeout });
        this.browserManager['updateSessionActivity'](sessionId);
        return {
          content: [{ type: 'text', text: 'Network is idle' }],
          structuredContent: { success: true },
        };
      }, 'Error waiting for network idle')
    );

    // ==========================================
    // Emulation Tools (Accessibility Testing)
    // ==========================================

    // Emulate Reduced Motion Tool
    this.server.registerTool(
      'emulate_reduced_motion',
      {
        title: 'Emulate Reduced Motion',
        description:
          'Emulate reduced motion preference for accessibility testing. Important for users with vestibular disorders.',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          reducedMotion: z
            .enum(['reduce', 'no-preference'])
            .describe('Reduced motion preference'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId, reducedMotion }) => {
        const page = this.browserManager['getPage'](sessionId, pageId);
        await page.emulateMedia({ reducedMotion });
        this.browserManager['updateSessionActivity'](sessionId);
        return {
          content: [
            { type: 'text', text: `Reduced motion set to: ${reducedMotion}` },
          ],
          structuredContent: { success: true },
        };
      }, 'Error emulating reduced motion')
    );

    // Emulate Color Scheme Tool
    this.server.registerTool(
      'emulate_color_scheme',
      {
        title: 'Emulate Color Scheme',
        description: 'Emulate light or dark color scheme for theme testing',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          colorScheme: z
            .enum(['light', 'dark', 'no-preference'])
            .describe('Color scheme preference'),
        },
        outputSchema: {
          success: z.boolean(),
        },
      },
      this.createToolHandler(async ({ sessionId, pageId, colorScheme }) => {
        const page = this.browserManager['getPage'](sessionId, pageId);
        await page.emulateMedia({ colorScheme });
        this.browserManager['updateSessionActivity'](sessionId);
        return {
          content: [
            { type: 'text', text: `Color scheme set to: ${colorScheme}` },
          ],
          structuredContent: { success: true },
        };
      }, 'Error emulating color scheme')
    );

    // ==========================================
    // Enhanced Accessibility Reporting Tool
    // ==========================================

    // Generate Accessibility HTML Report Tool
    this.server.registerTool(
      'accessibility_report',
      {
        title: 'Generate Accessibility HTML Report',
        description:
          'Run accessibility scan and generate an HTML report file for audit purposes',
        inputSchema: {
          sessionId: z.string().describe('Browser session ID'),
          pageId: z.string().describe('Page ID'),
          outputPath: z
            .string()
            .optional()
            .describe(
              'Path to save HTML report (defaults to logs/a11y-report-{timestamp}.html)'
            ),
          tags: z
            .array(z.string())
            .optional()
            .describe('WCAG tags to filter by (e.g., wcag2a, wcag2aa)'),
        },
        outputSchema: {
          success: z.boolean(),
          reportPath: z.string(),
          violationsCount: z.number(),
        },
      },
      this.createToolHandler(
        async ({ sessionId, pageId, outputPath, tags }) => {
          const result = await this.browserManager.runAccessibilityScan(
            sessionId,
            pageId,
            { tags }
          );

          const reportPath =
            outputPath || `logs/a11y-report-${Date.now()}.html`;

          // Generate HTML report
          const htmlReport = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; line-height: 1.6; color: #333; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
    .summary { background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
    .summary-item { text-align: center; }
    .summary-value { font-size: 2em; font-weight: bold; color: #1a1a1a; }
    .summary-label { font-size: 0.9em; color: #666; }
    .violation { border: 1px solid #e0e0e0; padding: 20px; margin: 16px 0; border-radius: 12px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .critical { border-left: 5px solid #d32f2f; }
    .serious { border-left: 5px solid #f57c00; }
    .moderate { border-left: 5px solid #fbc02d; }
    .minor { border-left: 5px solid #388e3c; }
    .violation h2 { margin-top: 0; display: flex; align-items: center; gap: 10px; }
    .impact-badge { font-size: 0.7em; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 600; }
    .impact-critical { background: #ffebee; color: #c62828; }
    .impact-serious { background: #fff3e0; color: #e65100; }
    .impact-moderate { background: #fffde7; color: #f9a825; }
    .impact-minor { background: #e8f5e9; color: #2e7d32; }
    .node { background: #f9f9f9; padding: 12px; margin: 8px 0; border-radius: 8px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.85em; overflow-x: auto; }
    a { color: #1976d2; }
    .no-violations { text-align: center; padding: 40px; background: #e8f5e9; border-radius: 12px; color: #2e7d32; }
    .no-violations svg { width: 48px; height: 48px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>🔍 Accessibility Report</h1>
  <div class="summary">
    <div class="summary-item">
      <div class="summary-value">${result.violations.length}</div>
      <div class="summary-label">Violations</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${result.passes}</div>
      <div class="summary-label">Passed</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${result.incomplete}</div>
      <div class="summary-label">Incomplete</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${result.inapplicable}</div>
      <div class="summary-label">Inapplicable</div>
    </div>
  </div>
  <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
  ${
    result.violations.length === 0
      ? `<div class="no-violations">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
      <h2>No accessibility violations found!</h2>
      <p>Great job! Your page passes all accessibility checks.</p>
    </div>`
      : result.violations
          .map(
            (v) => `
  <div class="violation ${v.impact}">
    <h2>${v.id} <span class="impact-badge impact-${v.impact}">${v.impact}</span></h2>
    <p>${v.description}</p>
    <p><strong>How to fix:</strong> ${v.help}</p>
    <p><a href="${v.helpUrl}" target="_blank" rel="noopener noreferrer">Learn more →</a></p>
    <h3>Affected Elements (${v.nodes.length})</h3>
    ${v.nodes
      .slice(0, 10)
      .map(
        (n) => `
      <div class="node">
        <code>${n.html.replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 300)}${n.html.length > 300 ? '...' : ''}</code>
        <p style="margin: 8px 0 0; color: #666;">${n.failureSummary}</p>
      </div>`
      )
      .join('')}
    ${v.nodes.length > 10 ? `<p><em>...and ${v.nodes.length - 10} more elements</em></p>` : ''}
  </div>`
          )
          .join('')
  }
</body>
</html>`;

          const { promises: fs } = await import('fs');
          const path = await import('path');
          await fs.mkdir(path.dirname(reportPath), { recursive: true });
          await fs.writeFile(reportPath, htmlReport);

          return {
            content: [
              {
                type: 'text',
                text: `Accessibility report generated: ${result.violations.length} violations found. Report saved to ${reportPath}`,
              },
            ],
            structuredContent: {
              success: true,
              reportPath,
              violationsCount: result.violations.length,
            },
          };
        },
        'Error generating accessibility report'
      )
    );

    // Register modular handlers (new pattern)
    // These supplement the existing inline tools above
    // As migration progresses, inline tools can be moved to handlers/
    registerAllHandlers(this.server, this.browserManager, this.logger);

    this.logger.info('All tools registered successfully');
  }

  private registerResources(): void {
    // Server status resource with capacity info
    this.server.registerResource(
      'server-status',
      'playwright://status',
      {
        title: 'Server Status',
        description:
          'Current status of the MCP Playwright server with capacity information',
        mimeType: 'application/json',
      },
      // sync implementation but SDK expects async callback
      () => {
        try {
          const status = this.browserManager.getServerStatus();

          return {
            contents: [
              {
                uri: 'playwright://status',
                mimeType: 'application/json',
                text: JSON.stringify({
                  status: 'running',
                  capacity: {
                    activeSessions: status.activeSessions,
                    maxSessions: status.maxSessions,
                    availableSlots: status.availableSlots,
                    utilizationPercent: Math.round(
                      (status.activeSessions / status.maxSessions) * 100
                    ),
                  },
                  sessions: status.sessions,
                  config: {
                    defaultBrowser: config.defaultBrowser,
                    headless: config.headless,
                    sessionTimeout: config.sessionTimeout,
                    cleanupInterval: config.cleanupInterval,
                  },
                  timestamp: new Date().toISOString(),
                }),
              },
            ],
          };
        } catch (error) {
          this.logger.error('Failed to get server status', {
            error: toError(error).message,
          });
          return {
            contents: [
              {
                uri: 'playwright://status',
                mimeType: 'application/json',
                text: JSON.stringify({
                  status: 'error',
                  error: toError(error).message,
                }),
              },
            ],
          };
        }
      }
    );

    // Health check resource with detailed metrics
    this.server.registerResource(
      'health',
      'playwright://health',
      {
        title: 'Health Check',
        description: 'Server health status with performance metrics',
        mimeType: 'application/json',
      },
      // sync implementation but SDK expects async callback
      () => {
        try {
          const sessions = this.browserManager.listSessions();
          const memoryUsage = process.memoryUsage();

          return {
            contents: [
              {
                uri: 'playwright://health',
                mimeType: 'application/json',
                text: JSON.stringify({
                  status: 'healthy',
                  uptime: process.uptime(),
                  uptimeFormatted: this.formatUptime(process.uptime()),
                  memory: {
                    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                    external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
                  },
                  sessions: {
                    active: sessions.length,
                    max: config.maxConcurrentSessions,
                    details: sessions.map((s) => ({
                      id: s.id,
                      browserType: s.browserType,
                      pageCount: s.pageCount,
                      idleSeconds: Math.round(
                        (Date.now() - s.lastActivity.getTime()) / 1000
                      ),
                    })),
                  },
                  version: '1.0.0',
                  nodeVersion: process.version,
                  timestamp: new Date().toISOString(),
                }),
              },
            ],
          };
        } catch (error) {
          this.logger.error('Failed to get health status', {
            error: toError(error).message,
          });
          return {
            contents: [
              {
                uri: 'playwright://health',
                mimeType: 'application/json',
                text: JSON.stringify({
                  status: 'unhealthy',
                  error: toError(error).message,
                }),
              },
            ],
          };
        }
      }
    );

    this.logger.info('Resources registered successfully');
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('MCP Playwright Server started successfully');
  }
}

export default MCPPlaywrightServer;
