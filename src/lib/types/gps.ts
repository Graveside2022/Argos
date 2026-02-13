/**
 * Canonical GPS type definitions with Zod validation
 * Used by tactical-map pages and GPS services.
 * Updated for: Constitutional Audit Remediation (P1)
 * Task: T020
 *
 * Validation rules:
 * - latitude: -90 to 90 degrees
 * - longitude: -180 to 180 degrees
 * - altitude: optional, can be null
 * - speed: optional, non-negative km/h
 * - heading: optional, 0-360 degrees
 */

import { z } from 'zod';

/**
 * GPS Position Zod schema for runtime validation
 */
export const GPSPositionSchema = z.object({
	latitude: z.number().min(-90).max(90).describe('Latitude in degrees (-90 to 90)'),
	longitude: z.number().min(-180).max(180).describe('Longitude in degrees (-180 to 180)'),
	altitude: z
		.number()
		.nullable()
		.optional()
		.describe('Altitude in meters (can be null if unavailable)'),
	speed: z.number().nonnegative().nullable().optional().describe('Speed in km/h'),
	heading: z
		.number()
		.min(0)
		.max(360)
		.nullable()
		.optional()
		.describe('Heading in degrees (0-360)'),
	accuracy: z.number().nonnegative().optional().describe('Position accuracy in meters'),
	satellites: z.number().int().nonnegative().optional().describe('Number of satellites in view'),
	fix: z
		.number()
		.int()
		.min(0)
		.max(3)
		.optional()
		.describe('GPS fix type (0=no fix, 1=2D, 2=3D, 3=DGPS)'),
	time: z.string().optional().describe('GPS time (ISO 8601 format)')
});

/**
 * TypeScript type inferred from Zod schema
 */
export type GPSPosition = z.infer<typeof GPSPositionSchema>;

/**
 * Legacy interface for backward compatibility
 * @deprecated Use GPSPosition (Zod-validated) instead
 */
export interface GPSPositionData {
	latitude: number;
	longitude: number;
	altitude?: number | null;
	speed?: number | null;
	heading?: number | null;
	accuracy?: number;
	satellites?: number;
	fix?: number;
	time?: string;
}

/**
 * Validate GPS position data at runtime
 */
export function validateGPSPosition(data: unknown): GPSPosition {
	return GPSPositionSchema.parse(data);
}

/**
 * Safe GPS position validation
 */
export function safeValidateGPSPosition(data: unknown) {
	return GPSPositionSchema.safeParse(data);
}

export interface GPSApiResponse {
	success: boolean;
	data?: GPSPositionData;
	error?: string;
	mode?: number;
	details?: string;
}

/**
 * Individual satellite data from gpsd SKY message.
 */
export interface Satellite {
	prn: number;
	constellation: 'GPS' | 'GLONASS' | 'Galileo' | 'BeiDou';
	snr: number;
	elevation: number;
	azimuth: number;
	used: boolean;
}

/**
 * API response for /api/gps/satellites endpoint.
 */
export interface SatellitesApiResponse {
	success: boolean;
	satellites: Satellite[];
	error?: string;
}
