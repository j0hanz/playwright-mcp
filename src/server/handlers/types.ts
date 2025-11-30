/**
 * Tool Handler Types and Utilities
 *
 * Shared types and helper functions for MCP tool handlers.
 * Following MCP SDK best practices for consistent tool responses.
 *
 * **Features:**
 * - Standardized response builders for text, image, and paginated content
 * - Error handling with actionable retry hints (Playwright-specific)
 * - Request ID generation for distributed tracing
 * - Performance timing utilities
 * - Pagination support for list operations
 * - Type-safe tool context for dependency injection
 *
 * **Response Patterns:**
 * ```typescript
 * // Success with data
 * return successResponse('Page loaded', { url, title });
 *
 * // Success with image
 * return imageResponse('Screenshot', base64, 'image/png', { path });
 *
 * // Error with retry hint
 * return toolErrorResponse('Click failed', error, requestId);
 *
 * // Paginated list
 * return paginatedResponse('Found sessions', sessions, { page: 1 });
 * ```
 *
 * **Best Practices:**
 * - Use createToolHandler factory for consistent error handling
 * - Include request IDs for tracing in production
 * - Return structured content for programmatic access
 * - Use retry hints to help users recover from errors
 *
 * @module handlers/types
 */
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

// ============================================
// Request ID Generation
// ============================================

/**
 * Generate a short unique request ID for tracing tool invocations.
 * Uses first 8 characters of UUID for brevity in logs.
 */
export function generateRequestId(): string {
  return uuidv4().slice(0, 8);
}

// ============================================
// Retry Hints
// ============================================

/**
 * Error retry hints mapped by error code.
 * Provides actionable, Playwright-specific guidance for common error scenarios.
 *
 * **Design Principles:**
 * - Start with the most likely cause
 * - Include specific Playwright commands/APIs when helpful
 * - Mention relevant best practices
 * - Be concise but actionable
 *
 * **Hint Categories:**
 * - Browser lifecycle: Install, launch, and connection issues
 * - Navigation: URL validation, network errors
 * - Element: Locator strategies, visibility, actionability
 * - Timeout: Increase timeout, check conditions
 * - Session: Expiry, cleanup, reconnection
 * - Validation: Schema compliance, parameter types
 */
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

/**
 * Get retry hint for an error code.
 */
export function getRetryHint(code: ErrorCode): string | undefined {
  return RETRY_HINTS[code];
}

// ============================================
// Response Types
// ============================================

/**
 * Text content in tool response.
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content in tool response.
 */
export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

/**
 * Content array for tool responses.
 */
export type ToolContent = Array<TextContent | ImageContent>;

/**
 * Tool response with content array and optional structured data.
 */
export interface ToolResponse<T = unknown> {
  content: ToolContent;
  structuredContent?: T;
  isError?: boolean;
}

/**
 * Error response type - includes index signature for MCP SDK compatibility.
 */
export interface ErrorResponse {
  [key: string]: unknown;
  content: [TextContent];
  isError: true;
  requestId?: string;
}

/**
 * Success response with structured data.
 */
export interface SuccessResponse<T> extends ToolResponse<T> {
  isError?: false;
}

// ============================================
// Pagination Types
// ============================================

/**
 * Pagination parameters for list operations.
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
}

/**
 * Paginated response metadata.
 */
export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total items across all pages */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
  /** Cursor for next page (if cursor-based) */
  nextCursor?: string;
}

/**
 * Paginated list response.
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Create pagination metadata from params and total count.
 */
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

/**
 * Apply pagination to an array.
 */
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

// ============================================
// Error Response Builder
// ============================================

/**
 * Create a standardized error response with optional retry hints.
 *
 * @param prefix - Error message prefix describing the operation
 * @param error - The error that occurred
 * @param requestId - Optional request ID for tracing
 * @returns Formatted error response with helpful retry hints
 *
 * @example
 * ```typescript
 * try {
 *   await page.click(selector);
 * } catch (error) {
 *   return toolErrorResponse('Click failed', error, requestId);
 * }
 * ```
 */
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

// ============================================
// Success Response Builders
// ============================================

/**
 * Create success response with text content.
 *
 * **Use for most tool responses.** The message appears in the chat,
 * while the data is available programmatically.
 *
 * @param message - Human-readable success message for display
 * @param data - Structured data for programmatic access
 * @returns Tool response with both text content and structured data
 *
 * @example
 * ```typescript
 * // Navigation result
 * return successResponse('Page loaded successfully', { url, title });
 *
 * // Element interaction
 * return successResponse('Clicked button "Submit"', { success: true });
 *
 * // Data retrieval
 * return successResponse(`Found ${count} sessions`, { sessions, count });
 * ```
 */
export function successResponse<T>(message: string, data: T): ToolResponse<T> {
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: data,
  };
}

/**
 * Create success response with image content.
 *
 * **Use for screenshots and visual content.** The image is embedded
 * in the response and displayed inline in compatible clients.
 *
 * @param message - Description of the image/screenshot
 * @param base64Data - Base64-encoded image data
 * @param mimeType - Image MIME type (image/png, image/jpeg, image/webp)
 * @param data - Additional structured data (e.g., dimensions, path)
 * @returns Tool response with text, image, and structured content
 *
 * @example
 * ```typescript
 * // Full page screenshot
 * return imageResponse(
 *   'Screenshot captured (full page)',
 *   screenshotBase64,
 *   'image/png',
 *   { width: 1920, height: 3000, fullPage: true }
 * );
 *
 * // Element screenshot with path
 * return imageResponse(
 *   `Screenshot saved to ${path}`,
 *   base64Data,
 *   'image/jpeg',
 *   { path, quality: 80 }
 * );
 * ```
 */
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

