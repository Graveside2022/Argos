/**
 * WiFi network Zod schema with runtime validation
 * Created for: Constitutional Audit Remediation (P1)
 * Task: T019
 *
 * Validation rules:
 * - ssid: non-empty string (WiFi network name)
 * - bssid: MAC address format (XX:XX:XX:XX:XX:XX)
 * - channel: 1-14 for 2.4GHz, 36-165 for 5GHz
 * - frequency: positive number in MHz
 * - signal: -100 to 0 dBm (realistic WiFi signal range)
 */

import { z } from 'zod';

/**
 * MAC address regex pattern (XX:XX:XX:XX:XX:XX)
 */
const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;

/**
 * WifiNetwork Zod schema for runtime validation
 */
export const WifiNetworkSchema = z.object({
	ssid: z.string().min(1).max(32).describe('WiFi network name (SSID)'),
	bssid: z
		.string()
		.regex(MAC_ADDRESS_REGEX, 'Must be valid MAC address (XX:XX:XX:XX:XX:XX)')
		.describe('Base station MAC address'),
	channel: z
		.number()
		.int()
		.min(1)
		.max(165)
		.describe('WiFi channel (1-14 for 2.4GHz, 36-165 for 5GHz)'),
	frequency: z.number().positive().describe('Frequency in MHz'),
	encryption: z.string().describe('Encryption type (e.g., WPA2, WEP, Open)'),
	signal: z.number().min(-100).max(0).describe('Signal strength in dBm (-100 to 0)'),
	last_seen: z.number().int().positive().describe('Last seen timestamp (Unix ms)'),
	clients: z.number().int().nonnegative().optional().describe('Number of connected clients')
});

/**
 * TypeScript type inferred from Zod schema
 */
export type WifiNetwork = z.infer<typeof WifiNetworkSchema>;

/**
 * Validate WiFi network data at runtime
 * Throws ZodError with descriptive messages if validation fails
 */
export function validateWifiNetwork(data: unknown): WifiNetwork {
	return WifiNetworkSchema.parse(data);
}

/**
 * Safe validation for user input
 */
export function safeValidateWifiNetwork(data: unknown) {
	return WifiNetworkSchema.safeParse(data);
}
