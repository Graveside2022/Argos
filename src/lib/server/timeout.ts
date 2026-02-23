/**
 * Higher-order timeout utility for async operations.
 *
 * Wraps an async function with a timeout guard. If the wrapped function
 * does not resolve within the specified duration, a {@link TimeoutError}
 * is thrown. The original promise continues to run (cannot be cancelled).
 *
 * @module
 */

/** Configuration for timeout behavior */
export interface TimeoutOptions {
	/** Timeout in milliseconds */
	timeoutMs: number;
	/** Custom error message. Default: 'Operation timed out after {timeoutMs}ms' */
	message?: string;
}

/**
 * Error class for timeout failures.
 *
 * Includes the configured timeout duration for diagnostic purposes.
 */
export class TimeoutError extends Error {
	/** The timeout duration that was exceeded, in milliseconds */
	public readonly timeoutMs: number;

	constructor(message: string, timeoutMs: number) {
		super(message);
		this.name = 'TimeoutError';
		this.timeoutMs = timeoutMs;
	}
}

/**
 * Wrap an async function with a timeout guard.
 *
 * If `fn` resolves before the timeout, its result is returned normally.
 * If `fn` takes longer than `timeoutMs`, the returned promise rejects
 * with a {@link TimeoutError}. The timer is cleaned up in both cases.
 *
 * Note: the underlying promise from `fn` continues to run -- JavaScript
 * does not support promise cancellation. We simply stop waiting for it.
 *
 * @param fn - A thunk returning a Promise to guard with a timeout
 * @param options - Timeout configuration
 * @returns A new thunk with the same return type, enhanced with timeout
 *
 * @example
 * ```ts
 * const fetchWithTimeout = withTimeout(
 *   () => fetch('/api/slow-endpoint'),
 *   { timeoutMs: 5000, message: 'API request timed out' }
 * );
 * const response = await fetchWithTimeout();
 * ```
 */
export function withTimeout<T>(fn: () => Promise<T>, options: TimeoutOptions): () => Promise<T> {
	const { timeoutMs, message } = options;
	const errorMessage = message ?? `Operation timed out after ${timeoutMs}ms`;

	return async (): Promise<T> => {
		return raceWithTimeout(fn, timeoutMs, errorMessage);
	};
}

/** Sentinel value used to detect timeout in Promise.race */
const TIMEOUT_SENTINEL = Symbol('timeout');

/**
 * Race the async function against a timeout timer.
 *
 * Uses `Promise.race` with a resolving (not rejecting) sentinel to avoid
 * unhandled promise rejection issues with fake timers in test environments.
 *
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout duration in milliseconds
 * @param errorMessage - Error message for TimeoutError
 * @returns The resolved value from fn
 * @throws {TimeoutError} If the timeout elapses before fn resolves
 */
async function raceWithTimeout<T>(
	fn: () => Promise<T>,
	timeoutMs: number,
	errorMessage: string
): Promise<T> {
	let timerId: ReturnType<typeof setTimeout> | undefined;

	const timeoutPromise = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
		timerId = setTimeout(() => {
			resolve(TIMEOUT_SENTINEL);
		}, timeoutMs);
	});

	try {
		const result = await Promise.race([fn(), timeoutPromise]);

		if (result === TIMEOUT_SENTINEL) {
			throw new TimeoutError(errorMessage, timeoutMs);
		}

		return result;
	} finally {
		if (timerId !== undefined) {
			clearTimeout(timerId);
		}
	}
}
