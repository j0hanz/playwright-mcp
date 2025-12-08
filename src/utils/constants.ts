/**
 * Commonly used constants across the application.
 */

// Time Constants (milliseconds)
export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;

// Size Constants (bytes)
export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = 1024 * BYTES_PER_KB;

// Default Limits
export const DEFAULT_MAX_LOG_FILES = 10;
export const DEFAULT_MAX_LOG_FILE_SIZE = 10 * BYTES_PER_MB;
export const DEFAULT_MAX_ERROR_LOG_FILE_SIZE = 5 * BYTES_PER_MB;
export const MAX_LOG_FILE_SIZE_CAP = 100 * BYTES_PER_MB;
export const MAX_LOG_FILES_CAP = 50;

// Rate Limiting
export const DEFAULT_MAX_TRACKED_REQUESTS = 100;

// Session Cache
export const SESSION_CACHE_TTL_MS = 1000;

// Console Capture
export const DEFAULT_CONSOLE_MESSAGE_LIMIT = 20;
export const DEFAULT_CONSOLE_TYPES = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'trace',
] as const;
export const DEFAULT_CONSOLE_MAX_MESSAGES = 100;

// Pagination Constants
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// UUID Regex for validation
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
