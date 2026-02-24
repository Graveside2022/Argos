/**
 * Higher-order retry utility for async operations.
 *
 * Wraps an async function with configurable retry logic including
 * linear or exponential backoff and conditional retry predicates.
 *
 * @module
 */

import { normalizeError } from '$lib/server/api/error-utils';

/** Configuration for retry behavior */
export interface RetryOptions {
	/** Maximum number of attempts (including first try). Default: 3 */
	attempts?: number;
	/** Base delay between retries in ms. Default: 1000 */
	delayMs?: number;
	/** Backoff strategy. Default: 'exponential' */
	backoff?: 'linear' | 'exponential';
	/** Optional predicate — only retry if this returns true for the error. Default: always retry */
	shouldRetry?: (error: Error) => boolean;
}

/** Resolved retry configuration with all defaults applied */
interface ResolvedRetryConfig {
	attempts: number;
	delayMs: number;
	backoff: 'linear' | 'exponential';
	shouldRetry: (error: Error) => boolean;
}

const DEFAULTS: ResolvedRetryConfig = {
	attempts: 3,
	delayMs: 1000,
	backoff: 'exponential',
	shouldRetry: () => true
};

/** Merge user options with defaults */
function resolveConfig(options?: RetryOptions): ResolvedRetryConfig {
	return { ...DEFAULTS, ...options };
}

/**
 * Compute the delay for a given attempt index based on backoff strategy.
 *
 * @param attempt - Zero-based attempt index (0 = first retry)
 * @param delayMs - Base delay in milliseconds
 * @param backoff - Backoff strategy ('linear' or 'exponential')
 * @returns Delay in milliseconds before the next attempt
 */
function computeDelay(attempt: number, delayMs: number, backoff: 'linear' | 'exponential'): number {
	if (backoff === 'linear') return delayMs;
	return delayMs * Math.pow(2, attempt);
}

/** Create a promise that resolves after the given milliseconds */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Determine whether a failed attempt should be retried */
function canRetry(attempt: number, config: ResolvedRetryConfig, error: Error): boolean {
	const hasAttemptsLeft = attempt < config.attempts - 1;
	return hasAttemptsLeft && config.shouldRetry(error);
}

/** Wait for the appropriate backoff delay between retries */
function waitBeforeRetry(attempt: number, config: ResolvedRetryConfig): Promise<void> {
	return sleep(computeDelay(attempt, config.delayMs, config.backoff));
}

/**
 * Execute a single attempt and return result or normalized error.
 *
 * @returns `[result, null]` on success, `[null, error]` on failure
 */
async function tryOnce<T>(fn: () => Promise<T>): Promise<[T, null] | [null, Error]> {
	try {
		return [await fn(), null];
	} catch (err) {
		return [null, normalizeError(err)];
	}
}

/**
 * Wrap an async function with retry logic.
 *
 * The first attempt executes immediately. On failure, subsequent attempts
 * are delayed according to the backoff strategy. If `shouldRetry` returns
 * false for a given error, the error is thrown immediately.
 *
 * @param fn - A thunk returning a Promise to retry on failure
 * @param options - Retry configuration
 * @returns A new thunk with the same return type, enhanced with retry logic
 *
 * @example
 * ```ts
 * const fetchWithRetry = withRetry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { attempts: 3, delayMs: 500, backoff: 'exponential' }
 * );
 * const data = await fetchWithRetry();
 * ```
 */
export function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): () => Promise<T> {
	const config = resolveConfig(options);
	return () => executeWithRetry(fn, config);
}

/** Run the retry loop using resolved configuration */
async function executeWithRetry<T>(fn: () => Promise<T>, config: ResolvedRetryConfig): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt < config.attempts; attempt++) {
		const [result, error] = await tryOnce(fn);
		if (!error) return result;

		lastError = error;
		if (!canRetry(attempt, config, error)) break;
		await waitBeforeRetry(attempt, config);
	}

	throw lastError;
}
