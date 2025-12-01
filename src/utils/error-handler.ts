/**
 * Error Handling Module - Centralized error handling for MCP Playwright Server
 *
 * @see https://playwright.dev/docs/api/class-errors
 */

// Error Codes

export const ErrorCode = {
  // Browser Lifecycle
  BROWSER_LAUNCH_FAILED: 'BROWSER_LAUNCH_FAILED',
  BROWSER_CLOSED: 'BROWSER_CLOSED',

  // Navigation
  PAGE_NAVIGATION_FAILED: 'PAGE_NAVIGATION_FAILED',
  PAGE_CRASHED: 'PAGE_CRASHED',

  // Element Errors
  ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
  ELEMENT_NOT_VISIBLE: 'ELEMENT_NOT_VISIBLE',
  ELEMENT_NOT_ENABLED: 'ELEMENT_NOT_ENABLED',
  ELEMENT_DETACHED: 'ELEMENT_DETACHED',

  // Timeout Errors
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED',
  NAVIGATION_TIMEOUT: 'NAVIGATION_TIMEOUT',

  // Session Errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',

  // Validation Errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_SELECTOR: 'INVALID_SELECTOR',
  INVALID_URL: 'INVALID_URL',

  // Assertion Errors
  ASSERTION_FAILED: 'ASSERTION_FAILED',

  // Screenshot Errors
  SCREENSHOT_FAILED: 'SCREENSHOT_FAILED',

  // Network Errors
  NETWORK_ERROR: 'NETWORK_ERROR',

  // Dialog Errors
  DIALOG_ERROR: 'DIALOG_ERROR',

  // Internal Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',

  // Capacity Errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',

  // Security Errors
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// Retryable Errors Configuration

const RETRYABLE_CODES = new Set<ErrorCode>([
  ErrorCode.TIMEOUT_EXCEEDED,
  ErrorCode.NAVIGATION_TIMEOUT,
  ErrorCode.PAGE_NAVIGATION_FAILED,
  ErrorCode.ELEMENT_NOT_FOUND,
  ErrorCode.ELEMENT_NOT_VISIBLE,
  ErrorCode.NETWORK_ERROR,
]);

export function isRetryableError(code: ErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

// Error Brand Symbol

const MCP_PLAYWRIGHT_ERROR_BRAND = Symbol.for('MCPPlaywrightError');

// MCPPlaywrightError Class

export class MCPPlaywrightError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly retryable: boolean;
  readonly timestamp: string;
  readonly [MCP_PLAYWRIGHT_ERROR_BRAND] = true;

  constructor(
    code: ErrorCode,
    message: string,
    details?: unknown,
    retryable?: boolean
  ) {
    super(message);
    this.name = 'MCPPlaywrightError';
    this.code = code;
    this.details = details;
    this.retryable = retryable ?? RETRYABLE_CODES.has(code);
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, MCPPlaywrightError);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      timestamp: this.timestamp,
    };
  }

  toUserMessage(): string {
    const retryHint = this.retryable ? ' (retryable)' : '';
    return `[${this.code}] ${this.message}${retryHint}`;
  }
}

// Type Guards

export function isMCPPlaywrightError(
  error: unknown
): error is MCPPlaywrightError {
  if (error instanceof MCPPlaywrightError) {
    return true;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    MCP_PLAYWRIGHT_ERROR_BRAND in error
  ) {
    return true;
  }
  return false;
}

export function isPlaywrightTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' ||
      error.message.includes('Timeout') ||
      error.message.includes('exceeded'))
  );
}

// Error Pattern Mapping - Grouped by category for maintainability

