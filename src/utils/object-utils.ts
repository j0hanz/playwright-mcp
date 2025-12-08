/**
 * Object utility functions for common operations.
 */

/**
 * Filter out undefined values from an object.
 * Useful for cleaning up option objects before passing to APIs.
 *
 * @example
 * ```typescript
 * const options = { a: 1, b: undefined, c: 'hello' };
 * const filtered = filterDefined(options);
 * // Result: { a: 1, c: 'hello' }
 * ```
 *
 * @param obj - Object to filter
 * @returns New object with only defined values
 */
export function filterDefined<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as Partial<T>;
}
