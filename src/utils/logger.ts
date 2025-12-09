/**
 * Logging Module - Centralized logging for MCP Playwright Server
 */

import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import winston from 'winston';

import type {
  LogLevel,
  LogMeta,
  PerformanceMetrics,
  TimerResult,
} from '../config/types.js';
import {
  DEFAULT_MAX_ERROR_LOG_FILE_SIZE,
  DEFAULT_MAX_LOG_FILE_SIZE,
  DEFAULT_MAX_LOG_FILES,
  MAX_LOG_FILE_SIZE_CAP,
  MAX_LOG_FILES_CAP,
} from './constants.js';

// Re-export types for backward compatibility
export type { LogLevel, LogMeta, PerformanceMetrics, TimerResult };

const parseLogSize = (
  value: string | undefined,
  defaultValue: number
): number => {
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) return defaultValue;

  return Math.min(parsed, MAX_LOG_FILE_SIZE_CAP);
};

const parseMaxFiles = (
  value: string | undefined,
  defaultValue: number
): number => {
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) return defaultValue;

  return Math.min(parsed, MAX_LOG_FILES_CAP);
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

// Log Directory Setup

const LOG_DIR = path.join(process.cwd(), 'logs');
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

// Winston Formats

const humanFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    ({ timestamp, level, message, context, requestId, sessionId, ...meta }) => {
      const parts: string[] = [];

      const ts =
        typeof timestamp === 'string' ? timestamp : new Date().toISOString();
      const lvl =
        typeof level === 'string' ? level.toUpperCase().padEnd(5) : 'INFO ';
      parts.push(`${ts} ${lvl}`);

      if (typeof context === 'string' && context) {
        parts.push(`[${context}]`);
      }

      if (typeof requestId === 'string' && requestId) {
        parts.push(`[req:${requestId}]`);
      }

      if (typeof sessionId === 'string' && sessionId) {
        parts.push(`[sess:${sessionId.slice(0, 8)}]`);
      }

      const msg =
        typeof message === 'string' ? message : JSON.stringify(message);
      parts.push(msg);

      const metaKeys = Object.keys(meta);
      if (metaKeys.length > 0) {
        // Optimize: Fast path for common case (no symbols)
        const hasSymbols = metaKeys.some((key) => key.startsWith('Symbol('));

        if (hasSymbols) {
          const cleanMeta: Record<string, unknown> = {};
          for (const key of metaKeys) {
            if (!key.startsWith('Symbol(')) {
              cleanMeta[key] = meta[key];
            }
          }
          if (Object.keys(cleanMeta).length > 0) {
            parts.push(JSON.stringify(cleanMeta));
          }
        } else {
          // No symbols, serialize directly
          parts.push(JSON.stringify(meta));
        }
      }

      return parts.join(' ');
    }
  )
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Environment Detection

const isProduction = process.env.NODE_ENV === 'production';
const isMcpMode = process.env.MCP_MODE === 'true' || !process.stdin.isTTY;
const useJsonLogs = process.env.LOG_FORMAT === 'json';

// Winston Transports

function createTransports(): winston.transport[] {
  const format = useJsonLogs ? jsonFormat : humanFormat;

  const transports: winston.transport[] = [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: maxErrorLogFileSize,
      maxFiles: maxLogFiles,
      format,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: maxLogFileSize,
      maxFiles: maxLogFiles,
      format,
    }),
  ];

  if (!isProduction && !isMcpMode) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), humanFormat),
      })
    );
  }

  return transports;
}

// Winston Instance

const winstonInstance = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: humanFormat,
  transports: createTransports(),
});

// Logger Class

export class Logger {
  private readonly context: string;
  private readonly defaultRequestId?: string;
  private readonly defaultSessionId?: string;

  constructor(context: string, requestId?: string, sessionId?: string) {
    this.context = context;
    this.defaultRequestId = requestId;
    this.defaultSessionId = sessionId;
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: LogMeta,
    requestId?: string
  ): void {
    // Optimize: Build log metadata conditionally to avoid unnecessary allocations
    const logMeta: Record<string, unknown> = { context: this.context };

    const effectiveRequestId = requestId ?? this.defaultRequestId;
    if (effectiveRequestId) logMeta.requestId = effectiveRequestId;

    if (this.defaultSessionId) logMeta.sessionId = this.defaultSessionId;

    if (meta) Object.assign(logMeta, meta);

    winstonInstance.log(level, message, logMeta);
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

  logPerformance(metrics: PerformanceMetrics): void {
    const level = metrics.success ? 'info' : 'warn';
    const status = metrics.success ? 'succeeded' : 'failed';
    const message = `${metrics.operation} ${status} in ${metrics.durationMs}ms`;

    this.log(level, message, {
      type: 'performance',
      ...metrics,
    });
  }

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

  child(childContext: string, requestId?: string): Logger {
    return new Logger(
      `${this.context}:${childContext}`,
      requestId ?? this.defaultRequestId,
      this.defaultSessionId
    );
  }

  withRequestId(requestId: string): Logger {
    return new Logger(this.context, requestId, this.defaultSessionId);
  }

  withSessionId(sessionId: string): Logger {
    return new Logger(this.context, this.defaultRequestId, sessionId);
  }

  withContext(requestId?: string, sessionId?: string): Logger {
    return new Logger(
      this.context,
      requestId ?? this.defaultRequestId,
      sessionId ?? this.defaultSessionId
    );
  }

  logToolInvocation(toolName: string, input: unknown): void {
    this.info(`Tool invoked: ${toolName}`, {
      type: 'tool_invocation',
      tool: toolName,
      inputKeys: input && typeof input === 'object' ? Object.keys(input) : [],
    });
  }

  logToolResult(toolName: string, success: boolean, durationMs: number): void {
    const level = success ? 'info' : 'warn';
    this.log(level, `Tool completed: ${toolName}`, {
      type: 'tool_result',
      tool: toolName,
      success,
      durationMs,
    });
  }

  logBrowserAction(action: string, details: Record<string, unknown>): void {
    this.debug(`Browser action: ${action}`, {
      type: 'browser_action',
      action,
      ...details,
    });
  }

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
