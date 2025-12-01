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
