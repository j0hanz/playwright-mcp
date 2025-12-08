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

// Retry Hints - Actionable guidance for each error code
// Provides users with context-specific recovery suggestions

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
  [ErrorCode.CAPACITY_EXCEEDED]:
    'Maximum session capacity reached. Close unused sessions with browser_close before launching new ones.',
  [ErrorCode.SECURITY_VIOLATION]:
    'Security policy violation. This operation is not permitted for security reasons.',
  [ErrorCode.DIALOG_ERROR]:
    'Dialog handling failed. Ensure there is a pending dialog before calling handle_dialog. Dialogs auto-dismiss after timeout.',
};

/**
 * Get actionable retry hint for an error code
 * @param code The error code to get a hint for
 * @returns Recovery guidance string, or undefined if no hint exists
 */
export function getRetryHint(code: ErrorCode): string | undefined {
  return RETRY_HINTS[code];
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

// Error Pattern Mapping - Grouped by category for maintainability

const STRING_ERROR_PATTERNS: ReadonlyArray<{
  pattern: string;
  code: ErrorCode;
}> = [
  // Timeout errors
  { pattern: 'TimeoutError', code: ErrorCode.TIMEOUT_EXCEEDED },
  { pattern: 'Timeout', code: ErrorCode.TIMEOUT_EXCEEDED },
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

const REGEX_ERROR_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  code: ErrorCode;
}> = [{ pattern: /exceeded\s+\d+ms/i, code: ErrorCode.TIMEOUT_EXCEEDED }];

function mapErrorToCode(error: Error): ErrorCode {
  const errorString = `${error.name} ${error.message}`;

  // Check string patterns (linear scan but patterns are short)
  for (const { pattern, code } of STRING_ERROR_PATTERNS) {
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

import { UUID_V4_REGEX } from './constants.js';

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
