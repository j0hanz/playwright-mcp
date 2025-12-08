// Advanced Tool Handlers - Tracing, Network Interception, HAR, PDF, Console, Frames
// @see https://playwright.dev/docs/trace-viewer
// @see https://playwright.dev/docs/network
// @see https://playwright.dev/docs/frames

import { z } from 'zod';

import type { ToolContext } from '../../config/types.js';
import { ConsoleCaptureService } from '../services/console-capture-service.js';
import {
  basePageInput,
  destructiveAnnotations,
  interactionAnnotations,
  readOnlyAnnotations,
  timeoutOption,
} from './schemas.js';
import { textContent } from './types.js';

// ============================================================================
// Schemas
// ============================================================================

const schemas = {
  // Tracing schemas
  tracingStartInput: {
    sessionId: z.string().describe('Browser session ID'),
    screenshots: z
      .boolean()
      .default(true)
      .describe('Capture screenshots during tracing'),
    snapshots: z
      .boolean()
      .default(true)
      .describe('Capture DOM snapshots for each action'),
    sources: z
      .boolean()
      .default(false)
      .describe('Include source files in the trace'),
    title: z.string().optional().describe('Title for the trace'),
  },
  tracingStopInput: {
    sessionId: z.string().describe('Browser session ID'),
    path: z
      .string()
      .default('trace.zip')
      .describe('Path to save the trace file'),
  },
  tracingGroupInput: {
    sessionId: z.string().describe('Browser session ID'),
    name: z.string().describe('Name for the trace group'),
  },

  // Network interception schemas
  routeInput: {
    ...basePageInput,
    urlPattern: z
      .string()
      .describe(
        'URL pattern to intercept (glob, regex string, or exact URL). Examples: "**/api/**", "https://api.example.com/*"'
      ),
    action: z
      .enum(['abort', 'fulfill', 'continue'])
      .describe('Action to take on matching requests'),
    // For fulfill action
    status: z
      .number()
      .optional()
      .describe('HTTP status code for fulfill action'),
    contentType: z
      .string()
      .optional()
      .describe('Content-Type header for fulfill action'),
    body: z.string().optional().describe('Response body for fulfill action'),
    headers: z
      .record(z.string())
      .optional()
      .describe('Response headers for fulfill action'),
    // For continue action
    url: z.string().optional().describe('Override URL for continue action'),
    method: z
      .string()
      .optional()
      .describe('Override HTTP method for continue action'),
    postData: z
      .string()
      .optional()
      .describe('Override POST data for continue action'),
  },
  unrouteInput: {
    ...basePageInput,
    urlPattern: z
      .string()
      .optional()
      .describe('URL pattern to unroute. If not specified, removes all routes'),
  },

  // HAR schemas
  harRecordInput: {
    sessionId: z.string().describe('Browser session ID'),
    path: z.string().describe('Path to save the HAR file'),
    urlFilter: z
      .string()
      .optional()
      .describe(
        'URL pattern to filter recorded requests (glob or regex string)'
      ),
  },
  harPlaybackInput: {
    ...basePageInput,
    path: z.string().describe('Path to the HAR file'),
    urlFilter: z
      .string()
      .optional()
      .describe('URL pattern to match for playback'),
    notFound: z
      .enum(['abort', 'fallback'])
      .default('fallback')
      .describe('Behavior when request not found in HAR'),
    update: z
      .boolean()
      .default(false)
      .describe('Update HAR file with new requests'),
  },

  // PDF schema
  pdfInput: {
    ...basePageInput,
    path: z.string().describe('Path to save the PDF file'),
    format: z
      .enum([
        'Letter',
        'Legal',
        'Tabloid',
        'Ledger',
        'A0',
        'A1',
        'A2',
        'A3',
        'A4',
        'A5',
        'A6',
      ])
      .default('Letter')
      .describe('Paper format'),
    landscape: z.boolean().default(false).describe('Paper orientation'),
    printBackground: z
      .boolean()
      .default(true)
      .describe('Print background graphics'),
    scale: z
      .number()
      .min(0.1)
      .max(2)
      .default(1)
      .describe('Scale of webpage rendering'),
    displayHeaderFooter: z
      .boolean()
      .default(false)
      .describe('Display header and footer'),
    headerTemplate: z
      .string()
      .optional()
      .describe(
        'HTML template for header. Use classes: date, title, url, pageNumber, totalPages'
      ),
    footerTemplate: z.string().optional().describe('HTML template for footer'),
    margin: z
      .object({
        top: z.string().optional(),
        right: z.string().optional(),
        bottom: z.string().optional(),
        left: z.string().optional(),
      })
      .optional()
      .describe('Page margins (e.g., "1cm", "0.5in")'),
    pageRanges: z
      .string()
      .optional()
      .describe('Paper ranges to print (e.g., "1-5, 8, 11-13")'),
    preferCSSPageSize: z
      .boolean()
      .default(false)
      .describe('Prefer CSS-defined page size'),
  },

  // Console capture schema
  consoleCaptureInput: {
    ...basePageInput,
    action: z
      .enum(['start', 'stop', 'get'])
      .describe(
        'Action: start capturing, stop capturing, or get captured logs'
      ),
    types: z
      .array(z.enum(['log', 'info', 'warn', 'error', 'debug', 'trace']))
      .optional()
      .describe('Console message types to capture (default: all)'),
    maxMessages: z
      .number()
      .default(100)
      .describe('Maximum number of messages to keep'),
  },

  // Frame schemas
  frameInput: {
    ...basePageInput,
    frameSelector: z
      .string()
      .describe('Selector for the iframe element (e.g., "iframe#content")'),
  },
  frameActionInput: {
    ...basePageInput,
    frameSelector: z.string().describe('Selector for the iframe element'),
    action: z
      .enum(['click', 'fill', 'getText', 'waitForSelector'])
      .describe('Action to perform inside the frame'),
    selector: z.string().describe('Selector for the element inside the frame'),
    value: z.string().optional().describe('Value for fill action'),
    ...timeoutOption,
  },

  // Output schemas
  successResult: { success: z.boolean() },
  pathResult: { success: z.boolean(), path: z.string() },
  consoleResult: {
    success: z.boolean(),
    messages: z
      .array(
        z.object({
          type: z.string(),
          text: z.string(),
          timestamp: z.string(),
          location: z.string().optional(),
        })
      )
      .optional(),
    count: z.number().optional(),
  },
  frameResult: {
    success: z.boolean(),
    frameUrl: z.string().optional(),
    frameName: z.string().optional(),
    result: z.unknown().optional(),
  },
} as const;