const STRING_ERROR_PATTERNS = new Map<string, ErrorCode>([
  // Timeout errors
  ['TimeoutError', ErrorCode.TIMEOUT_EXCEEDED],
  ['Timeout', ErrorCode.TIMEOUT_EXCEEDED],
  // Navigation errors
  ['Navigation failed', ErrorCode.PAGE_NAVIGATION_FAILED],
  ['net::ERR_', ErrorCode.PAGE_NAVIGATION_FAILED],
  ['ERR_NAME_NOT_RESOLVED', ErrorCode.PAGE_NAVIGATION_FAILED],
  ['ERR_CONNECTION_REFUSED', ErrorCode.NETWORK_ERROR],
  ['ERR_INTERNET_DISCONNECTED', ErrorCode.NETWORK_ERROR],
  // Element errors
  ['waiting for selector', ErrorCode.ELEMENT_NOT_FOUND],
  ['waiting for locator', ErrorCode.ELEMENT_NOT_FOUND],
  ['Element not found', ErrorCode.ELEMENT_NOT_FOUND],
  ['no element matches', ErrorCode.ELEMENT_NOT_FOUND],
  ['strict mode violation', ErrorCode.ELEMENT_NOT_FOUND],
  ['resolved to', ErrorCode.ELEMENT_NOT_FOUND],
  ['element is not visible', ErrorCode.ELEMENT_NOT_VISIBLE],
  ['element is not enabled', ErrorCode.ELEMENT_NOT_ENABLED],
  ['Element is detached', ErrorCode.ELEMENT_DETACHED],
  // Session errors
  ['Session not found', ErrorCode.SESSION_NOT_FOUND],
  ['Page not found', ErrorCode.PAGE_NOT_FOUND],
  ['Browser closed', ErrorCode.BROWSER_CLOSED],
  ['Target closed', ErrorCode.SESSION_NOT_FOUND],
  ['Context destroyed', ErrorCode.SESSION_NOT_FOUND],
  ['Frame detached', ErrorCode.ELEMENT_DETACHED],
  ['Page crashed', ErrorCode.PAGE_CRASHED],
  // Execution context errors
  ['Execution context was destroyed', ErrorCode.PAGE_NAVIGATION_FAILED],
  ['Protocol error', ErrorCode.INTERNAL_ERROR],
  // Browser launch errors
  ['browserType.launch', ErrorCode.BROWSER_LAUNCH_FAILED],
  ['Failed to launch', ErrorCode.BROWSER_LAUNCH_FAILED],
  ['executable doesn', ErrorCode.BROWSER_LAUNCH_FAILED],
  // Selector errors
  ['Selector resolved to', ErrorCode.INVALID_SELECTOR],
  ['Unknown engine', ErrorCode.INVALID_SELECTOR],
  // Screenshot errors
  ['screenshot', ErrorCode.SCREENSHOT_FAILED],
]);

const REGEX_ERROR_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  code: ErrorCode;
}> = [{ pattern: /exceeded\s+\d+ms/i, code: ErrorCode.TIMEOUT_EXCEEDED }];

function mapErrorToCode(error: Error): ErrorCode {
  const errorString = `${error.name} ${error.message}`;

  // Check string patterns first (O(n) but very fast for small strings)
  for (const [pattern, code] of STRING_ERROR_PATTERNS) {
    if (errorString.includes(pattern)) {
      return code;
    }
  }

  // Check regex patterns
  for (const { pattern, code } of REGEX_ERROR_PATTERNS) {
    if (pattern.test(errorString)) {
      return code;
    }
  }

  return ErrorCode.INTERNAL_ERROR;
}

// Error Conversion Utility

export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const err = new Error(String((error as { message: unknown }).message));
    if ('stack' in error) {
      err.stack = String((error as { stack: unknown }).stack);
    }
    return err;
  }
  return new Error(String(error));
}

// UUID Validation Utility

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_V4_REGEX.test(id);
}

export function validateUUID(id: string, fieldName: string): void {
  if (!isValidUUID(id)) {
    throw new MCPPlaywrightError(
      ErrorCode.VALIDATION_FAILED,
      `Invalid ${fieldName} format: must be a valid UUID`,
      { field: fieldName, value: id }
    );
  }
}

// Error Handler Factory

export const ErrorHandler = {
  handlePlaywrightError(error: unknown): MCPPlaywrightError {
    const err = toError(error);
    const errorCode = mapErrorToCode(err);

    return new MCPPlaywrightError(errorCode, err.message, {
      originalError: err.name,
      stack: err.stack,
    });
  },

  createError(
    code: ErrorCode,
    message: string,
    details?: unknown
  ): MCPPlaywrightError {
    return new MCPPlaywrightError(code, message, details);
  },

  validationError(field: string, issue: string): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.VALIDATION_FAILED,
      `Invalid ${field}: ${issue}`,
      { field, issue }
    );
  },

  sessionNotFound(sessionId: string): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.SESSION_NOT_FOUND,
      `Session not found: ${sessionId}`,
      { sessionId }
    );
  },

  pageNotFound(pageId: string): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.PAGE_NOT_FOUND,
      `Page not found: ${pageId}`,
      { pageId }
    );
  },

  elementNotFound(selector: string, context?: string): MCPPlaywrightError {
    const message = context
      ? `Element not found: ${selector} (${context})`
      : `Element not found: ${selector}`;
    return new MCPPlaywrightError(ErrorCode.ELEMENT_NOT_FOUND, message, {
      selector,
      context,
    });
  },

  timeout(operation: string, timeoutMs: number): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.TIMEOUT_EXCEEDED,
      `${operation} timed out after ${timeoutMs}ms`,
      { operation, timeoutMs }
    );
  },

  securityViolation(reason: string): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.SECURITY_VIOLATION,
      `Security violation: ${reason}`,
      { reason },
      false
    );
  },

  capacityExceeded(current: number, max: number): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.CAPACITY_EXCEEDED,
      `Maximum capacity (${max}) reached. Current: ${current}`,
      { current, max },
      false
    );
  },

  rateLimitExceeded(
    maxRequests: number,
    windowSeconds: number
  ): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded: Maximum ${maxRequests} requests per ${windowSeconds} seconds`,
      { maxRequests, windowSeconds },
      true
    );
  },
} as const;

export default ErrorHandler;
