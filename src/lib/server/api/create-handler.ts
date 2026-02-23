/**
 * Route handler factory for SvelteKit API endpoints.
 *
 * Wraps business logic functions with:
 * - Automatic try-catch
 * - Error message extraction via {@link errMsg}
 * - Structured logging via the project logger
 * - JSON response wrapping (plain objects become `json()` responses)
 * - Optional Zod request body validation
 *
 * Handlers that return a `Response` directly are passed through untouched,
 * allowing streaming, custom status codes, or non-JSON responses.
 *
 * @module
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';

import { logger } from '$lib/utils/logger';

import { errMsg } from './error-utils';

/** The return type of a business logic function — any object or a Response */
export type HandlerResult = Record<string, unknown> | object | Response;

/** A business logic function that receives a RequestEvent and returns data or a Response */
export type HandlerFn = (event: RequestEvent) => Promise<HandlerResult> | HandlerResult;

/** Configuration options for {@link createHandler} */
export interface HandlerOptions {
	/** Logging context string (defaults to `event.url.pathname`) */
	method?: string;
	/** Zod schema to validate the parsed request body against (POST/PUT/PATCH) */
	validateBody?: z.ZodType;
	/** HTTP status code for unexpected errors (default: 500) */
	errorStatus?: number;
}

/**
 * Create a SvelteKit `RequestHandler` that wraps business logic with
 * standardized error handling, logging, and JSON response formatting.
 *
 * @param fn - Business logic receiving `RequestEvent`, returning data or Response
 * @param options - Optional configuration for logging, validation, error status
 * @returns A function compatible with SvelteKit's `RequestHandler` type
 *
 * @example
 * ```ts
 * // Simple GET — return plain data, factory wraps in json()
 * export const GET = createHandler(async ({ url }) => {
 *   const db = getRFDatabase();
 *   return { signals: db.findSignals() };
 * });
 * ```
 *
 * @example
 * ```ts
 * // POST with Zod validation
 * export const POST = createHandler(
 *   async ({ request }) => {
 *     const body = await request.json();
 *     return { success: true, id: db.insert(body) };
 *   },
 *   { validateBody: MySchema }
 * );
 * ```
 */
export function createHandler(fn: HandlerFn, options?: HandlerOptions) {
	return async (event: RequestEvent): Promise<Response> => {
		try {
			const validationError = await validateBody(event, options);
			if (validationError) return validationError;

			const result = await fn(event);
			return result instanceof Response ? result : json(result);
		} catch (err: unknown) {
			return buildErrorResponse(err, event, options);
		}
	};
}

/** Validate request body against Zod schema if configured; returns error Response or null */
async function validateBody(
	event: RequestEvent,
	options?: HandlerOptions
): Promise<Response | null> {
	if (!options?.validateBody) return null;
	const body = await event.request.clone().json();
	const result = options.validateBody.safeParse(body);
	if (result.success) return null;
	return json(
		{ success: false, error: 'Validation failed', details: result.error.format() },
		{ status: 400 }
	);
}

/** Log the error and return a standardized 500 (or custom status) error response */
function buildErrorResponse(err: unknown, event: RequestEvent, options?: HandlerOptions): Response {
	const context = options?.method ?? event.url.pathname;
	logger.error(`[${context}] ${errMsg(err)}`);
	return json(
		{ success: false, error: 'Internal server error' },
		{ status: options?.errorStatus ?? 500 }
	);
}
