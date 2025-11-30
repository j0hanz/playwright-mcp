/**
 * Tool Handler Types and Utilities
 *
 * Shared types and helper functions for MCP tool handlers.
 * Following MCP SDK best practices for consistent tool responses.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { v4 as uuidv4 } from 'uuid';

import type { BrowserManager } from '../../playwright/browser-manager.js';
import {
  ErrorCode,
  isMCPPlaywrightError,
  toError,
} from '../../utils/error-handler.js';
import { Logger } from '../../utils/logger.js';

/**
 * Generate a unique request ID for tracing tool invocations
 */
export function generateRequestId(): string {
  return uuidv4().slice(0, 8);
}

/**
 * Error retry hints based on error type
 */
const RETRY_HINTS: Record<ErrorCode, string> = {
  [ErrorCode.BROWSER_LAUNCH_FAILED]:
    'Try running `npm run install:browsers` or check system resources',
  [ErrorCode.SESSION_NOT_FOUND]:
    'Session may have expired. Launch a new browser session',
  [ErrorCode.PAGE_NOT_FOUND]:
    'Page may have been closed. Check browser_tabs or create a new page',
  [ErrorCode.PAGE_NAVIGATION_FAILED]:
    'Navigation failed. Check URL validity and network connectivity',
  [ErrorCode.ELEMENT_NOT_FOUND]:
    'Element not found. Verify selector or wait for element to appear',
  [ErrorCode.TIMEOUT_EXCEEDED]:
    'Operation timed out. Increase timeout or check element visibility',
  [ErrorCode.VALIDATION_FAILED]: 'Check input parameters for valid values',
  [ErrorCode.ASSERTION_FAILED]:
    'Assertion failed. Verify expected vs actual state',
  [ErrorCode.SCREENSHOT_FAILED]:
    'Screenshot failed. Check page visibility and permissions',
  [ErrorCode.TOOL_NOT_FOUND]: 'Tool not found. Check available tools list',
  [ErrorCode.INTERNAL_ERROR]: 'Internal error occurred. Check logs for details',
};

/**
 * Tool response with content array
 */
export interface ToolResponse<T = unknown> {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
  >;
  structuredContent?: T;
  isError?: boolean;
}

/**
 * Error response type - includes index signature for MCP SDK compatibility
 */
export interface ErrorResponse {
  [key: string]: unknown;
  content: [{ type: 'text'; text: string }];
  isError: true;
  requestId?: string;
}

/**
 * Create a standardized error response with optional retry hints
 *
 * @param prefix - Error message prefix describing the operation
 * @param error - The error that occurred
 * @param requestId - Optional request ID for tracing
 * @returns Formatted error response with helpful retry hints
 */
export function toolErrorResponse(
  prefix: string,
  error: unknown,
  requestId?: string
): ErrorResponse {
  const err = toError(error);

  // Get retry hint based on error code
  let retryHint = '';
  if (isMCPPlaywrightError(err)) {
    const hint = RETRY_HINTS[err.code];
    if (hint) {
      retryHint = ` [Hint: ${hint}]`;
    }
  }

  const requestIdStr = requestId ? ` [req:${requestId}]` : '';

  return {
    content: [
      {
        type: 'text' as const,
        text: `${prefix}: ${err.message}${retryHint}${requestIdStr}`,
      },
    ],
    isError: true,
    requestId,
  };
}

/**
 * Context passed to tool registration functions
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
 * Tool registration function signature
 */
export type ToolRegistrationFn = (ctx: ToolContext) => void;

/**
 * Higher-order function that wraps tool handlers with consistent error handling.
 * Eliminates repetitive try-catch-toolErrorResponse pattern (DRY principle).
 *
 * Features:
 * - Automatic request ID generation for tracing
 * - Structured error logging with request context
 * - Retry hints based on error type
 * - Execution timing for performance monitoring
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
      const startTime = Date.now();

      try {
        const result = await handler(input);
        const duration = Date.now() - startTime;

        logger.debug('Tool handler completed', {
          requestId,
          durationMs: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const err = toError(error);

        logger.error(errorMessage, {
          requestId,
          error: err.message,
          durationMs: duration,
          stack: err.stack,
        });

        return toolErrorResponse(errorMessage, error, requestId);
      }
    };
  };
}

/**
 * Create success response with text content
 */
export function successResponse<T>(message: string, data: T): ToolResponse<T> {
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: data,
  };
}

/**
 * Create success response with image content
 */
export function imageResponse<T>(
  message: string,
  base64Data: string,
  mimeType: 'image/png' | 'image/jpeg',
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
