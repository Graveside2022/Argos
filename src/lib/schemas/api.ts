/**
 * API Request/Response Zod Schemas
 * Created for: Constitutional Audit Remediation (P1)
 * Tasks: T027-T029
 *
 * Purpose: Validate API request/response data for external-facing endpoints
 * - SignalBatchRequest: Batch signal upload endpoint validation
 * - GPSCoordinates: GPS coordinate validation for API endpoints
 */

import { z } from 'zod';

/**
 * GPS Coordinates Schema - Validates latitude/longitude for API requests
 *
 * Validation rules:
 * - lat: -90 to 90 degrees
 * - lon: -180 to 180 degrees
 */
export const GPSCoordinatesSchema = z.object({
	lat: z.number().min(-90).max(90),
	lon: z.number().min(-180).max(180)
});

/**
 * TypeScript type inferred from GPSCoordinatesSchema
 */
export type GPSCoordinates = z.infer<typeof GPSCoordinatesSchema>;

/**
 * Signal Metadata Schema - Validates optional signal metadata fields
 */
export const SignalMetadataInputSchema = z
	.object({
		bandwidth: z.number().positive().optional(),
		modulation: z.string().min(1).optional(),
		confidence: z.number().min(0).max(1).optional(),
		noiseFloor: z.number().optional(),
		snr: z.number().optional(),
		peakPower: z.number().optional(),
		averagePower: z.number().optional(),
		standardDeviation: z.number().optional(),
		skewness: z.number().optional(),
		kurtosis: z.number().optional(),
		antennaId: z.string().optional(),
		scanConfig: z.record(z.unknown()).optional()
	})
	.optional();

/**
 * Single Signal Input Schema - Validates individual signal from batch upload
 *
 * Validation rules:
 * - id: optional non-empty string (will be generated if missing)
 * - lat/lon: -90 to 90, -180 to 180 (direct or in location object)
 * - altitude: optional number
 * - frequency: 1 to 6000 MHz (HackRF/USRP range)
 * - power: -120 to 0 dBm
 * - timestamp: positive number or ISO date string
 * - source: optional string (normalized to SignalSource enum)
 * - metadata: optional object with signal characteristics
 */
export const SignalInputSchema = z
	.object({
		id: z.string().min(1).optional(),
		// Direct coordinate properties
		lat: z.number().min(-90).max(90).optional(),
		lon: z.number().min(-180).max(180).optional(),
		lng: z.number().min(-180).max(180).optional(), // Alternative longitude field
		altitude: z.number().optional(),
		// Location object (alternative coordinate format)
		location: z
			.object({
				lat: z.number().min(-90).max(90).optional(),
				lon: z.number().min(-180).max(180).optional(),
				lng: z.number().min(-180).max(180).optional(),
				altitude: z.number().optional()
			})
			.optional(),
		// Signal characteristics
		frequency: z.number().min(1).max(6000),
		power: z.number().min(-120).max(0),
		timestamp: z.union([z.number().positive(), z.string().datetime()]),
		source: z.string().optional(),
		// Optional metadata
		bandwidth: z.number().positive().optional(),
		modulation: z.string().optional(),
		confidence: z.number().min(0).max(1).optional(),
		noiseFloor: z.number().optional(),
		snr: z.number().optional(),
		peakPower: z.number().optional(),
		averagePower: z.number().optional(),
		standardDeviation: z.number().optional(),
		skewness: z.number().optional(),
		kurtosis: z.number().optional(),
		antennaId: z.string().optional(),
		scanConfig: z.record(z.unknown()).optional()
	})
	.refine(
		(data) => {
			// Ensure at least one lat/lon source is provided
			const hasDirectCoords =
				data.lat !== undefined && (data.lon !== undefined || data.lng !== undefined);
			const hasLocationCoords =
				data.location?.lat !== undefined &&
				(data.location?.lon !== undefined || data.location?.lng !== undefined);
			return hasDirectCoords || hasLocationCoords;
		},
		{
			message: 'Signal must have lat/lon coordinates (either direct or in location object)'
		}
	);

/**
 * TypeScript type inferred from SignalInputSchema
 */
export type SignalInput = z.infer<typeof SignalInputSchema>;

/**
 * Signal Batch Request Schema - Validates batch signal upload requests
 *
 * Accepts either:
 * 1. Array of signals directly
 * 2. Object with 'signals' property containing array
 */
export const SignalBatchRequestSchema = z.union([
	z.array(SignalInputSchema),
	z.object({
		signals: z.array(SignalInputSchema)
	})
]);

/**
 * TypeScript type inferred from SignalBatchRequestSchema
 */
export type SignalBatchRequest = z.infer<typeof SignalBatchRequestSchema>;
