/**
 * Shared Constants Module - Single source of truth for time and size constants
 *
 * This module eliminates duplication of magic numbers across the codebase.
 * Import these constants instead of defining them locally.
 */

// Time Constants (milliseconds)
export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

// Time Constants (seconds) - for formatUptime and similar functions
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
export const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

// Size Constants (bytes)
export const BYTES_PER_KB = 1024;
export const BYTES_PER_MB = 1024 * BYTES_PER_KB;
export const BYTES_PER_GB = 1024 * BYTES_PER_MB;

// Default Limits
export const DEFAULT_MAX_LOG_FILES = 10;
export const DEFAULT_MAX_LOG_FILE_SIZE = 10 * BYTES_PER_MB;
export const DEFAULT_MAX_ERROR_LOG_FILE_SIZE = 5 * BYTES_PER_MB;
export const MAX_LOG_FILE_SIZE_CAP = 100 * BYTES_PER_MB;
export const MAX_LOG_FILES_CAP = 50;

// Rate Limiting
export const DEFAULT_MAX_TRACKED_REQUESTS = 100;

// Pagination Constants
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Default Timeouts (milliseconds) - fallbacks when config is not available
// Note: For runtime use, prefer importing from server-config.ts
export const DEFAULT_TIMEOUT_ACTION = 20 * MS_PER_SECOND;
export const DEFAULT_TIMEOUT_NAVIGATION = 30 * MS_PER_SECOND;
export const DEFAULT_TIMEOUT_ASSERTION = 5 * MS_PER_SECOND;
export const DEFAULT_TIMEOUT_DOWNLOAD = 60 * MS_PER_SECOND;

// Retry Configuration
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY = 500; // ms
export const MAX_RETRY_ATTEMPTS = 5;
export const MIN_RETRY_DELAY = 100; // ms
export const MAX_RETRY_DELAY = 5000; // ms

// Session Limits
export const DEFAULT_MAX_CONCURRENT_SESSIONS = 5;
export const MIN_CONCURRENT_SESSIONS = 1;
export const MAX_CONCURRENT_SESSIONS = 20;
export const DEFAULT_SESSION_TIMEOUT = 30 * MS_PER_MINUTE;

// Viewport Limits
export const MIN_VIEWPORT_WIDTH = 320;
export const MAX_VIEWPORT_WIDTH = 3840;
export const MIN_VIEWPORT_HEIGHT = 240;
export const MAX_VIEWPORT_HEIGHT = 2160;
export const DEFAULT_VIEWPORT_WIDTH = 1366;
export const DEFAULT_VIEWPORT_HEIGHT = 900;

// UUID Regex for validation
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
