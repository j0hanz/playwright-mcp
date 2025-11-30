/**
 * Logging Module
 *
 * Centralized logging for the MCP Playwright Server.
 * Features:
 * - Structured logging with context and request IDs
 * - Performance timing utilities
 * - File rotation with configurable limits
 * - JSON format support for log aggregation
 * - MCP-safe (no console output in MCP mode)
 *
 * @example
 * ```typescript
 * const logger = new Logger('BrowserManager');
 *
 * // Basic logging
 * logger.info('Browser launched', { sessionId: '123' });
 *
 * // Performance timing
 * const timer = logger.startTimer('pageLoad');
 * await page.goto(url);
 * timer.done({ url }); // Logs duration automatically
 *
 * // Child loggers with context
 * const childLogger = logger.child('Navigation');
 * childLogger.info('Navigating...'); // [BrowserManager:Navigation]
 * ```
 */

import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import winston from 'winston';

// ============================================
// Constants
// ============================================

/**
 * Size constants for log file limits.
 * Avoid importing config to prevent circular dependency.
 */
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * BYTES_PER_KB;

const DEFAULT_MAX_ERROR_LOG_FILE_SIZE = 5 * BYTES_PER_MB;
const DEFAULT_MAX_LOG_FILE_SIZE = 10 * BYTES_PER_MB;
const DEFAULT_MAX_LOG_FILES = 10;

// Parse environment variables with bounds checking
const parseLogSize = (
  value: string | undefined,
  defaultValue: number
): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) return defaultValue;
  // Cap at 100MB to prevent excessive disk usage
  return Math.min(parsed, 100 * BYTES_PER_MB);
};

const parseMaxFiles = (
  value: string | undefined,
  defaultValue: number
): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) return defaultValue;
  // Cap at 50 files
  return Math.min(parsed, 50);
};

const maxErrorLogFileSize = parseLogSize(
  process.env.MAX_ERROR_LOG_FILE_SIZE,
  DEFAULT_MAX_ERROR_LOG_FILE_SIZE
);
const maxLogFileSize = parseLogSize(
  process.env.MAX_LOG_FILE_SIZE,
  DEFAULT_MAX_LOG_FILE_SIZE
);
const maxLogFiles = parseMaxFiles(
  process.env.MAX_LOG_FILES,
  DEFAULT_MAX_LOG_FILES
);

// ============================================
// Types
// ============================================

/** Available log levels ordered by severity */
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/** Metadata that can be attached to log entries */
type LogMeta = Record<string, unknown>;

/** Timer result returned by startTimer */
interface TimerResult {
  /** Complete the timer and log the duration */
  done: (meta?: LogMeta) => number;
  /** Get elapsed time without logging */
  elapsed: () => number;
  /** Cancel the timer without logging */
  cancel: () => void;
}

/** Performance metrics for an operation */
interface PerformanceMetrics {
  operation: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

// ============================================
// Log Directory Setup
// ============================================

/**
 * Ensure log directory exists.
 * Sync at startup only - required before winston init.
 */
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

// ============================================
// Winston Formats
// ============================================

/**
 * Human-readable format for development.
 * Format: TIMESTAMP LEVEL [Context][req:RequestId] Message {meta}
 */
const humanFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    ({ timestamp, level, message, context, requestId, sessionId, ...meta }) => {
      const parts: string[] = [];

      // Timestamp and level
      const ts =
        typeof timestamp === 'string' ? timestamp : new Date().toISOString();
      const lvl =
        typeof level === 'string' ? level.toUpperCase().padEnd(5) : 'INFO ';
      parts.push(`${ts} ${lvl}`);

      // Context (module/component name)
      if (typeof context === 'string' && context) {
        parts.push(`[${context}]`);
      }

      // Request ID for tracing
      if (typeof requestId === 'string' && requestId) {
        parts.push(`[req:${requestId}]`);
      }

      // Session ID for browser sessions
      if (typeof sessionId === 'string' && sessionId) {
        parts.push(`[sess:${sessionId.slice(0, 8)}]`);
      }

      // Message
      const msg =
        typeof message === 'string' ? message : JSON.stringify(message);
      parts.push(msg);

      // Remaining metadata
      const metaKeys = Object.keys(meta);
      if (metaKeys.length > 0) {
        // Filter out internal winston fields
        const cleanMeta: Record<string, unknown> = {};
        for (const key of metaKeys) {
          if (!key.startsWith('Symbol(')) {
            cleanMeta[key] = meta[key];
          }
        }
        if (Object.keys(cleanMeta).length > 0) {
          parts.push(JSON.stringify(cleanMeta));
        }
      }

      return parts.join(' ');
    }
  )
);

