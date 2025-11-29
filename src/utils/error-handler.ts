// Error codes as const object for better tree-shaking
export const ErrorCode = {
  BROWSER_LAUNCH_FAILED: 'BROWSER_LAUNCH_FAILED',
  PAGE_NAVIGATION_FAILED: 'PAGE_NAVIGATION_FAILED',
  ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  ASSERTION_FAILED: 'ASSERTION_FAILED',
  SCREENSHOT_FAILED: 'SCREENSHOT_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// Retryable errors set for O(1) lookup
const RETRYABLE_CODES = new Set<ErrorCode>([
  ErrorCode.TIMEOUT_EXCEEDED,
  ErrorCode.PAGE_NAVIGATION_FAILED,
  ErrorCode.ELEMENT_NOT_FOUND,
]);

// Symbol for branding MCPPlaywrightError instances
const MCP_PLAYWRIGHT_ERROR_BRAND = Symbol.for('MCPPlaywrightError');

export class MCPPlaywrightError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly retryable: boolean;
  // Brand symbol for reliable cross-module type checking
  readonly [MCP_PLAYWRIGHT_ERROR_BRAND] = true;

  constructor(
    code: ErrorCode,
    message: string,
    details?: unknown,
    retryable = false
  ) {
    super(message);
    this.name = 'MCPPlaywrightError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

// Type guard for MCPPlaywrightError
// Uses brand symbol for reliable cross-module checking (works across different module instances)
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

// Error pattern mappings - object literal for better performance
const ERROR_PATTERNS: ReadonlyArray<{ pattern: string; code: ErrorCode }> = [
  { pattern: 'TimeoutError', code: ErrorCode.TIMEOUT_EXCEEDED },
  { pattern: 'Navigation failed', code: ErrorCode.PAGE_NAVIGATION_FAILED },
  { pattern: 'waiting for selector', code: ErrorCode.ELEMENT_NOT_FOUND },
  { pattern: 'Element not found', code: ErrorCode.ELEMENT_NOT_FOUND },
  { pattern: 'Session not found', code: ErrorCode.SESSION_NOT_FOUND },
  { pattern: 'Page not found', code: ErrorCode.PAGE_NOT_FOUND },
  { pattern: 'Browser closed', code: ErrorCode.BROWSER_LAUNCH_FAILED },
  { pattern: 'Target closed', code: ErrorCode.SESSION_NOT_FOUND },
  { pattern: 'Context destroyed', code: ErrorCode.SESSION_NOT_FOUND },
  { pattern: 'Frame detached', code: ErrorCode.PAGE_NOT_FOUND },
  {
    pattern: 'Execution context was destroyed',
    code: ErrorCode.INTERNAL_ERROR,
  },
  { pattern: 'net::ERR_', code: ErrorCode.PAGE_NAVIGATION_FAILED },
  { pattern: 'Protocol error', code: ErrorCode.INTERNAL_ERROR },
  { pattern: 'browserType.launch', code: ErrorCode.BROWSER_LAUNCH_FAILED },
];

function mapErrorToCode(error: Error): ErrorCode {
  const errorString = `${error.name} ${error.message}`;

  for (const { pattern, code } of ERROR_PATTERNS) {
    if (errorString.includes(pattern)) {
      return code;
    }
  }

  return ErrorCode.INTERNAL_ERROR;
}

// Type-safe error conversion utility
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new Error(String((error as { message: unknown }).message));
  }
  return new Error(String(error));
}

export const ErrorHandler = {
  handlePlaywrightError(error: Error): MCPPlaywrightError {
    const errorCode = mapErrorToCode(error);
    const retryable = RETRYABLE_CODES.has(errorCode);

    return new MCPPlaywrightError(
      errorCode,
      error.message,
      { originalError: error.name, stack: error.stack },
      retryable
    );
  },

  createError(
    code: ErrorCode,
    message: string,
    details?: unknown
  ): MCPPlaywrightError {
    const retryable = RETRYABLE_CODES.has(code);
    return new MCPPlaywrightError(code, message, details, retryable);
  },
} as const;

export default ErrorHandler;
