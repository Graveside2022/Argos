/**
 * Contract: Route Handler Factory API
 *
 * This contract defines the public interface for the route handler factory.
 * Implementation lives at: src/lib/server/api/create-handler.ts
 *
 * NOTE: This is a TYPE-ONLY contract file for planning purposes.
 * It is NOT executable code — it will be deleted after implementation.
 */

import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import type { z } from 'zod';

// --- Types ---

/** Business logic function that receives a RequestEvent and returns data */
export type HandlerFn<T = unknown> = (event: RequestEvent) => Promise<T> | T;

/** Configuration options for createHandler */
export interface HandlerOptions {
	/** Logging context string (defaults to event.url.pathname) */
	method?: string;

	/** Optional Zod schema to validate the request body against */
	validateBody?: z.ZodType;

	/** Custom error HTTP status code (default: 500) */
	errorStatus?: number;
}

// --- Factory Function ---

/**
 * Creates a SvelteKit RequestHandler that wraps business logic with:
 * - Automatic try-catch
 * - Error message extraction via errMsg()
 * - Structured logging via logger
 * - JSON response wrapping
 * - Optional Zod body validation
 *
 * @param fn - Business logic function that returns data (not Response)
 * @param options - Optional configuration
 * @returns SvelteKit RequestHandler
 */
export declare function createHandler<T = unknown>(
	fn: HandlerFn<T>,
	options?: HandlerOptions
): RequestHandler;

// --- Error Utilities ---

/**
 * Extract error message from unknown error values.
 * Handles: Error instances, strings, objects with message property, other.
 */
export declare function errMsg(err: unknown): string;

// --- Result Type ---

/** Success: [data, null]. Failure: [null, Error] */
export type Result<T> = [T, null] | [null, Error];

/**
 * Wraps a promise, returning a Result tuple instead of throwing.
 * Normalizes non-Error thrown values to Error instances.
 */
export declare function safe<T>(promise: Promise<T>): Promise<Result<T>>;

// --- Async Exec Utility ---

/**
 * Shared promisified execFile wrapper.
 * Uses Node.js child_process.execFile (NOT exec) for safety.
 * Replaces 36 local promisify(execFile) declarations.
 */
export declare function execFileAsync(
	file: string,
	args?: readonly string[],
	options?: {
		maxBuffer?: number;
		timeout?: number;
		cwd?: string;
		env?: NodeJS.ProcessEnv;
	}
): Promise<{ stdout: string; stderr: string }>;

// --- Higher-Order Wrappers ---

export interface RetryOptions {
	maxAttempts?: number;
	delayMs?: number;
	backoff?: 'linear' | 'exponential';
}

export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;

export interface TimeoutOptions {
	ms: number;
	message?: string;
}

export declare function withTimeout<T>(fn: () => Promise<T>, options: TimeoutOptions): Promise<T>;
