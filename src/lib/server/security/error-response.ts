import { logger } from '$lib/utils/logger';

/**
 * Standard safe error response generator for Argos API endpoints.
 *
 * SECURITY: Never include error.message, error.stack, file paths,
 * database details, or process information in HTTP responses.
 * All detailed error information must be logged server-side only.
 *
 * Usage:
 *   return safeErrorResponse(500, 'Operation failed');
 *   return safeErrorResponse(400, 'Invalid parameters');
 *   return safeErrorResponse(503, 'Service unavailable');
 */
export function safeErrorResponse(status: number, publicMessage: string): Response {
	return new Response(JSON.stringify({ error: publicMessage }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

/**
 * Log error details server-side before returning safe response.
 * Combines logging and response in a single call for convenience.
 *
 * Usage:
 *   return logAndRespond('[hackrf]', error, 500, 'HackRF operation failed');
 */
export function logAndRespond(
	context: string,
	error: unknown,
	status: number,
	publicMessage: string
): Response {
	logger.error(`${context} Error`, { error: String(error) });
	return safeErrorResponse(status, publicMessage);
}
