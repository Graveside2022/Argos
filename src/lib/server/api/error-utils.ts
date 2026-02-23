/**
 * Shared error message extraction utility.
 *
 * Replaces 19 identical local `errMsg()` definitions across the codebase.
 * Handles Error instances, strings, objects with a message property, and
 * unknown thrown values — returning a human-readable string in all cases.
 *
 * @module
 */

/**
 * Extract a human-readable message from an unknown error value.
 *
 * @param err - The caught error value (may be Error, string, object, or anything)
 * @returns A string describing the error
 *
 * @example
 * ```ts
 * try { await riskyOp(); }
 * catch (err) { logger.error(errMsg(err)); }
 * ```
 */
export function errMsg(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === 'string') return err;
	if (hasStringMessage(err)) return err.message;
	return String(err);
}

/** Type guard for objects with a string `message` property */
function hasStringMessage(val: unknown): val is { message: string } {
	return (
		typeof val === 'object' &&
		val !== null &&
		'message' in val &&
		typeof (val as { message: unknown }).message === 'string'
	);
}
