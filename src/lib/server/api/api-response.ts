/**
 * Unified API response types per spec FR-014.
 *
 * Every API response MUST include `success: boolean`. The `createHandler()`
 * factory injects this field automatically — routes return plain data objects
 * and the factory wraps them.
 *
 * Type-only file: no runtime code, no side effects.
 *
 * @module
 */

/** Successful API response — `success` is always `true` */
export interface ApiSuccessResponse {
	success: true;
	[key: string]: unknown;
}

/** Error API response — `success` is always `false` */
export interface ApiErrorResponse {
	success: false;
	error: string;
	/** Optional details (e.g. Zod validation issues) */
	details?: unknown;
}

/** Discriminated union of all API responses */
export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;
