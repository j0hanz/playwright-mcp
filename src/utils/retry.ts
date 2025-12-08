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
  /** Optional predicate to determine if an error should trigger a retry */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface RetryResult<T> {
  /** The result of the successful operation */
  result: T;
  /** Number of retries that were needed (0 = succeeded on first try) */
  retriesUsed: number;
}

/**
 * Common retry predicates for determining if an error should be retried.
 */
export const RETRY_PREDICATES = {
  /** Always retry (default behavior) */
  always: () => true,
  /** Never retry */
  never: () => false,
  /** Retry only on timeout errors */
  onTimeout: (error: Error) => error.name === 'TimeoutError',
  /** Retry on network errors */
  onNetwork: (error: Error) =>
    error.message.includes('net::') ||
    error.message.includes('ERR_CONNECTION') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT'),
  /** Retry on transient errors (timeout or network) */
  onTransient: (error: Error) =>
    RETRY_PREDICATES.onTimeout(error) || RETRY_PREDICATES.onNetwork(error),
} as const;

/**
 * Execute a function with retry support and optional exponential backoff.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result with retry count
 * @throws The last error if all retries are exhausted or if shouldRetry returns false
 *
 * @example
 * ```typescript
 * // Basic retry
 * const { result, retriesUsed } = await withRetry(
 *   () => fetchData(),
 *   { retries: 3, retryDelay: 1000, exponential: true }
 * );
 *
 * // Conditional retry (only on network errors)
 * const { result } = await withRetry(
 *   () => apiCall(),
 *   { retries: 3, retryDelay: 500, shouldRetry: RETRY_PREDICATES.onNetwork }
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
    shouldRetry = RETRY_PREDICATES.always,
  } = options;

  let lastError: Error = new Error('Operation failed');
  let currentDelay = retryDelay;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      return { result, retriesUsed: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (attempt < retries && shouldRetry(lastError, attempt)) {
        await sleep(currentDelay);

        if (exponential) {
          currentDelay = Math.min(currentDelay * 2, maxDelay);
        }
      } else if (attempt < retries) {
        // Not retryable or out of attempts
        throw lastError;
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
