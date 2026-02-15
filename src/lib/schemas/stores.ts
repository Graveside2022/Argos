/**
 * Store Zod Schemas for Runtime Validation
 * Created for: Constitutional Audit Remediation (P1)
 * Tasks: T037-T040
 *
 * Purpose: Validate data being written to Svelte stores to ensure data integrity
 * - GPSPosition: GPS coordinates
 * - GPSStatus: GPS fix status and metadata
 * - SimplifiedSignal: HackRF signal data
 */

import { z } from 'zod';

/**
 * GPSPosition Schema - Validates GPS coordinates
 *
 * Validation rules:
 * - lat: -90 to 90 degrees
 * - lon: -180 to 180 degrees
 */
export const GPSPositionSchema = z.object({
	lat: z.number().min(-90).max(90),
	lon: z.number().min(-180).max(180)
});

/**
 * TypeScript type inferred from GPSPositionSchema
 */
export type GPSPosition = z.infer<typeof GPSPositionSchema>;

/**
 * GPSStatus Schema - Validates GPS fix status and metadata
 *
 * Validation rules:
 * - hasGPSFix: boolean
 * - gpsStatus: non-empty string (status message)
 * - accuracy: non-negative number (meters)
 * - satellites: non-negative integer
 * - fixType: non-empty string
 * - heading: number 0-360 or null
 * - speed: non-negative number or null (m/s)
 * - currentCountry: object with name and flag
 * - formattedCoords: object with lat and lon strings
 * - mgrsCoord: string (MGRS coordinate)
 */
export const GPSStatusSchema = z.object({
	hasGPSFix: z.boolean(),
	gpsStatus: z.string().min(1),
	accuracy: z.number().nonnegative(),
	satellites: z.number().int().nonnegative(),
	fixType: z.string().min(1),
	heading: z.number().min(0).max(360).nullable(),
	speed: z.number().nonnegative().nullable(),
	currentCountry: z.object({
		name: z.string(),
		flag: z.string()
	}),
	formattedCoords: z.object({
		lat: z.string(),
		lon: z.string()
	}),
	mgrsCoord: z.string()
});

/**
 * TypeScript type inferred from GPSStatusSchema
 */
export type GPSStatus = z.infer<typeof GPSStatusSchema>;

/**
 * SimplifiedSignal Schema - Validates HackRF signal data
 *
 * Validation rules:
 * - id: non-empty string (unique identifier)
 * - frequency: 1 to 6000 MHz (HackRF operating range)
 * - power: -120 to 0 dBm (realistic signal power range)
 * - lat: -90 to 90 degrees
 * - lon: -180 to 180 degrees
 * - timestamp: positive integer (Unix timestamp in ms)
 * - count: positive integer (observation count)
 */
export const SimplifiedSignalSchema = z.object({
	id: z.string().min(1),
	frequency: z.number().min(1).max(6000),
	power: z.number().min(-120).max(0),
	lat: z.number().min(-90).max(90),
	lon: z.number().min(-180).max(180),
	timestamp: z.number().int().positive(),
	count: z.number().int().positive()
});

/**
 * TypeScript type inferred from SimplifiedSignalSchema
 */
export type SimplifiedSignal = z.infer<typeof SimplifiedSignalSchema>;
