/**
 * Signal reading Zod schema with runtime validation
 * Created for: Constitutional Audit Remediation (P1)
 * Task: T018
 *
 * Validation rules:
 * - frequency: 1-6000 MHz (HackRF operating range)
 * - power: -120 to 0 dBm (realistic signal power range)
 * - timestamp: positive integer (Unix timestamp in ms)
 * - source: enum of valid SDR sources
 */

import { z } from 'zod';

/**
 * SignalReading Zod schema for runtime validation
 * Use .parse() for API boundaries, .safeParse() for user input
 */
export const SignalReadingSchema = z.object({
	frequency: z.number().min(1).max(6000).describe('Frequency in MHz (1-6000)'),
	power: z.number().min(-120).max(0).describe('Signal power in dBm (-120 to 0)'),
	timestamp: z.number().int().positive().describe('Unix timestamp in milliseconds'),
	source: z.enum(['hackrf', 'kismet']).describe('SDR hardware source'),
	metadata: z.record(z.unknown()).optional().describe('Additional signal metadata')
});

/**
 * TypeScript type inferred from Zod schema
 * Ensures type and validation are always in sync
 */
export type SignalReading = z.infer<typeof SignalReadingSchema>;

/**
 * Validate signal reading data at runtime
 * Throws ZodError with descriptive messages if validation fails
 *
 * @example
 * ```typescript
 * const signal = SignalReadingSchema.parse(apiResponse);
 * ```
 */
export function validateSignalReading(data: unknown): SignalReading {
	return SignalReadingSchema.parse(data);
}

/**
 * Safe validation for user input (returns result object instead of throwing)
 *
 * @example
 * ```typescript
 * const result = safeValidateSignalReading(userInput);
 * if (!result.success) {
 *   console.error('Validation failed:', result.error.format());
 * }
 * ```
 */
export function safeValidateSignalReading(data: unknown) {
	return SignalReadingSchema.safeParse(data);
}
