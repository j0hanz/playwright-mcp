// Tool Handler Types and Utilities - Shared types and helpers for MCP tool handlers
// @see https://modelcontextprotocol.io/docs for MCP SDK documentation

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import type { BrowserManager } from '../../playwright/browser-manager.js';
import {
  ErrorCode,
  isMCPPlaywrightError,
  toError,
} from '../../utils/error-handler.js';
import { Logger } from '../../utils/logger.js';

// Request ID Generation

export function generateRequestId(): string {
  return uuidv4().slice(0, 8);
}

// Retry Hints

const RETRY_HINTS: Readonly<Record<ErrorCode, string>> = {
  [ErrorCode.BROWSER_LAUNCH_FAILED]:
    'Run `npx playwright install` to install browsers. Check system resources and permissions.',
  [ErrorCode.BROWSER_CLOSED]:
    'Browser was closed unexpectedly. Launch a new browser session with browser_launch.',
  [ErrorCode.PAGE_NAVIGATION_FAILED]:
    'Check URL validity and network connectivity. Ensure the server is running.',
  [ErrorCode.PAGE_CRASHED]:
    'Page crashed. Close and recreate the page. Consider reducing memory usage.',
  [ErrorCode.ELEMENT_NOT_FOUND]:
    'Element not found. Use Playwright locators: getByRole(), getByLabel(), getByTestId(). Try wait_for_selector first.',
  [ErrorCode.ELEMENT_NOT_VISIBLE]:
    'Element exists but is hidden. Check CSS (display, visibility, opacity). May need to scroll or wait.',
  [ErrorCode.ELEMENT_NOT_ENABLED]:
    'Element is disabled. Wait for it to become enabled or check application state.',
  [ErrorCode.ELEMENT_DETACHED]:
    'Element was removed from DOM (common in SPAs). Re-query using a fresh locator.',
  [ErrorCode.TIMEOUT_EXCEEDED]:
    'Operation timed out. Increase timeout, check element visibility, or use networkidle wait.',
  [ErrorCode.NAVIGATION_TIMEOUT]:
    'Navigation timed out. Check network, increase timeout, or use domcontentloaded instead of load.',
  [ErrorCode.SESSION_NOT_FOUND]:
    'Session not found. It may have expired (30 min timeout). Launch a new session.',
  [ErrorCode.SESSION_EXPIRED]:
    'Session expired due to inactivity. Sessions timeout after 30 minutes.',
  [ErrorCode.PAGE_NOT_FOUND]:
    'Page was closed or never created. Use browser_tabs to list pages or browser_navigate to create one.',
  [ErrorCode.VALIDATION_FAILED]:
    'Input validation failed. Check parameter types and values against the schema.',
  [ErrorCode.INVALID_SELECTOR]:
    'Selector syntax is invalid. Prefer Playwright locators: getByRole(), getByLabel(), getByTestId().',
  [ErrorCode.INVALID_URL]:
    'URL is invalid. Must use http:// or https:// protocol. Check for typos.',
  [ErrorCode.ASSERTION_FAILED]:
    'Assertion failed. Verify expected vs actual values. Consider using soft assertions for debugging.',
  [ErrorCode.SCREENSHOT_FAILED]:
    'Screenshot failed. Ensure page is loaded and visible. Check disk space and permissions.',
  [ErrorCode.NETWORK_ERROR]:
    'Network error. Check internet connectivity, proxy settings, and firewall rules.',
  [ErrorCode.INTERNAL_ERROR]:
    'Internal error occurred. Check server logs for details. This may be a bug.',
  [ErrorCode.TOOL_NOT_FOUND]:
    'Tool not found. Use sessions_list to see available tools.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]:
    'Rate limit exceeded. Wait a moment and retry. Consider batching operations.',
  [ErrorCode.SECURITY_VIOLATION]:
    'Security policy violation. This operation is not permitted for security reasons.',
};

export function getRetryHint(code: ErrorCode): string | undefined {
  return RETRY_HINTS[code];
}

// Response Types

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export type ToolContent = Array<TextContent | ImageContent>;

export interface ToolResponse<T = unknown> {
  content: ToolContent;
  structuredContent?: T;
  isError?: boolean;
}

export interface ErrorResponse {
  [key: string]: unknown;
  content: [TextContent];
  isError: true;
  requestId?: string;
}

export interface SuccessResponse<T> extends ToolResponse<T> {
  isError?: false;
}

// Pagination Types

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export function createPaginationMeta(
  params: PaginationParams,
  totalItems: number
): PaginationMeta {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function paginate<T>(
  items: T[],
  params: PaginationParams
): PaginatedResponse<T> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  return {
    items: paginatedItems,
    pagination: createPaginationMeta(params, items.length),
  };
}

// Error Response Builder