/**
 * JSON format for structured logging.
 * Useful for log aggregation systems (ELK, Datadog, etc.)
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ============================================
// Environment Detection
// ============================================

/**
 * Determine logging behavior based on environment.
 * MCP uses stdio, so console logging would corrupt the transport.
 */
const isProduction = process.env.NODE_ENV === 'production';
const isMcpMode = process.env.MCP_MODE === 'true' || !process.stdin.isTTY;
const useJsonLogs = process.env.LOG_FORMAT === 'json';

// ============================================
// Winston Transports
// ============================================

/**
 * Create winston transports based on environment.
 */
function createTransports(): winston.transport[] {
  const format = useJsonLogs ? jsonFormat : humanFormat;

  const transports: winston.transport[] = [
    // Error log (errors only)
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: maxErrorLogFileSize,
      maxFiles: maxLogFiles,
      format,
    }),
    // Combined log (all levels)
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: maxLogFileSize,
      maxFiles: maxLogFiles,
      format,
    }),
  ];

  // Console transport only in development with TTY
  // In MCP mode, console output interferes with stdio transport
  if (!isProduction && !isMcpMode) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), humanFormat),
      })
    );
  }

  return transports;
}

// ============================================
// Winston Instance (Singleton)
// ============================================

const winstonInstance = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: humanFormat,
  transports: createTransports(),
});

// ============================================
// Logger Class
// ============================================

/**
 * Logger class with context, request tracking, and performance timing.
 *
 * @example
 * ```typescript
 * // Create a logger for a component
 * const logger = new Logger('SessionManager');
 *
 * // Log with metadata
 * logger.info('Session created', { sessionId, browserType });
 *
 * // Track request across operations
 * const reqLogger = logger.withRequestId('req-123');
 * reqLogger.info('Processing request');
 *
 * // Time an operation
 * const timer = logger.startTimer('browserLaunch');
 * await browser.launch();
 * timer.done({ browserType: 'chromium' }); // Logs: browserLaunch completed in 1234ms
 * ```
 */
export class Logger {
  private readonly context: string;
  private readonly defaultRequestId?: string;
  private readonly defaultSessionId?: string;

  constructor(context: string, requestId?: string, sessionId?: string) {
    this.context = context;
    this.defaultRequestId = requestId;
    this.defaultSessionId = sessionId;
  }

  // ----------------------------------------
  // Core Logging Methods
  // ----------------------------------------

  private log(
    level: LogLevel,
    message: string,
    meta?: LogMeta,
    requestId?: string
  ): void {
    winstonInstance.log(level, message, {
      context: this.context,
      requestId: requestId ?? this.defaultRequestId,
      sessionId: this.defaultSessionId,
      ...meta,
    });
  }

  info(message: string, meta?: LogMeta, requestId?: string): void {
    this.log('info', message, meta, requestId);
  }

  warn(message: string, meta?: LogMeta, requestId?: string): void {
    this.log('warn', message, meta, requestId);
  }

  error(message: string, meta?: LogMeta, requestId?: string): void {
    this.log('error', message, meta, requestId);
  }

  debug(message: string, meta?: LogMeta, requestId?: string): void {
    this.log('debug', message, meta, requestId);
  }

  // ----------------------------------------
  // Performance Timing
  // ----------------------------------------

  /**
   * Start a timer for measuring operation duration.
   *
   * @param operation - Name of the operation being timed
   * @returns Timer object with done(), elapsed(), and cancel() methods
   *
   * @example
   * ```typescript
   * const timer = logger.startTimer('pageNavigation');
   * await page.goto(url);
   * const durationMs = timer.done({ url });
   * // Logs: pageNavigation completed in 1234ms {"url":"https://..."}
   * ```
   */
  startTimer(operation: string): TimerResult {
    const startTime = performance.now();
    let completed = false;

    return {
      done: (meta?: LogMeta): number => {
        if (completed) {
          this.warn(`Timer '${operation}' already completed`);
          return 0;
        }
        completed = true;
        const durationMs = Math.round(performance.now() - startTime);
        this.info(`${operation} completed in ${durationMs}ms`, {
          operation,
          durationMs,
          ...meta,
        });
        return durationMs;
      },
      elapsed: (): number => {
        return Math.round(performance.now() - startTime);
      },
      cancel: (): void => {
        completed = true;
      },
    };
  }

