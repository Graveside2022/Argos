/**
 * Hardware Detection Zod Schemas
 * Runtime validation for hardware detection to replace unsafe type assertions
 */

import { z } from 'zod';

/**
 * Hardware category schema
 */
export const HardwareCategorySchema = z.enum([
	'sdr',
	'wifi',
	'bluetooth',
	'gps',
	'cellular',
	'serial',
	'network',
	'audio',
	'unknown'
]);

/**
 * Connection type schema
 */
export const ConnectionTypeSchema = z.enum([
	'usb',
	'network',
	'serial',
	'pci',
	'internal',
	'virtual'
]);

/**
 * Hardware status schema
 */
export const HardwareStatusSchema = z.enum(['connected', 'disconnected', 'error', 'unknown']);

/**
 * SDR Capabilities Schema
 */
export const SDRCapabilitiesSchema = z.object({
	minFrequency: z.number().positive('Min frequency must be positive'),
	maxFrequency: z.number().positive('Max frequency must be positive'),
	sampleRate: z.number().positive('Sample rate must be positive'),
	bandwidth: z.number().positive('Bandwidth must be positive').optional(),
	canTransmit: z.boolean(),
	canReceive: z.boolean(),
	fullDuplex: z.boolean().optional()
});

/**
 * WiFi Capabilities Schema
 */
export const WiFiCapabilitiesSchema = z.object({
	interface: z.string().min(1, 'Interface name required'),
	hasMonitorMode: z.boolean(),
	canInject: z.boolean(),
	frequencyBands: z.array(z.string()),
	channels: z.array(z.number()),
	maxTxPower: z.number().optional()
});

/**
 * Bluetooth Capabilities Schema
 */
export const BluetoothCapabilitiesSchema = z.object({
	interface: z.string().min(1, 'Interface name required'),
	hasBleSupport: z.boolean(),
	hasClassicSupport: z.boolean(),
	version: z.string().optional(),
	manufacturer: z.string().optional()
});

/**
 * GPS Capabilities Schema
 */
export const GPSCapabilitiesSchema = z.object({
	device: z.string().min(1, 'Device path required'),
	protocol: z.string().optional(),
	baudRate: z.number().positive('Baud rate must be positive').optional(),
	updateRate: z.number().positive('Update rate must be positive').optional()
});

/**
 * Cellular Capabilities Schema
 */
export const CellularCapabilitiesSchema = z.object({
	interface: z.string().min(1, 'Interface name required'),
	supportedBands: z.array(z.string()),
	imei: z.string().optional(),
	simStatus: z.string().optional()
});

/**
 * Hardware Capabilities (discriminated union)
 */
export const HardwareCapabilitiesSchema = z.union([
	SDRCapabilitiesSchema,
	WiFiCapabilitiesSchema,
	BluetoothCapabilitiesSchema,
	GPSCapabilitiesSchema,
	CellularCapabilitiesSchema,
	z.record(z.unknown()) // Fallback for unknown capabilities
]);

/**
 * Detected Hardware Schema (Main validation schema)
 *
 * This schema validates incrementally built hardware objects before they're added to the detection list.
 * Replaces unsafe `Partial<DetectedHardware> as DetectedHardware` pattern with runtime validation.
 */
export const DetectedHardwareSchema = z.object({
	// Required fields
	id: z.string().min(1, 'Hardware ID required'),
	name: z.string().min(1, 'Hardware name required'),
	category: HardwareCategorySchema,
	connectionType: ConnectionTypeSchema,
	status: HardwareStatusSchema,
	capabilities: HardwareCapabilitiesSchema,

	// USB-specific fields (optional)
	vendorId: z.string().optional(),
	productId: z.string().optional(),
	serial: z.string().optional(),
	busNumber: z.number().int().nonnegative().optional(),
	deviceNumber: z.number().int().nonnegative().optional(),

	// Network-specific fields (optional)
	ipAddress: z.string().ip().optional().or(z.string().optional()), // Allow non-IP strings for flexibility
	port: z.number().int().min(1).max(65535).optional(),
	hostname: z.string().optional(),

	// Serial-specific fields (optional)
	device: z.string().optional(),
	baudRate: z.number().positive().optional(),

	// Metadata (optional)
	manufacturer: z.string().optional(),
	model: z.string().optional(),
	driver: z.string().optional(),
	firmwareVersion: z.string().optional(),
	lastSeen: z.number().positive('Last seen must be positive timestamp').optional(),
	firstSeen: z.number().positive('First seen must be positive timestamp').optional(),

	// Tool compatibility (optional)
	compatibleTools: z.array(z.string()).optional()
});

/**
 * Inferred types for TypeScript (internal — used by validation helpers below)
 */
type DetectedHardware = z.infer<typeof DetectedHardwareSchema>;
type SDRCapabilities = z.infer<typeof SDRCapabilitiesSchema>;

/**
 * Helper function: Validate hardware with detailed error reporting
 */
export function validateDetectedHardware(data: unknown): {
	success: boolean;
	data?: DetectedHardware;
	error?: string;
	details?: z.ZodIssue[];
} {
	const result = DetectedHardwareSchema.safeParse(data);

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
 * Helper function: Validate SDR capabilities specifically
 */
export function validateSDRCapabilities(data: unknown): {
	success: boolean;
	data?: SDRCapabilities;
	error?: string;
} {
	const result = SDRCapabilitiesSchema.safeParse(data);

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
