/**
 * Generic API response Zod schema with runtime validation
 * Created for: Constitutional Audit Remediation (P1)
 * Task: T021
 *
 * Validation rules:
 * - success: boolean indicating operation success
 * - data: generic payload (validated by caller)
 * - error: optional error message (present when success=false)
 * - timestamp: optional response timestamp
 */

import { z, type ZodType } from 'zod';

/**
 * Generic API response schema
 * Use with specific data schemas for type-safe API responses
 *
 * @example
 * ```typescript
 * const SignalApiResponse = ApiResponseSchema(SignalReadingSchema);
 * const result = SignalApiResponse.parse(apiResponse);
 * ```
 */
export function ApiResponseSchema<T extends ZodType>(dataSchema: T) {
	return z.object({
		success: z.boolean().describe('Operation success indicator'),
		data: dataSchema.optional().describe('Response payload'),
		error: z.string().optional().describe('Error message (if success=false)'),
		timestamp: z.number().int().positive().optional().describe('Response timestamp (Unix ms)')
	});
}

/**
 * TypeScript type for API response with generic data type
 */
export type ApiResponse<T> = {
	success: boolean;
	data?: T;
	error?: string;
	timestamp?: number;
};

/**
 * Successful API response builder
 */
export function successResponse<T>(data: T, timestamp?: number): ApiResponse<T> {
	return {
		success: true,
		data,
		timestamp: timestamp ?? Date.now()
	};
}

/**
 * Error API response builder
 */
export function errorResponse(error: string, timestamp?: number): ApiResponse<never> {
	return {
		success: false,
		error,
		timestamp: timestamp ?? Date.now()
	};
}

/**
 * Validate API response at runtime with specific data schema
 *
 * @example
 * ```typescript
 * const validated = validateApiResponse(response, SignalReadingSchema);
 * if (validated.success && validated.data) {
 *   // TypeScript knows validated.data is SignalReading
 * }
 * ```
 */
export function validateApiResponse<T>(data: unknown, dataSchema: ZodType<T>) {
	const schema = ApiResponseSchema(dataSchema);
	return schema.parse(data) as ApiResponse<T>;
}

/**
 * Safe API response validation
 */
export function safeValidateApiResponse<T>(data: unknown, dataSchema: ZodType<T>) {
	const schema = ApiResponseSchema(dataSchema);
	return schema.safeParse(data);
}
