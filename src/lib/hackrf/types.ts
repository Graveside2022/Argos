/**
 * HackRF sweep configuration Zod schema with runtime validation
 * Created for: Constitutional Audit Remediation (P1)
 * Task: T022
 *
 * Validation rules:
 * - startFreq: 1-6000 MHz (HackRF One operating range)
 * - endFreq: 1-6000 MHz, must be > startFreq
 * - stepSize: positive number (frequency step in MHz)
 * - gain: 0-62 dB (HackRF LNA/VGA gain range)
 * - sampleRate: positive number (samples per second)
 */

import { z } from 'zod';

/**
 * HackRF sweep configuration schema
 * Used for /api/hackrf/sweep POST requests
 */
export const HackRFSweepConfigSchema = z
	.object({
		startFreq: z.number().min(1).max(6000).describe('Start frequency in MHz (1-6000)'),
		endFreq: z.number().min(1).max(6000).describe('End frequency in MHz (1-6000)'),
		stepSize: z.number().positive().default(1).describe('Frequency step size in MHz'),
		gain: z.number().int().min(0).max(62).default(20).describe('RF gain in dB (0-62)'),
		sampleRate: z.number().positive().default(20_000_000).describe('Sample rate in Hz'),
		bandwidth: z.number().positive().optional().describe('Bandwidth in Hz')
	})
	.refine((data) => data.endFreq > data.startFreq, {
		message: 'endFreq must be greater than startFreq',
		path: ['endFreq']
	});

/**
 * TypeScript type inferred from Zod schema
 */
export type HackRFSweepConfig = z.infer<typeof HackRFSweepConfigSchema>;

/**
 * HackRF FFT data point schema
 * Represents a single frequency bin in the FFT output
 */
export const HackRFFFTDataSchema = z.object({
	frequency: z.number().positive().describe('Center frequency in MHz'),
	power: z.number().min(-120).max(0).describe('Signal power in dBm'),
	timestamp: z.number().int().positive().describe('Capture timestamp (Unix ms)'),
	bandwidth: z.number().positive().optional().describe('Bandwidth in Hz'),
	gain: z.number().int().min(0).max(62).optional().describe('RF gain used')
});

/**
 * TypeScript type for FFT data
 */
export type HackRFFFTData = z.infer<typeof HackRFFFTDataSchema>;

/**
 * Validate HackRF sweep configuration
 * Throws ZodError if validation fails
 */
export function validateHackRFSweepConfig(data: unknown): HackRFSweepConfig {
	return HackRFSweepConfigSchema.parse(data);
}

/**
 * Safe validation for user input
 */
export function safeValidateHackRFSweepConfig(data: unknown) {
	return HackRFSweepConfigSchema.safeParse(data);
}

/**
 * Validate HackRF FFT data
 */
export function validateHackRFFFTData(data: unknown): HackRFFFTData {
	return HackRFFFTDataSchema.parse(data);
}

/**
 * Safe FFT data validation
 */
export function safeValidateHackRFFFTData(data: unknown) {
	return HackRFFFTDataSchema.safeParse(data);
}