export function toolErrorResponse(
  prefix: string,
  error: unknown,
  requestId?: string
): ErrorResponse {
  const err = toError(error);

  // Build error message parts
  const parts: string[] = [prefix, ': ', err.message];

  // Add retry hint for known error codes
  if (isMCPPlaywrightError(err)) {
    const hint = RETRY_HINTS[err.code];
    if (hint) {
      parts.push(` [Hint: ${hint}]`);
    }
    // Add retryable indicator
    if (err.retryable) {
      parts.push(' (retryable)');
    }
  }

  // Add request ID for tracing
  if (requestId) {
    parts.push(` [req:${requestId}]`);
  }

  return {
    content: [{ type: 'text' as const, text: parts.join('') }],
    isError: true,
    requestId,
  };
}

// Success Response Builders

export function successResponse<T>(message: string, data: T): ToolResponse<T> {
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: data,
  };
}

export function imageResponse<T>(
  message: string,
  base64Data: string,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
  data: T
): ToolResponse<T> {
  return {
    content: [
      { type: 'text', text: message },
      { type: 'image', data: base64Data, mimeType },
    ],
    structuredContent: data,
  };
}

export function multiTextResponse<T>(
  messages: string[],
  data: T
): ToolResponse<T> {
  return {
    content: messages.map((text) => ({ type: 'text' as const, text })),
    structuredContent: data,
  };
}

export function paginatedResponse<T>(
  message: string,
  items: T[],
  params: PaginationParams
): ToolResponse<PaginatedResponse<T>> {
  const paginated = paginate(items, params);
  const paginationInfo = `Page ${paginated.pagination.page}/${paginated.pagination.totalPages} (${paginated.pagination.totalItems} total)`;

  return {
    content: [{ type: 'text', text: `${message}. ${paginationInfo}` }],
    structuredContent: paginated,
  };
}

// Tool Context Types

export interface ToolContext {
  server: McpServer;
  browserManager: BrowserManager;
  logger: Logger;
  createToolHandler: <T, R extends { structuredContent?: unknown }>(
    handler: (input: T) => Promise<R>,
    errorMessage: string
  ) => (input: T) => Promise<R | ErrorResponse>;
}

export type ToolRegistrationFn = (ctx: ToolContext) => void;

// Tool Handler Factory

export function createToolHandlerFactory(logger: Logger) {
  return function createToolHandler<
    T,
    R extends { structuredContent?: unknown },
  >(
    handler: (input: T) => Promise<R>,
    errorMessage: string
  ): (input: T) => Promise<R | ErrorResponse> {
    return async (input: T) => {
      const requestId = generateRequestId();
      const timer = logger.startTimer('toolHandler');

      try {
        const result = await handler(input);
        timer.done({ requestId });
        return result;
      } catch (error) {
        const durationMs = timer.elapsed();
        timer.cancel();

        const err = toError(error);
        const errorCode = isMCPPlaywrightError(err) ? err.code : 'UNKNOWN';

        logger.error(errorMessage, {
          requestId,
          errorCode,
          error: err.message,
          durationMs,
          stack: err.stack,
        });

        return toolErrorResponse(errorMessage, error, requestId);
      }
    };
  };
}

// Utility Functions

export function textContent(text: string): TextContent {
  return { type: 'text', text };
}

export function isErrorResponse(
  response: ToolResponse | ErrorResponse
): response is ErrorResponse {
  return response.isError === true;
}

export function createResponseBuilder(requestId?: string) {
  return {
    success: <T>(message: string, data: T): ToolResponse<T> =>
      successResponse(message, data),
    error: (prefix: string, error: unknown): ErrorResponse =>
      toolErrorResponse(prefix, error, requestId),
    image: <T>(
      message: string,
      base64Data: string,
      mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
      data: T
    ): ToolResponse<T> => imageResponse(message, base64Data, mimeType, data),
    paginated: <T>(
      message: string,
      items: T[],
      params: PaginationParams
    ): ToolResponse<PaginatedResponse<T>> =>
      paginatedResponse(message, items, params),
  };
}

// Shared Zod Schemas

export const basePageInput = {
  sessionId: z.string().describe('Browser session ID'),
  pageId: z.string().describe('Page ID'),
} as const;

export const timeoutOption = {
  timeout: z.number().default(5000).describe('Timeout in milliseconds'),
} as const;

export const longTimeoutOption = {
  timeout: z.number().default(30000).describe('Timeout in milliseconds'),
} as const;

export const forceOption = {
  force: z
    .boolean()
    .default(false)
    .describe('Force action even if element is not actionable'),
} as const;

export const exactMatchOption = {
  exact: z.boolean().default(false).describe('Whether match should be exact'),
} as const;

export const selectorInput = {
  ...basePageInput,
  selector: z.string().describe('CSS selector for the element'),
} as const;

export const baseLocatorInput = {
  ...basePageInput,
  ...timeoutOption,
} as const;

export const selectorWithTimeout = {
  ...selectorInput,
  ...timeoutOption,
} as const;