  /**
   * Log performance metrics for a completed operation.
   *
   * @example
   * ```typescript
   * logger.logPerformance({
   *   operation: 'screenshot',
   *   durationMs: 234,
   *   success: true,
   * });
   * ```
   */
  logPerformance(metrics: PerformanceMetrics): void {
    const level = metrics.success ? 'info' : 'warn';
    const status = metrics.success ? 'succeeded' : 'failed';
    const message = `${metrics.operation} ${status} in ${metrics.durationMs}ms`;

    this.log(level, message, {
      type: 'performance',
      ...metrics,
    });
  }

  /**
   * Execute and time an async operation.
   *
   * @example
   * ```typescript
   * const result = await logger.timeAsync('fetchData', async () => {
   *   return await api.getData();
   * });
   * ```
   */
  async timeAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    meta?: LogMeta
  ): Promise<T> {
    const timer = this.startTimer(operation);
    try {
      const result = await fn();
      timer.done({ success: true, ...meta });
      return result;
    } catch (error) {
      const durationMs = timer.elapsed();
      timer.cancel();
      this.error(`${operation} failed after ${durationMs}ms`, {
        operation,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
        ...meta,
      });
      throw error;
    }
  }

  // ----------------------------------------
  // Context Management
  // ----------------------------------------

  /**
   * Create a child logger with additional context.
   *
   * @example
   * ```typescript
   * const parentLogger = new Logger('BrowserManager');
   * const navLogger = parentLogger.child('Navigation');
   * navLogger.info('Navigating...'); // [BrowserManager:Navigation] Navigating...
   * ```
   */
  child(childContext: string, requestId?: string): Logger {
    return new Logger(
      `${this.context}:${childContext}`,
      requestId ?? this.defaultRequestId,
      this.defaultSessionId
    );
  }

  /**
   * Create a logger with a specific request ID for tracing.
   */
  withRequestId(requestId: string): Logger {
    return new Logger(this.context, requestId, this.defaultSessionId);
  }

  /**
   * Create a logger with a specific session ID.
   */
  withSessionId(sessionId: string): Logger {
    return new Logger(this.context, this.defaultRequestId, sessionId);
  }

  /**
   * Create a logger with both request and session IDs.
   */
  withContext(requestId?: string, sessionId?: string): Logger {
    return new Logger(
      this.context,
      requestId ?? this.defaultRequestId,
      sessionId ?? this.defaultSessionId
    );
  }

  // ----------------------------------------
  // Structured Logging Helpers
  // ----------------------------------------

  /**
   * Log a tool invocation (for MCP tool handlers).
   */
  logToolInvocation(toolName: string, input: unknown): void {
    this.info(`Tool invoked: ${toolName}`, {
      type: 'tool_invocation',
      tool: toolName,
      inputKeys: input && typeof input === 'object' ? Object.keys(input) : [],
    });
  }

  /**
   * Log a tool result (for MCP tool handlers).
   */
  logToolResult(toolName: string, success: boolean, durationMs: number): void {
    const level = success ? 'info' : 'warn';
    this.log(level, `Tool completed: ${toolName}`, {
      type: 'tool_result',
      tool: toolName,
      success,
      durationMs,
    });
  }

  /**
   * Log a browser action (click, fill, navigate, etc.).
   */
  logBrowserAction(action: string, details: Record<string, unknown>): void {
    this.debug(`Browser action: ${action}`, {
      type: 'browser_action',
      action,
      ...details,
    });
  }

  /**
   * Log an assertion result.
   */
  logAssertion(
    assertionType: string,
    passed: boolean,
    details?: Record<string, unknown>
  ): void {
    const level = passed ? 'debug' : 'warn';
    const status = passed ? 'passed' : 'failed';
    this.log(level, `Assertion ${status}: ${assertionType}`, {
      type: 'assertion',
      assertionType,
      passed,
      ...details,
    });
  }
}

// ============================================
// Default Export
// ============================================

export default Logger;
