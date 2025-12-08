/**
 * Retry Utility - Shared retry logic with exponential backoff support
 */

export interface RetryOptions {
  /** Number of retry attempts (0 means no retries) */
  retries: number;
  /** Base delay between retries in milliseconds */
  retryDelay: number;
  /** Use exponential backoff (delay doubles each retry) */
  exponential?: boolean;
  /** Maximum delay cap in milliseconds (for exponential backoff) */
  maxDelay?: number;
}

export interface RetryResult<T> {
  /** The result of the successful operation */
  result: T;
  /** Number of retries that were needed (0 = succeeded on first try) */
  retriesUsed: number;
}

/**
 * Execute a function with retry support and optional exponential backoff.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result with retry count
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const { result, retriesUsed } = await withRetry(
 *   () => fetchData(),
 *   { retries: 3, retryDelay: 1000, exponential: true }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<RetryResult<T>> {
  const {
    retries,
    retryDelay,
    exponential = false,
    maxDelay = 30_000,
  } = options;

  let lastError: Error = new Error('Operation failed');
  let currentDelay = retryDelay;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      return { result, retriesUsed: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        await sleep(currentDelay);

        if (exponential) {
          currentDelay = Math.min(currentDelay * 2, maxDelay);
        }
      }
    }
  }

  throw lastError;
}

/**
 * Sleep for the specified duration.
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format retry information for user-facing messages.
 * @param retriesUsed - Number of retries that were used
 * @returns Formatted string like "(after 2 retries)" or empty string if no retries
 */
export function formatRetryInfo(retriesUsed: number): string {
  if (retriesUsed === 0) return '';
  return ` (after ${retriesUsed} ${retriesUsed === 1 ? 'retry' : 'retries'})`;
}
