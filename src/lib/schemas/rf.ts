/**
 * RF API Request/Response Zod Schemas
 * Created for: Type Safety Cleanup (Phase 2)
 *
 * Purpose: Deep validation for RF control endpoints
 * - Frequency range validation
 * - Device type validation
 * - Sweep configuration validation
 */

import { z } from 'zod';

/**
 * Device Type Schema - Validates SDR device type (HackRF only)
 */
export const DeviceTypeSchema = z.enum(['hackrf', 'auto']).default('hackrf');

/**
 * Frequency Range Schema - Validates frequency range objects
 *
 * Supports multiple formats:
 * 1. { start: number, stop: number, step?: number }
 * 2. { start: number, end: number }
 * 3. Plain number (center frequency)
 */
export const FrequencyRangeSchema = z.union([
	// Format 1: start/stop/step
	z
		.object({
			start: z.number().min(1).max(6000).describe('Start frequency in MHz'),
			stop: z.number().min(1).max(6000).describe('Stop frequency in MHz'),
			step: z.number().min(0.001).max(100).optional().describe('Step size in MHz')
		})
		.refine((data) => data.stop > data.start, {
			message: 'Stop frequency must be greater than start frequency'
		}),
	// Format 2: start/end
	z
		.object({
			start: z.number().min(1).max(6000).describe('Start frequency in MHz'),
			end: z.number().min(1).max(6000).describe('End frequency in MHz')
		})
		.refine((data) => data.end > data.start, {
			message: 'End frequency must be greater than start frequency'
		}),
	// Format 3: plain number
	z.number().min(1).max(6000).describe('Center frequency in MHz')
]);

/**
 * TypeScript type inferred from FrequencyRangeSchema
 */
export type FrequencyRange = z.infer<typeof FrequencyRangeSchema>;

/**
 * Start Sweep Request Schema - Validates sweep start requests
 *
 * Validation rules:
 * - deviceType: hackrf or auto (defaults to hackrf)
 * - frequencies: array of 1-50 frequency ranges
 * - cycleTime: 1-300 seconds per frequency
 */
export const StartSweepRequestSchema = z.object({
	deviceType: DeviceTypeSchema.optional(),
	frequencies: z
		.array(FrequencyRangeSchema)
		.min(1, 'At least one frequency range required')
		.max(50, 'Maximum 50 frequency ranges allowed'),
	cycleTime: z.number().min(1).max(300).default(10).describe('Cycle time in seconds (1-300)')
});

/**
 * TypeScript type inferred from StartSweepRequestSchema
 */
export type StartSweepRequest = z.infer<typeof StartSweepRequestSchema>;

/**
 * Stop Sweep Request Schema - Validates sweep stop requests
 */
export const StopSweepRequestSchema = z.object({
	deviceType: DeviceTypeSchema.optional()
});

/**
 * TypeScript type inferred from StopSweepRequestSchema
 */
export type StopSweepRequest = z.infer<typeof StopSweepRequestSchema>;

/**
 * Emergency Stop Request Schema - Validates emergency stop requests
 */
export const EmergencyStopRequestSchema = z.object({
	deviceType: DeviceTypeSchema.optional()
});

/**
 * TypeScript type inferred from EmergencyStopRequestSchema
 */
export type EmergencyStopRequest = z.infer<typeof EmergencyStopRequestSchema>;

/**
 * Kismet Devices Response Schema - Validates Kismet API responses
 */
export const KismetDevicesResponseSchema = z.object({
	devices: z.array(z.record(z.unknown())).optional(),
	error: z.string().optional()
});

/**
 * TypeScript type inferred from KismetDevicesResponseSchema
 */
export type KismetDevicesResponse = z.infer<typeof KismetDevicesResponseSchema>;

/**
 * Kismet Control Response Schema - Validates Kismet control API responses
 */
export const KismetControlResponseSchema = z.object({
	success: z.boolean(),
	running: z.boolean().optional(),
	message: z.string().optional(),
	error: z.string().optional()
});

/**
 * TypeScript type inferred from KismetControlResponseSchema
 */
export type KismetControlResponse = z.infer<typeof KismetControlResponseSchema>;

/**
 * GPS API Response Schema - Validates GPS position API responses
 */
export const GPSApiResponseSchema = z.object({
	success: z.boolean(),
	data: z
		.object({
			latitude: z.number().min(-90).max(90).nullable(),
			longitude: z.number().min(-180).max(180).nullable(),
			accuracy: z.number().nullable().optional(),
			satellites: z.number().nullable().optional(),
			fix: z.number().optional(),
			heading: z.number().nullable().optional(),
			speed: z.number().nullable().optional(),
			time: z.string().nullable().optional(),
			altitude: z.number().nullable().optional()
		})
		.optional(),
	error: z.string().optional()
});

/**
 * TypeScript type inferred from GPSApiResponseSchema
 */
export type GPSApiResponse = z.infer<typeof GPSApiResponseSchema>;

/**
 * Kismet Raw Device Schema - Validates external Kismet API device responses
 * (Defensive validation for external API consumption)
 */
export const KismetRawDeviceSchema = z
	.object({
		'kismet.device.base.key': z.string(),
		'kismet.device.base.macaddr': z.string(),
		'kismet.device.base.name': z.string().optional(),
		'kismet.device.base.manuf': z.string().optional(),
		'kismet.device.base.type': z.string().optional(),
		'kismet.device.base.channel': z.number().optional(),
		'kismet.device.base.frequency': z.number().optional(),
		'kismet.device.base.signal': z
			.object({
				'kismet.common.signal.last_signal': z.number().optional()
			})
			.optional(),
		'kismet.device.base.last_time': z.number().optional(),
		'kismet.device.base.first_time': z.number().optional(),
		'kismet.device.base.packets.total': z.number().optional(),
		'kismet.device.base.packets.data': z.number().optional(),
		'kismet.device.base.datasize': z.number().optional(),
		'kismet.device.base.crypt': z.record(z.boolean()).optional(),
		'kismet.device.base.location': z
			.object({
				'kismet.common.location.lat': z.number().optional(),
				'kismet.common.location.lon': z.number().optional(),
				'kismet.common.location.alt': z.number().optional()
			})
			.optional()
	})
	.passthrough(); // Allow additional Kismet fields

/**
 * Kismet System Status Schema - Validates external Kismet API status responses
 */
export const KismetSystemStatusSchema = z
	.object({
		'kismet.system.packets.rate': z.number().optional(),
		'kismet.system.memory.rss': z.number().optional(),
		'kismet.system.cpu.system': z.number().optional(),
		'kismet.system.timestamp.start_sec': z.number().optional(),
		'kismet.system.channels.channels': z.array(z.unknown()).optional(),
		'kismet.system.interfaces': z.array(z.unknown()).optional()
	})
	.passthrough(); // Allow additional Kismet fields
