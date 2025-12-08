// Tool Handler Types and Utilities - Shared types and helpers for MCP tool handlers
// @see https://modelcontextprotocol.io/docs for MCP SDK documentation

import { v4 as uuidv4 } from 'uuid';

import type {
  ErrorResponse,
  PaginatedResponse,
  PaginationMeta,
  PaginationParams,
  TextContent,
  ToolResponse,
} from '../../config/types.js';
import {
  getRetryHint,
  isMCPPlaywrightError,
  toError,
} from '../../utils/error-handler.js';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../utils/constants.js';
import { Logger } from '../../utils/logger.js';

// Re-export common schemas from centralized location
export {
  basePageInput,
  baseLocatorInput,
  selectorInput,
  selectorWithTimeout,
  timeoutOption,
  longTimeoutOption,
  forceOption,
  exactMatchOption,
} from './schemas.js';

// Re-export getRetryHint for backward compatibility
export { getRetryHint } from '../../utils/error-handler.js';

// Request ID Generation

export type RequestIdGenerator = () => string;

let requestIdGenerator: RequestIdGenerator = () => uuidv4().slice(0, 8);

export function generateRequestId(): string {
  return requestIdGenerator();
}

/**
 * Set a custom request ID generator (primarily for testing).
 * @param generator - Custom generator function
 */
export function setRequestIdGenerator(generator: RequestIdGenerator): void {
  requestIdGenerator = generator;
}

/**
 * Reset request ID generator to default UUID-based implementation.
 */
export function resetRequestIdGenerator(): void {
  requestIdGenerator = () => uuidv4().slice(0, 8);
}

// Pagination Utilities

function normalizePageParams(params: PaginationParams): {
  page: number;
  pageSize: number;
} {
  return {
    page: Math.max(DEFAULT_PAGE, params.page ?? DEFAULT_PAGE),
    pageSize: Math.min(
      MAX_PAGE_SIZE,
      Math.max(DEFAULT_PAGE, params.pageSize ?? DEFAULT_PAGE_SIZE)
    ),
  };
}

export function createPaginationMeta(
  params: PaginationParams,
  totalItems: number
): PaginationMeta {
  const { page, pageSize } = normalizePageParams(params);
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > DEFAULT_PAGE,
  };
}

export function paginate<T>(
  items: T[],
  params: PaginationParams
): PaginatedResponse<T> {
  const { page, pageSize } = normalizePageParams(params);
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
    const hint = getRetryHint(err.code);
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
