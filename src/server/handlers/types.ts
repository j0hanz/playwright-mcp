/**
 * Tool Handler Types and Utilities
 *
 * Shared types and helper functions for MCP tool handlers.
 * Following MCP SDK best practices for consistent tool responses.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { BrowserManager } from '../../playwright/browser-manager.js';
import { toError } from '../../utils/error-handler.js';
import { Logger } from '../../utils/logger.js';

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
}

/**
 * Create a standardized error response
 */
export function toolErrorResponse(
  prefix: string,
  error: unknown
): ErrorResponse {
  const err = toError(error);
  return {
    content: [{ type: 'text' as const, text: `${prefix}: ${err.message}` }],
    isError: true,
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
      try {
        return await handler(input);
      } catch (error) {
        logger.error(errorMessage, { error: toError(error).message });
        return toolErrorResponse(errorMessage, error);
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
