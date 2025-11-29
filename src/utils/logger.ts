import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import winston from 'winston';

import { config } from '../config/server-config.js';

// Log level type
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Ensure log directory exists (sync at startup only - required before winston init)
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    ({ timestamp, level, message, context, requestId, ...meta }) => {
      const contextStr =
        typeof context === 'string' && context ? `[${context}]` : '';
      const requestIdStr =
        typeof requestId === 'string' && requestId ? `[req:${requestId}]` : '';
      const metaStr = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : '';
      const ts =
        typeof timestamp === 'string' ? timestamp : new Date().toISOString();
      const lvl = typeof level === 'string' ? level.toUpperCase() : 'INFO';
      const msg =
        typeof message === 'string' ? message : JSON.stringify(message);
      return `${ts} ${lvl} ${contextStr}${requestIdStr} ${msg}${metaStr}`;
    }
  )
);

// JSON format for structured logging (useful for log aggregation systems)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Determine if we should use console logging
// MCP uses stdio, so console logging can corrupt the transport
const isProduction = process.env.NODE_ENV === 'production';
const isMcpMode = process.env.MCP_MODE === 'true' || !process.stdin.isTTY;
const useJsonLogs = process.env.LOG_FORMAT === 'json';

// Create shared transports (singleton pattern)
function createTransports(): winston.transport[] {
  const format = useJsonLogs ? jsonFormat : logFormat;

  const transports: winston.transport[] = [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: config.limits.maxErrorLogFileSize,
      maxFiles: config.limits.maxLogFiles,
      format,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: config.limits.maxLogFileSize,
      maxFiles: config.limits.maxLogFiles,
      format,
    }),
  ];

  // Only add console transport in development mode with TTY
  // In MCP mode, console output interferes with stdio transport
  if (!isProduction && !isMcpMode) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), logFormat),
      })
    );
  }

  return transports;
}

// Singleton winston instance
const winstonInstance = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: createTransports(),
});

export class Logger {
  private context: string;
  private defaultRequestId?: string;

  constructor(context: string, requestId?: string) {
    this.context = context;
    this.defaultRequestId = requestId;
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
    requestId?: string
  ): void {
    winstonInstance.log(level, message, {
      context: this.context,
      requestId: requestId ?? this.defaultRequestId,
      ...meta,
    });
  }

  info(
    message: string,
    meta?: Record<string, unknown>,
    requestId?: string
  ): void {
    this.log('info', message, meta, requestId);
  }

  warn(
    message: string,
    meta?: Record<string, unknown>,
    requestId?: string
  ): void {
    this.log('warn', message, meta, requestId);
  }

  error(
    message: string,
    meta?: Record<string, unknown>,
    requestId?: string
  ): void {
    this.log('error', message, meta, requestId);
  }

  debug(
    message: string,
    meta?: Record<string, unknown>,
    requestId?: string
  ): void {
    this.log('debug', message, meta, requestId);
  }

  child(childContext: string, requestId?: string): Logger {
    return new Logger(
      `${this.context}:${childContext}`,
      requestId ?? this.defaultRequestId
    );
  }

  withRequestId(requestId: string): Logger {
    return new Logger(this.context, requestId);
  }
}

export default Logger;
