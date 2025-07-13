/**
 * Error type definitions for type-safe error handling
 */

/**
 * Base error interface with additional properties
 */
export interface BaseError extends Error {
	code?: string;
	statusCode?: number;
	details?: unknown;
}

/**
 * Database error with specific code
 */
export interface DatabaseError extends BaseError {
	code: string;
	query?: string;
	params?: unknown[];
}

/**
 * HTTP/API error with status code
 */
export interface ApiError extends BaseError {
	statusCode: number;
	endpoint?: string;
	method?: string;
}

/**
 * WebSocket error
 */
export interface WebSocketError extends BaseError {
	code: string;
	closeCode?: number;
	reason?: string;
}

/**
 * Validation error
 */
export interface ValidationError extends BaseError {
	field?: string;
	value?: unknown;
	constraints?: string[];
}

/**
 * Type guard for database errors
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
	return (
		error instanceof Error &&
		'code' in error &&
		typeof (error as Error & { code: unknown }).code === 'string'
	);
}

/**
 * Type guard for API errors
 */
export function isApiError(error: unknown): error is ApiError {
	return (
		error instanceof Error &&
		'statusCode' in error &&
		typeof (error as Error & { statusCode: unknown }).statusCode === 'number'
	);
}

/**
 * Type guard for WebSocket errors
 */
export function isWebSocketError(error: unknown): error is WebSocketError {
	return (
		error instanceof Error &&
		'code' in error &&
		typeof (error as Error & { code: unknown }).code === 'string'
	);
}

/**
 * Type guard for validation errors
 */
export function isValidationError(error: unknown): error is ValidationError {
	return error instanceof Error && error.name === 'ValidationError';
}

/**
 * Create a typed database error
 */
export function createDatabaseError(
	message: string,
	code: string,
	query?: string,
	params?: unknown[]
): DatabaseError {
	const error = new Error(message) as DatabaseError;
	error.name = 'DatabaseError';
	error.code = code;
	if (query) error.query = query;
	if (params) error.params = params;
	return error;
}

/**
 * Create a typed API error
 */
export function createApiError(
	message: string,
	statusCode: number,
	endpoint?: string,
	method?: string
): ApiError {
	const error = new Error(message) as ApiError;
	error.name = 'ApiError';
	error.statusCode = statusCode;
	if (endpoint) error.endpoint = endpoint;
	if (method) error.method = method;
	return error;
}

/**
 * Create a typed WebSocket error
 */
export function createWebSocketError(
	message: string,
	code: string,
	closeCode?: number,
	reason?: string
): WebSocketError {
	const error = new Error(message) as WebSocketError;
	error.name = 'WebSocketError';
	error.code = code;
	if (closeCode !== undefined) error.closeCode = closeCode;
	if (reason) error.reason = reason;
	return error;
}

/**
 * Create a typed validation error
 */
export function createValidationError(
	message: string,
	field?: string,
	value?: unknown,
	constraints?: string[]
): ValidationError {
	const error = new Error(message) as ValidationError;
	error.name = 'ValidationError';
	if (field) error.field = field;
	if (value !== undefined) error.value = value;
	if (constraints) error.constraints = constraints;
	return error;
}

/**
 * Safe error property access
 */
export function getErrorProperty<T>(error: unknown, property: string, defaultValue: T): T {
	if (error instanceof Error && property in error) {
		return (error as unknown as Record<string, unknown>)[property] as T;
	}
	return defaultValue;
}

/**
 * Convert unknown errors to Error objects
 */
export function toError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	if (typeof error === 'string') {
		return new Error(error);
	}

	if (typeof error === 'object' && error !== null && 'message' in error) {
		return new Error(String((error as { message: unknown }).message));
	}

	return new Error(String(error));
}