// Console capture service instance (shared across all registrations)
const consoleCaptureService = new ConsoleCaptureService();

export function registerAdvancedTools(ctx: ToolContext): void {
  const { server, browserManager, createToolHandler } = ctx;

  // ============================================================================
  // Tracing Tools
  // ============================================================================

  server.registerTool(
    'tracing_start',
    {
      title: 'Start Tracing',
      description:
        'Start recording a trace for debugging. Captures screenshots, DOM snapshots, and action logs. View traces at trace.playwright.dev',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.tracingStartInput,
      outputSchema: schemas.successResult,
    },
    createToolHandler(
      async ({ sessionId, screenshots, snapshots, sources, title }) => {
        const result = await browserManager.tracingActions.startTracing(
          sessionId,
          { screenshots, snapshots, sources }
        );

        return {
          content: [
            textContent(
              `Tracing started${title ? ` (${title})` : ''}. Screenshots: ${screenshots}, Snapshots: ${snapshots}, Sources: ${sources}`
            ),
          ],
          structuredContent: result,
        };
      },
      'Error starting tracing'
    )
  );

  server.registerTool(
    'tracing_stop',
    {
      title: 'Stop Tracing',
      description:
        'Stop recording and save the trace to a file. Open the trace file at https://trace.playwright.dev',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.tracingStopInput,
      outputSchema: schemas.pathResult,
    },
    createToolHandler(async ({ sessionId, path }) => {
      const result = await browserManager.tracingActions.stopTracing(
        sessionId,
        path
      );

      return {
        content: [
          textContent(
            `Tracing stopped. Trace saved to ${result.path}. View at https://trace.playwright.dev`
          ),
        ],
        structuredContent: result,
      };
    }, 'Error stopping tracing')
  );

  server.registerTool(
    'tracing_group',
    {
      title: 'Start Trace Group',
      description:
        'Start a named group in the trace to organize related actions. Call tracing_group_end to close.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.tracingGroupInput,
      outputSchema: { success: z.boolean(), groupName: z.string() },
    },
    createToolHandler(async ({ sessionId, name }) => {
      const result = await browserManager.tracingActions.startTracingGroup(
        sessionId,
        name
      );

      return {
        content: [textContent(`Trace group started: ${name}`)],
        structuredContent: result,
      };
    }, 'Error starting trace group')
  );

  server.registerTool(
    'tracing_group_end',
    {
      title: 'End Trace Group',
      description: 'End the current trace group started with tracing_group',
      annotations: readOnlyAnnotations,
      inputSchema: { sessionId: z.string().describe('Browser session ID') },
      outputSchema: schemas.successResult,
    },
    createToolHandler(async ({ sessionId }) => {
      const result =
        await browserManager.tracingActions.endTracingGroup(sessionId);

      return {
        content: [textContent('Trace group ended')],
        structuredContent: result,
      };
    }, 'Error ending trace group')
  );

  // ============================================================================
  // Network Interception Tools
  // ============================================================================

  server.registerTool(
    'network_route',
    {
      title: 'Route Network Request',
      description: `Intercept and modify network requests matching a URL pattern.
Actions:
- 'abort': Block the request entirely
- 'fulfill': Return a custom response (specify status, body, headers)
- 'continue': Modify and forward the request (change URL, method, postData)

URL patterns: Use glob patterns like "**/api/**" or regex strings`,
      annotations: interactionAnnotations,
      inputSchema: schemas.routeInput,
      outputSchema: schemas.successResult,
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        urlPattern,
        action,
        status,
        contentType,
        body,
        headers,
        url,
        method,
        postData,
      }) => {
        const page = browserManager.getPageForTool(sessionId, pageId);

        await page.route(urlPattern, async (route) => {
          switch (action) {
            case 'abort':
              await route.abort();
              break;
            case 'fulfill':
              await route.fulfill({
                status: status ?? 200,
                contentType: contentType ?? 'application/json',
                body: body ?? '',
                headers,
              });
              break;
            case 'continue':
              await route.continue({
                url,
                method,
                postData,
              });
              break;
          }
        });

        browserManager.markSessionActive(sessionId);

        return {
          content: [
            textContent(
              `Route set: ${urlPattern} → ${action}${action === 'fulfill' ? ` (${status ?? 200})` : ''}`
            ),
          ],
          structuredContent: { success: true },
        };
      },
      'Error setting network route'
    )
  );

  server.registerTool(
    'network_unroute',
    {
      title: 'Remove Network Route',
      description:
        'Remove previously set network routes. If no pattern specified, removes all routes.',
      annotations: destructiveAnnotations,
      inputSchema: schemas.unrouteInput,
      outputSchema: schemas.successResult,
    },
    createToolHandler(async ({ sessionId, pageId, urlPattern }) => {
      const page = browserManager.getPageForTool(sessionId, pageId);

      if (urlPattern) {
        await page.unroute(urlPattern);
      } else {
        await page.unrouteAll();
      }

      browserManager.markSessionActive(sessionId);

      return {
        content: [
          textContent(
            urlPattern ? `Route removed: ${urlPattern}` : 'All routes removed'
          ),
        ],
        structuredContent: { success: true },
      };
    }, 'Error removing network route')
  );

  // ============================================================================
  // HAR Recording & Playback Tools
  // ============================================================================

  server.registerTool(
    'har_record_start',
    {
      title: 'Start HAR Recording',
      description:
        'Start recording HTTP Archive (HAR) for network analysis. Records all network requests during the session.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.harRecordInput,
      outputSchema: schemas.pathResult,
    },
    createToolHandler(async ({ sessionId, path, urlFilter }) => {
      const result = await browserManager.networkActions.contextRouteFromHAR(
        sessionId,
        path,
        {
          update: true,
          updateMode: 'full',
          url: urlFilter,
        }
      );

      return {
        content: [
          textContent(
            `HAR recording started. Will save to: ${path}${urlFilter ? ` (filter: ${urlFilter})` : ''}`
          ),
        ],
        structuredContent: { success: true, path: result.harPath },
      };
    }, 'Error starting HAR recording')
  );

  server.registerTool(
    'har_playback',
    {
      title: 'Playback HAR File',
      description:
        'Use a HAR file to mock network responses. Requests matching the HAR will return recorded responses.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.harPlaybackInput,
      outputSchema: schemas.pathResult,
    },
    createToolHandler(
      async ({ sessionId, pageId, path, urlFilter, notFound, update }) => {
        const result = await browserManager.networkActions.routeFromHAR(
          sessionId,
          pageId,
          path,
          {
            url: urlFilter,
            notFound,
            update,
          }
        );

        return {
          content: [
            textContent(
              `HAR playback enabled from: ${path}${urlFilter ? ` (filter: ${urlFilter})` : ''}`
            ),
          ],
          structuredContent: { success: true, path: result.harPath },
        };
      },
      'Error setting up HAR playback'
    )
  );

  // ============================================================================
  // PDF Generation Tool
  // ============================================================================

  server.registerTool(
    'page_pdf',
    {
      title: 'Generate PDF',
      description:
        'Generate a PDF of the current page (Chromium only). Useful for reports, invoices, or archiving pages.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.pdfInput,
      outputSchema: schemas.pathResult,
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        path,
        format,
        landscape,
        printBackground,
        scale,
        displayHeaderFooter,
        headerTemplate,
        footerTemplate,
        margin,
        pageRanges,
        preferCSSPageSize,
      }) => {
        const page = browserManager.getPageForTool(sessionId, pageId);

        await page.pdf({
          path,
          format,
          landscape,
          printBackground,
          scale,
          displayHeaderFooter,
          headerTemplate,
          footerTemplate,
          margin,
          pageRanges,
          preferCSSPageSize,
        });

        browserManager.markSessionActive(sessionId);

        return {
          content: [
            textContent(
              `PDF generated: ${path} (${format}, ${landscape ? 'landscape' : 'portrait'})`
            ),
          ],
          structuredContent: { success: true, path },
        };
      },
      'Error generating PDF'
    )
  );

  // ============================================================================
  // Console Capture Tool
  // ============================================================================

  server.registerTool(
    'console_capture',
    {
      title: 'Capture Console Logs',
      description:
        'Capture browser console messages for debugging. Start capturing, then get logs, then stop when done.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.consoleCaptureInput,
      outputSchema: schemas.consoleResult,
    },
    createToolHandler(
      async ({ sessionId, pageId, action, types, maxMessages }) => {
        const page = browserManager.getPageForTool(sessionId, pageId);

        // Ensure async context for tool handler contract
        await Promise.resolve();

        switch (action) {
          case 'start': {
            consoleCaptureService.start(page, sessionId, pageId, {
              types,
              maxMessages,
            });
            browserManager.markSessionActive(sessionId);

            const typeList =
              types?.join(', ') || 'log, info, warn, error, debug, trace';
            return {
              content: [
                textContent(`Console capture started. Types: ${typeList}`),
              ],
              structuredContent: { success: true, count: 0 },
            };
          }

          case 'stop': {
            const result = consoleCaptureService.stop(page, sessionId, pageId);
            browserManager.markSessionActive(sessionId);

            return {
              content: [textContent('Console capture stopped')],
              structuredContent: {
                success: true,
                count: result.count,
              },
            };
          }

          case 'get': {
            const result = consoleCaptureService.get(sessionId, pageId);
            browserManager.markSessionActive(sessionId);

            const displayText = ConsoleCaptureService.formatMessages(
              result.messages ?? []
            );

            return {
              content: [textContent(displayText)],
              structuredContent: {
                success: true,
                messages: result.messages,
                count: result.count,
              },
            };
          }
        }
      },
      'Error managing console capture'
    )
  );

  // ============================================================================
  // Frame Support Tools
  // ============================================================================

  server.registerTool(
    'frame_locator',
    {
      title: 'Locate Frame',
      description:
        'Get information about an iframe. Use this before performing actions inside frames.',
      annotations: readOnlyAnnotations,
      inputSchema: schemas.frameInput,
      outputSchema: schemas.frameResult,
    },
    createToolHandler(async ({ sessionId, pageId, frameSelector }) => {
      const page = browserManager.getPageForTool(sessionId, pageId);

      // Use frameLocator to find the frame
      const frameLocator = page.frameLocator(frameSelector);

      let frameUrl = '';
      let frameName = '';

      try {
        // Check if the frame has content
        const content = await frameLocator.locator('body').count();
        if (content > 0) {
          // Get frame element to extract src
          const frameElement = page.locator(frameSelector);
          frameUrl = (await frameElement.getAttribute('src')) ?? '';
          frameName = (await frameElement.getAttribute('name')) ?? '';
        }
      } catch {
        // Frame might not be loaded yet
      }

      browserManager.markSessionActive(sessionId);

      return {
        content: [
          textContent(
            `Frame found: ${frameSelector}${frameUrl ? ` (src: ${frameUrl})` : ''}${frameName ? ` (name: ${frameName})` : ''}`
          ),
        ],
        structuredContent: {
          success: true,
          frameUrl,
          frameName,
        },
      };
    }, 'Error locating frame')
  );

  server.registerTool(
    'frame_action',
    {
      title: 'Perform Action in Frame',
      description:
        'Perform an action (click, fill, getText, waitForSelector) inside an iframe.',
      annotations: interactionAnnotations,
      inputSchema: schemas.frameActionInput,
      outputSchema: schemas.frameResult,
    },
    createToolHandler(
      async ({
        sessionId,
        pageId,
        frameSelector,
        action,
        selector,
        value,
        timeout,
      }) => {
        const page = browserManager.getPageForTool(sessionId, pageId);
        const frameLocator = page.frameLocator(frameSelector);
        const locator = frameLocator.locator(selector);

        let result: unknown;
        let description: string;

        switch (action) {
          case 'click':
            await locator.click({ timeout });
            description = `Clicked ${selector} in frame`;
            break;
          case 'fill':
            if (!value) {
              throw new Error('Value required for fill action');
            }
            await locator.fill(value, { timeout });
            description = `Filled ${selector} in frame`;
            break;
          case 'getText':
            result = await locator.textContent({ timeout });
            description = `Got text from ${selector} in frame`;
            break;
          case 'waitForSelector':
            await locator.waitFor({ timeout });
            description = `Waited for ${selector} in frame`;
            break;
        }

        browserManager.markSessionActive(sessionId);

        return {
          content: [textContent(description)],
          structuredContent: { success: true, result },
        };
      },
      'Error performing frame action'
    )
  );
}
