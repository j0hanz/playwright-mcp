/**
 * Error Handling Module
 *
 * Centralized error handling for the MCP Playwright Server.
 *
 * **Features:**
 * - Typed error codes for consistent error categorization
 * - Cross-module error type checking with brand symbols
 * - Playwright error mapping to semantic error codes
 * - Actionable retry hints for recoverable errors
 * - JSON serialization for MCP responses
 *
 * **Error Code Categories:**
 * - `BROWSER_*` - Browser lifecycle errors (launch, crash, close)
 * - `PAGE_*` - Page/navigation errors (navigation, crash)
 * - `ELEMENT_*` - Element location and interaction errors
 * - `TIMEOUT_*` - Operation timeout errors
 * - `SESSION_*` - Session management errors
 * - `VALIDATION_*` - Input validation errors
 * - `ASSERTION_*` - Test assertion failures
 * - `SECURITY_*` - Security policy violations
 *
 * **Design Principles:**
 * - Errors should be informative and actionable
 * - Include context for debugging (selector, URL, etc.)
 * - Map Playwright errors to semantic codes
 * - Distinguish retryable from non-retryable errors
 *
 * **Usage:**
 * ```typescript
 * // Create a typed error
 * throw ErrorHandler.createError(
 *   ErrorCode.ELEMENT_NOT_FOUND,
 *   'Button "Submit" not found',
 *   { selector: '[data-testid="submit"]' }
 * );
 *
 * // Handle a Playwright error
 * try {
 *   await page.click('button');
 * } catch (error) {
 *   throw ErrorHandler.handlePlaywrightError(error);
 * }
 * ```
 *
 * @see https://playwright.dev/docs/api/class-errors
 */

// ============================================
// Error Codes
// ============================================

/**
 * Error codes as const object for better tree-shaking and type inference.
 * Use these codes to categorize errors consistently across the codebase.
 *
 * **Naming Convention:**
 * - `COMPONENT_SPECIFIC_ERROR` format
 * - Present tense for states (NOT_FOUND, NOT_VISIBLE)
 * - Past tense for events (FAILED, EXCEEDED, CLOSED)
 *
 * **Categories:**
 * - **Browser (BROWSER_*)**: Launch failures, unexpected closures
 * - **Page (PAGE_*)**: Navigation errors, page crashes
 * - **Element (ELEMENT_*)**: Locator failures, actionability issues
 * - **Timeout (TIMEOUT_*)**: Operation timeouts
 * - **Session (SESSION_*)**: Session lifecycle errors
 * - **Validation (VALIDATION_*)**: Input validation failures
 * - **Assertion (ASSERTION_*)**: Test assertion failures
 * - **Security (SECURITY_*)**: Security policy violations
 * - **Internal (INTERNAL_*)**: Unexpected internal errors
 */
