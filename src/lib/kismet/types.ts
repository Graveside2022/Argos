/**
 * Kismet device Zod schema with runtime validation
 * Created for: Constitutional Audit Remediation (P1)
 * Task: T023
 *
 * Validation rules:
 * - mac: MAC address format
 * - signal: -120 to 0 dBm range
 * - channel: positive integer
 * - frequency: positive number in MHz
 */

import { z } from 'zod';

/**
 * MAC address regex pattern
 */
const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;

/**
 * Kismet Device Zod schema for runtime validation
 */
export const KismetDeviceSchema = z
	.object({
		mac: z
			.string()
			.regex(MAC_ADDRESS_REGEX, 'Must be valid MAC address')
			.describe('Device MAC address'),
		macaddr: z.string().regex(MAC_ADDRESS_REGEX).optional().describe('Alias for mac'),
		last_seen: z.number().int().positive().describe('Last seen timestamp (Unix ms)'),
		last_time: z.number().int().positive().optional(),
		firstSeen: z.number().int().positive().optional(),
		lastSeen: z.number().int().positive().optional(),
		signal: z.object({
			last_signal: z
				.number()
				.min(-120)
				.max(0)
				.optional()
				.describe('Last signal strength (dBm)'),
			max_signal: z
				.number()
				.min(-120)
				.max(0)
				.optional()
				.describe('Max signal strength (dBm)'),
			min_signal: z.number().min(-120).max(0).optional().describe('Min signal strength (dBm)')
		}),
		signalStrength: z.number().min(-120).max(0).optional(),
		manufacturer: z.string().optional().describe('Device manufacturer'),
		manuf: z.string().optional().describe('Manufacturer alias'),
		type: z.string().describe('Device type (AP, client, etc.)'),
		channel: z.number().int().positive().describe('WiFi channel'),
		frequency: z.number().positive().describe('Frequency in MHz'),
		packets: z.number().int().nonnegative().describe('Total packets seen'),
		datasize: z.number().int().nonnegative().describe('Total data size in bytes'),
		dataSize: z.number().int().nonnegative().optional(),
		ssid: z.string().optional().describe('WiFi SSID (for APs)'),
		encryption: z.array(z.string()).optional().describe('Encryption types'),
		encryptionType: z.array(z.string()).optional(),
		location: z
			.object({
				lat: z.number().min(-90).max(90),
				lon: z.number().min(-180).max(180)
			})
			.optional()
			.describe('Device location (if available)'),
		clients: z.array(z.string()).optional().describe('Connected client MACs'),
		parentAP: z.string().optional().describe('Parent AP MAC (for clients)')
	})
	.passthrough(); // Allow additional Kismet dynamic properties

/**
 * TypeScript type inferred from Zod schema
 */
export type KismetDeviceValidated = z.infer<typeof KismetDeviceSchema>;

/**
 * Legacy interface for backward compatibility
 * @deprecated Use KismetDeviceValidated (Zod-validated) instead
 */
export interface KismetDevice {
	// Allow dynamic property access for Kismet's nested field names
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;

	mac: string;
	macaddr?: string; // Alias for mac
	last_seen: number;
	last_time?: number;
	firstSeen?: number;
	lastSeen?: number;
	signal: {
		last_signal?: number;
		max_signal?: number;
		min_signal?: number;
	};
	signalStrength?: number;
	manufacturer?: string;
	manuf?: string;
	type: string;
	channel: number;
	frequency: number;
	packets: number;
	datasize: number;
	dataSize?: number;
	ssid?: string;
	encryption?: string[];
	encryptionType?: string[];
	location?: {
		lat: number;
		lon: number;
	};
	clients?: string[];
	parentAP?: string;
}

/**
 * Validate Kismet device data at runtime
 */
export function validateKismetDevice(data: unknown): KismetDeviceValidated {
	return KismetDeviceSchema.parse(data);
}

/**
 * Safe Kismet device validation
 */
export function safeValidateKismetDevice(data: unknown) {
	return KismetDeviceSchema.safeParse(data);
}

export interface KismetNetwork {
	ssid: string;
	bssid: string;
	channel: number;
	frequency: number;
	encryption: string;
	last_seen: number;
	signal: {
		last_signal?: number;
	};
	clients: number;
}

export interface KismetAlert {
	id: string;
	type: 'new_device' | 'security' | 'deauth' | 'probe' | 'handshake' | 'suspicious' | 'info';
	severity: 'low' | 'medium' | 'high';
	message: string;
	timestamp: number;
	details?: {
		mac?: string;
		ssid?: string;
		channel?: number;
		signal?: number;
		[key: string]: string | number | boolean | undefined;
	};
}

export interface KismetStatus {
	kismet_running: boolean;
	wigle_running: boolean;
	gps_running: boolean;
}

export interface KismetGPS {
	status: string;
	lat: string;
	lon: string;
	alt: string;
	time: string;
}

export interface KismetStore {
	devices: KismetDevice[];
	networks: KismetNetwork[];
	alerts: KismetAlert[];
	status: KismetStatus;
	gps: KismetGPS;
	lastUpdate: number | null;
	startTime: number | null;
}
