/**
 * Kismet API Response Zod Schemas
 * Runtime validation for Kismet API responses to replace unsafe type assertions
 */

import { z } from 'zod';

/**
 * Kismet Status Response Schema
 */
export const KismetStatusResponseSchema = z.object({
	running: z.boolean(),
	uptime: z.number().nonnegative('Uptime must be non-negative'),
	interface: z.string(),
	deviceCount: z.number().int().nonnegative('Device count must be non-negative'),
	metrics: z.object({
		packetsProcessed: z.number().int().nonnegative(),
		devicesDetected: z.number().int().nonnegative(),
		packetsPerSecond: z.number().nonnegative(),
		bytesPerSecond: z.number().nonnegative()
	}),
	channels: z.array(z.string()),
	monitorInterfaces: z.array(z.string()),
	startTime: z.number().positive('Start time must be positive timestamp').optional()
});

/**
 * Kismet Device Schema
 */
export const KismetDeviceSchema = z.object({
	key: z.string().min(1, 'Device key required'),
	macaddr: z.string().min(1, 'MAC address required'),
	type: z.string().optional(),
	firsttime: z.number().positive().optional(),
	lasttime: z.number().positive().optional(),
	signal: z.number().optional(),
	channel: z.string().optional(),
	frequency: z.number().optional(),
	manuf: z.string().optional(),
	commonname: z.string().optional()
});

/**
 * Service Health Response Schema
 */
export const ServiceHealthResponseSchema = z.object({
	service: z.string().min(1, 'Service name required'),
	status: z.enum(['running', 'stopped', 'error']),
	uptime: z.number().nonnegative().optional(),
	message: z.string().optional(),
	metrics: z.record(z.number()).optional()
});

/**
 * GPS State Response Schema
 */
export const GPSStateResponseSchema = z.object({
	fix: z.boolean(),
	latitude: z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
	longitude: z
		.number()
		.min(-180, 'Longitude must be >= -180')
		.max(180, 'Longitude must be <= 180'),
	altitude: z.number().optional(),
	accuracy: z.number().nonnegative('Accuracy must be non-negative').optional(),
	speed: z.number().nonnegative('Speed must be non-negative').optional(),
	heading: z.number().min(0).max(360, 'Heading must be 0-360 degrees').optional(),
	satellites: z.number().int().nonnegative('Satellite count must be non-negative').optional(),
	timestamp: z.number().positive('Timestamp must be positive')
});

/**
 * HackRF Status Response Schema
 */
export const HackRFStatusResponseSchema = z.object({
	connected: z.boolean(),
	sweeping: z.boolean(),
	device: z
		.object({
			serial: z.string().min(1, 'Serial number required'),
			boardId: z.number().int().nonnegative('Board ID must be non-negative'),
			firmwareVersion: z.string().min(1, 'Firmware version required')
		})
		.optional(),
	config: z
		.object({
			startFreq: z.number().positive('Start frequency must be positive'),
			endFreq: z.number().positive('End frequency must be positive'),
			binWidth: z.number().positive('Bin width must be positive'),
			fftSize: z.number().int().positive('FFT size must be positive')
		})
		.optional()
});

/**
 * Export inferred types for TypeScript
 */
export type KismetStatusResponse = z.infer<typeof KismetStatusResponseSchema>;
export type KismetDevice = z.infer<typeof KismetDeviceSchema>;
export type ServiceHealthResponse = z.infer<typeof ServiceHealthResponseSchema>;
export type GPSStateResponse = z.infer<typeof GPSStateResponseSchema>;
export type HackRFStatusResponse = z.infer<typeof HackRFStatusResponseSchema>;

/**
 * Helper function: Validate Kismet status response with detailed error reporting
 */
export function validateKismetStatus(data: unknown): {
	success: boolean;
	data?: KismetStatusResponse;
	error?: string;
	details?: z.ZodIssue[];
} {
	const result = KismetStatusResponseSchema.safeParse(data);

	if (result.success) {
		return {
			success: true,
			data: result.data
		};
	}

	return {
		success: false,
		error: result.error.message,
		details: result.error.issues
	};
}

/**
 * Helper function: Validate Kismet device with detailed error reporting
 */
export function validateKismetDevice(data: unknown): {
	success: boolean;
	data?: KismetDevice;
	error?: string;
} {
	const result = KismetDeviceSchema.safeParse(data);

	if (result.success) {
		return {
			success: true,
			data: result.data
		};
	}

	return {
		success: false,
		error: result.error.message
	};
}