export const ErrorCode = {
  // ---- Browser Lifecycle ----
  /** Browser failed to launch (missing executable, permissions, resources) */
  BROWSER_LAUNCH_FAILED: 'BROWSER_LAUNCH_FAILED',
  /** Browser was unexpectedly closed */
  BROWSER_CLOSED: 'BROWSER_CLOSED',

  // ---- Navigation ----
  /** Page navigation failed (network error, invalid URL) */
  PAGE_NAVIGATION_FAILED: 'PAGE_NAVIGATION_FAILED',
  /** Page process crashed */
  PAGE_CRASHED: 'PAGE_CRASHED',

  // ---- Element Errors ----
  /** Element not found in DOM (selector didn't match) */
  ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
  /** Element exists but is not visible (display:none, visibility:hidden) */
  ELEMENT_NOT_VISIBLE: 'ELEMENT_NOT_VISIBLE',
  /** Element is disabled and cannot be interacted with */
  ELEMENT_NOT_ENABLED: 'ELEMENT_NOT_ENABLED',
  /** Element was removed from DOM during operation */
  ELEMENT_DETACHED: 'ELEMENT_DETACHED',

  // ---- Timeout Errors ----
  /** Generic operation timeout */
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED',
  /** Page navigation timed out */
  NAVIGATION_TIMEOUT: 'NAVIGATION_TIMEOUT',

  // ---- Session Errors ----
  /** Session ID not found (never existed or already closed) */
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  /** Session expired due to inactivity */
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  /** Page ID not found within session */
  PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',

  // ---- Validation Errors ----
  /** Input validation failed */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Selector syntax is invalid */
  INVALID_SELECTOR: 'INVALID_SELECTOR',
  /** URL format or protocol is invalid */
  INVALID_URL: 'INVALID_URL',

  // ---- Assertion Errors ----
  /** Test assertion failed (expected vs actual mismatch) */
  ASSERTION_FAILED: 'ASSERTION_FAILED',

  // ---- Screenshot Errors ----
  /** Screenshot capture failed */
  SCREENSHOT_FAILED: 'SCREENSHOT_FAILED',

  // ---- Network Errors ----
  /** Network request failed (connection refused, DNS failure) */
  NETWORK_ERROR: 'NETWORK_ERROR',

  // ---- Internal Errors ----
  /** Unexpected internal error */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Requested tool not found */
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  /** Too many requests in time window */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // ---- Security Errors ----
  /** Security policy violation (blocked script, invalid path) */
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================
// Retryable Errors Configuration
// ============================================

/**
 * Set of error codes that are potentially retryable.
 * O(1) lookup for performance.
 */
const RETRYABLE_CODES = new Set<ErrorCode>([
  ErrorCode.TIMEOUT_EXCEEDED,
  ErrorCode.NAVIGATION_TIMEOUT,
  ErrorCode.PAGE_NAVIGATION_FAILED,
  ErrorCode.ELEMENT_NOT_FOUND,
  ErrorCode.ELEMENT_NOT_VISIBLE,
  ErrorCode.NETWORK_ERROR,
]);

/**
 * Check if an error code is retryable.
 */
export function isRetryableError(code: ErrorCode): boolean {
  return RETRYABLE_CODES.has(code);
}

// ============================================
// Error Brand Symbol
// ============================================

/**
 * Brand symbol for reliable cross-module type checking.
 * Using Symbol.for ensures the same symbol across module boundaries.
 */
const MCP_PLAYWRIGHT_ERROR_BRAND = Symbol.for('MCPPlaywrightError');

// ============================================
// MCPPlaywrightError Class
// ============================================

/**
 * Custom error class for MCP Playwright operations.
 *
 * **Features:**
 * - Typed error codes for programmatic handling
 * - Retryable flag for recoverable errors
 * - Additional details for debugging context
 * - JSON serialization for MCP responses
 * - Brand symbol for cross-module type checking
 * - Timestamp for error tracking
 *
 * **When to Use:**
 * - Throw when a Playwright operation fails
 * - Throw for validation errors before operations
 * - Catch and re-throw with additional context
 *
 * @example
 * ```typescript
 * // Throw with context
 * throw new MCPPlaywrightError(
 *   ErrorCode.ELEMENT_NOT_FOUND,
 *   'Button "Submit" not found on page',
 *   { selector: '[data-testid="submit"]', pageUrl: 'https://example.com' }
 * );
 *
 * // Throw non-retryable error
 * throw new MCPPlaywrightError(
 *   ErrorCode.SECURITY_VIOLATION,
 *   'Script injection blocked',
 *   { script: scriptContent },
 *   false // explicitly non-retryable
 * );
 * ```
 */
export class MCPPlaywrightError extends Error {
  /** Error category code */
  readonly code: ErrorCode;

  /** Additional context for debugging */
  readonly details?: unknown;

  /** Whether this error is potentially retryable */
  readonly retryable: boolean;

  /** Timestamp when error occurred */
  readonly timestamp: string;

  /** Brand symbol for type checking */
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

    // Maintain proper stack trace in V8 engines
    Error.captureStackTrace(this, MCPPlaywrightError);
  }

  /**
   * Serialize error for JSON responses.
   */
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

  /**
   * Create a user-friendly error message.
   */
  toUserMessage(): string {
    const retryHint = this.retryable ? ' (retryable)' : '';
    return `[${this.code}] ${this.message}${retryHint}`;
  }
}

// ============================================
// Type Guards
// ============================================

/**
 * Type guard for MCPPlaywrightError.
 * Uses brand symbol for reliable cross-module checking.
 *
 * **Why Brand Symbol?**
 * - Handles module duplication (e.g., npm link)
 * - Works across module boundaries
 * - More reliable than instanceof in some edge cases
 *
 * @param error - Unknown error to check
 * @returns true if error is MCPPlaywrightError
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   if (isMCPPlaywrightError(error)) {
 *     // TypeScript knows error is MCPPlaywrightError
 *     console.log(error.code, error.retryable);
 *     if (error.retryable) {
 *       // Retry logic
 *     }
 *   }
 * }
 * ```
 */
