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

  // Internal Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

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

// Error Pattern Mapping

const ERROR_PATTERNS: ReadonlyArray<{
  pattern: string | RegExp;
  code: ErrorCode;
}> = [
  // Timeout errors
  { pattern: 'TimeoutError', code: ErrorCode.TIMEOUT_EXCEEDED },
  { pattern: 'Timeout', code: ErrorCode.TIMEOUT_EXCEEDED },
  { pattern: /exceeded\s+\d+ms/i, code: ErrorCode.TIMEOUT_EXCEEDED },

  // Navigation errors
  { pattern: 'Navigation failed', code: ErrorCode.PAGE_NAVIGATION_FAILED },
  { pattern: 'net::ERR_', code: ErrorCode.PAGE_NAVIGATION_FAILED },
  { pattern: 'ERR_NAME_NOT_RESOLVED', code: ErrorCode.PAGE_NAVIGATION_FAILED },
  { pattern: 'ERR_CONNECTION_REFUSED', code: ErrorCode.NETWORK_ERROR },
  { pattern: 'ERR_INTERNET_DISCONNECTED', code: ErrorCode.NETWORK_ERROR },

  // Element errors
  { pattern: 'waiting for selector', code: ErrorCode.ELEMENT_NOT_FOUND },
  { pattern: 'waiting for locator', code: ErrorCode.ELEMENT_NOT_FOUND },
  { pattern: 'Element not found', code: ErrorCode.ELEMENT_NOT_FOUND },
  { pattern: 'no element matches', code: ErrorCode.ELEMENT_NOT_FOUND },
  { pattern: 'strict mode violation', code: ErrorCode.ELEMENT_NOT_FOUND },
  { pattern: 'resolved to', code: ErrorCode.ELEMENT_NOT_FOUND },
  { pattern: 'element is not visible', code: ErrorCode.ELEMENT_NOT_VISIBLE },
  { pattern: 'element is not enabled', code: ErrorCode.ELEMENT_NOT_ENABLED },
  { pattern: 'Element is detached', code: ErrorCode.ELEMENT_DETACHED },

  // Session errors
  { pattern: 'Session not found', code: ErrorCode.SESSION_NOT_FOUND },
  { pattern: 'Page not found', code: ErrorCode.PAGE_NOT_FOUND },
  { pattern: 'Browser closed', code: ErrorCode.BROWSER_CLOSED },
  { pattern: 'Target closed', code: ErrorCode.SESSION_NOT_FOUND },
  { pattern: 'Context destroyed', code: ErrorCode.SESSION_NOT_FOUND },
  { pattern: 'Frame detached', code: ErrorCode.ELEMENT_DETACHED },
  { pattern: 'Page crashed', code: ErrorCode.PAGE_CRASHED },

  // Execution context errors
  {
    pattern: 'Execution context was destroyed',
    code: ErrorCode.PAGE_NAVIGATION_FAILED,
  },
  { pattern: 'Protocol error', code: ErrorCode.INTERNAL_ERROR },

  // Browser launch errors
  { pattern: 'browserType.launch', code: ErrorCode.BROWSER_LAUNCH_FAILED },
  { pattern: 'Failed to launch', code: ErrorCode.BROWSER_LAUNCH_FAILED },
  { pattern: 'executable doesn', code: ErrorCode.BROWSER_LAUNCH_FAILED },

  // Selector errors
  { pattern: 'Selector resolved to', code: ErrorCode.INVALID_SELECTOR },
  { pattern: 'Unknown engine', code: ErrorCode.INVALID_SELECTOR },

  // Screenshot errors
  { pattern: 'screenshot', code: ErrorCode.SCREENSHOT_FAILED },
];

function mapErrorToCode(error: Error): ErrorCode {
  const errorString = `${error.name} ${error.message}`;

  for (const { pattern, code } of ERROR_PATTERNS) {
    if (typeof pattern === 'string') {
      if (errorString.includes(pattern)) {
        return code;
      }
    } else if (pattern.test(errorString)) {
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
} as const;

export default ErrorHandler;
