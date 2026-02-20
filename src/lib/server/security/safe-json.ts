import { z } from 'zod';

import { logger } from '$lib/utils/logger';

/**
 * Parse JSON with schema validation.
 * Returns { success: true, data: T } or { success: false, error: string }
 *
 * Usage:
 *   const result = safeJsonParse(raw, MySchema, 'gps-position');
 *   if (!result.success) return new Response(result.error, { status: 400 });
 *   const data = result.data; // fully typed, validated
 *
 * Standards: OWASP A08:2021, CERT STR50-CPP, NIST SP 800-53 SI-10
 */
export function safeJsonParse<T>(
	raw: string,
	schema: z.ZodType<T>,
	context: string
): { success: true; data: T } | { success: false; error: string } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		logger.warn(`[${context}] Invalid JSON`, { raw: raw.substring(0, 200) });
		return { success: false, error: 'Invalid JSON' };
	}
	const result = schema.safeParse(parsed);
	if (!result.success) {
		logger.warn(`[${context}] JSON validation failed`, {
			errors: result.error.issues.map((i) => i.message).join(', ')
		});
		return { success: false, error: 'Validation failed' };
	}
	return { success: true, data: result.data };
}