/**
 * Create success response with multiple text items.
 *
 * @example
 * ```typescript
 * return multiTextResponse(
 *   ['Found 5 elements', 'First element: button'],
 *   { count: 5, elements: [...] }
 * );
 * ```
 */
export function multiTextResponse<T>(
  messages: string[],
  data: T
): ToolResponse<T> {
  return {
    content: messages.map((text) => ({ type: 'text' as const, text })),
    structuredContent: data,
  };
}

/**
 * Create success response with paginated data.
 *
 * @example
 * ```typescript
 * return paginatedResponse(
 *   'Found sessions',
 *   sessions,
 *   { page: 1, pageSize: 10 }
 * );
 * ```
 */
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

// ============================================
// Tool Context Types
// ============================================

/**
 * Context passed to tool registration functions.
 * Provides access to server, browser manager, logger, and handler factory.
 */
export interface ToolContext {
  server: McpServer;
  browserManager: BrowserManager;
  logger: Logger;
  createToolHandler: <T, R extends { structuredContent?: unknown }>(
    handler: (input: T) => Promise<R>,
    errorMessage: string
  ) => (input: T) => Promise<R | ErrorResponse>;
}

/**
 * Tool registration function signature.
 * Each handler module exports a function that registers its tools.
 */
export type ToolRegistrationFn = (ctx: ToolContext) => void;

// ============================================
// Tool Handler Factory
// ============================================

/**
 * Higher-order function that wraps tool handlers with consistent error handling.
 * Eliminates repetitive try-catch-toolErrorResponse pattern (DRY principle).
 *
 * **Features:**
 * - Automatic request ID generation for tracing
 * - Structured error logging with request context
 * - Retry hints based on error type (Playwright-specific)
 * - Execution timing for performance monitoring
 * - Preserves handler return type for type safety
 *
 * **Why Use This:**
 * - Consistent error handling across all tools
 * - Automatic request tracing in logs
 * - Performance metrics without boilerplate
 * - Type-safe handler signatures
 *
 * @param logger - Logger instance for error reporting
 * @returns Factory function for creating wrapped handlers
 *
 * @example
 * ```typescript
 * const createToolHandler = createToolHandlerFactory(logger);
 *
 * // Create a handler with automatic error handling
 * const handler = createToolHandler(
 *   async (input: { url: string }) => {
 *     await page.goto(input.url);
 *     return successResponse('Navigated', { url: input.url });
 *   },
 *   'Navigation failed'
 * );
 *
 * // Errors are automatically caught, logged, and returned with hints
 * // No need for try-catch in each handler!
 * ```
 */
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

// ============================================
// Utility Functions
// ============================================

/**
 * Create a text content item for tool responses.
 * Eliminates repeated `{ type: 'text' as const, text: ... }` pattern.
 *
 * @example
 * ```typescript
 * return { content: [textContent('Browser launched')], structuredContent: result };
 * ```
 */
export function textContent(text: string): TextContent {
  return { type: 'text', text };
}

/**
 * Check if a response is an error response.
 */
export function isErrorResponse(
  response: ToolResponse | ErrorResponse
): response is ErrorResponse {
  return response.isError === true;
}

/**
 * Create a response builder with preset metadata.
 */
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

// ============================================
// Shared Zod Schemas
// ============================================

/**
 * Base page input schema - sessionId and pageId required for most page operations.
 * @example { ...basePageInput, selector: z.string() }
 */
export const basePageInput = {
  sessionId: z.string().describe('Browser session ID'),
  pageId: z.string().describe('Page ID'),
} as const;

/**
 * Timeout option schema - configurable timeout with sensible default.
 * @example { ...basePageInput, ...timeoutOption }
 */
export const timeoutOption = {
  timeout: z.number().default(5000).describe('Timeout in milliseconds'),
} as const;

/**
 * Extended timeout option for navigation/loading operations.
 */
export const longTimeoutOption = {
  timeout: z.number().default(30000).describe('Timeout in milliseconds'),
} as const;

/**
 * Force click option - bypass actionability checks.
 */
export const forceOption = {
  force: z
    .boolean()
    .default(false)
    .describe('Force action even if element is not actionable'),
} as const;

/**
 * Exact match option for text/label matching.
 */
export const exactMatchOption = {
  exact: z.boolean().default(false).describe('Whether match should be exact'),
} as const;

/**
 * Selector input schema - CSS selector with session/page context.
 */
export const selectorInput = {
  ...basePageInput,
  selector: z.string().describe('CSS selector for the element'),
} as const;

/**
 * Base locator input - session, page, and timeout for locator operations.
 */
export const baseLocatorInput = {
  ...basePageInput,
  ...timeoutOption,
} as const;

/**
 * Combined selector with timeout - common pattern for element operations.
 */
export const selectorWithTimeout = {
  ...selectorInput,
  ...timeoutOption,
} as const;