export function isMCPPlaywrightError(
  error: unknown
): error is MCPPlaywrightError {
  if (error instanceof MCPPlaywrightError) {
    return true;
  }
  // Fallback: Check for brand symbol (handles cross-module boundaries)
  if (
    typeof error === 'object' &&
    error !== null &&
    MCP_PLAYWRIGHT_ERROR_BRAND in error
  ) {
    return true;
  }
  return false;
}

/**
 * Type guard for Playwright's TimeoutError.
 */
export function isPlaywrightTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' ||
      error.message.includes('Timeout') ||
      error.message.includes('exceeded'))
  );
}

// ============================================
// Error Pattern Mapping
// ============================================

/**
 * Error patterns for mapping Playwright errors to semantic codes.
 * Order matters - first match wins.
 */
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

/**
 * Map an error to a semantic error code.
 */
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

// ============================================
// Error Conversion Utility
// ============================================

/**
 * Type-safe error conversion utility.
 * Converts any value to an Error instance.
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const err = toError(error);
 *   console.log(err.message, err.stack);
 * }
 * ```
 */
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

// ============================================
// Error Handler Factory
// ============================================

/**
 * Error handler with factory methods for creating and handling errors.
 *
 * **Factory Methods:**
 * - `handlePlaywrightError()` - Map Playwright errors to MCPPlaywrightError
 * - `createError()` - Create new error with code and message
 * - `validationError()` - Create validation error with field context
 * - `sessionNotFound()` - Create session not found error
 * - `pageNotFound()` - Create page not found error
 * - `elementNotFound()` - Create element not found error
 * - `timeout()` - Create timeout error with duration
 * - `securityViolation()` - Create non-retryable security error
 *
 * @example
 * ```typescript
 * // Map a Playwright error
 * try {
 *   await page.click('button');
 * } catch (error) {
 *   throw ErrorHandler.handlePlaywrightError(error);
 * }
 *
 * // Create a validation error
 * throw ErrorHandler.validationError('selector', 'must be a non-empty string');
 *
 * // Create element not found error
 * throw ErrorHandler.elementNotFound('[data-testid="submit"]', 'after waiting 5000ms');
 * ```
 */
export const ErrorHandler = {
  /**
   * Handle a Playwright error by mapping it to MCPPlaywrightError.
   */
  handlePlaywrightError(error: unknown): MCPPlaywrightError {
    const err = toError(error);
    const errorCode = mapErrorToCode(err);

    return new MCPPlaywrightError(errorCode, err.message, {
      originalError: err.name,
      stack: err.stack,
    });
  },

  /**
   * Create a new MCPPlaywrightError with the given code and message.
   */
  createError(
    code: ErrorCode,
    message: string,
    details?: unknown
  ): MCPPlaywrightError {
    return new MCPPlaywrightError(code, message, details);
  },

  /**
   * Create a validation error with helpful message.
   */
  validationError(field: string, issue: string): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.VALIDATION_FAILED,
      `Invalid ${field}: ${issue}`,
      { field, issue }
    );
  },

  /**
   * Create a session not found error.
   */
  sessionNotFound(sessionId: string): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.SESSION_NOT_FOUND,
      `Session not found: ${sessionId}`,
      { sessionId }
    );
  },

  /**
   * Create a page not found error.
   */
  pageNotFound(pageId: string): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.PAGE_NOT_FOUND,
      `Page not found: ${pageId}`,
      { pageId }
    );
  },

  /**
   * Create an element not found error.
   */
  elementNotFound(selector: string, context?: string): MCPPlaywrightError {
    const message = context
      ? `Element not found: ${selector} (${context})`
      : `Element not found: ${selector}`;
    return new MCPPlaywrightError(ErrorCode.ELEMENT_NOT_FOUND, message, {
      selector,
      context,
    });
  },

  /**
   * Create a timeout error.
   */
  timeout(operation: string, timeoutMs: number): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.TIMEOUT_EXCEEDED,
      `${operation} timed out after ${timeoutMs}ms`,
      { operation, timeoutMs }
    );
  },

  /**
   * Create a security violation error.
   */
  securityViolation(reason: string): MCPPlaywrightError {
    return new MCPPlaywrightError(
      ErrorCode.SECURITY_VIOLATION,
      `Security violation: ${reason}`,
      { reason },
      false // Never retryable
    );
  },
} as const;

export default ErrorHandler;
