/**
 * Result tuple utility for error handling without try-catch boilerplate.
 *
 * Returns `[data, null]` on success or `[null, Error]` on failure.
 * Non-Error thrown values are normalized to Error instances.
 *
 * @module
 */

import { normalizeError } from '$lib/server/api/error-utils';

/** A result tuple: success `[T, null]` or failure `[null, Error]` */
export type Result<T> = [T, null] | [null, Error];

/**
 * Wrap an async operation, returning a Result tuple instead of throwing.
 *
 * @param fn - A thunk (zero-argument function) that returns a Promise
 * @returns A Promise resolving to `[data, null]` or `[null, Error]`
 *
 * @example
 * ```ts
 * const [data, err] = await safe(() => fetchData());
 * if (err) { logger.error(err.message); return; }
 * // data is non-null here
 * ```
 */
export async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
	try {
		const data = await fn();
		return [data, null];
	} catch (err) {
		return [null, normalizeError(err)];
	}
}

/**
 * Synchronous version of {@link safe}.
 *
 * @param fn - A thunk that returns a value synchronously
 * @returns `[data, null]` or `[null, Error]`
 */
export function safeSync<T>(fn: () => T): Result<T> {
	try {
		const data = fn();
		return [data, null];
	} catch (err) {
		return [null, normalizeError(err)];
	}
}
