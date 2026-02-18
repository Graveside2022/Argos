import {
	GPSAPIResponseSchema,
	RawKismetDeviceSchema,
	SimplifiedKismetDeviceSchema
} from '$lib/schemas/kismet';
import { KismetProxy } from '$lib/server/kismet/kismet-proxy';
import { logError, logInfo, logWarn } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

/**
 * Represents a wireless device detected by Kismet
 */
export interface KismetDevice {
	mac: string;
	last_seen: number;
	signal: {
		last_signal: number;
		max_signal: number;
		min_signal: number;
	};
	manufacturer: string;
	type: string;
	channel: number;
	frequency: number;
	packets: number;
	datasize: number;
	ssid?: string;
	encryption?: string[];
	location: {
		lat: number;
		lon: number;
	};
}

/**
 * GPS coordinates for device location
 */
export interface GPSPosition {
	latitude: number;
	longitude: number;
}

/**
 * Response from the Kismet device service
 */
export interface DevicesResponse {
	devices: KismetDevice[];
	error: string | null;
	source: 'kismet' | 'fallback';
}

/**
 * Service layer for Kismet device operations
 * Handles communication with Kismet server and provides fallback mechanisms
 */
export class KismetService {
	private static readonly DEFAULT_SIGNAL = -100;

	/**
	 * Retrieves current GPS position from the GPS API
	 * @param fetchFn - The fetch function to use for HTTP requests
	 * @returns GPS position or null if unavailable
	 */
	static async getGPSPosition(fetchFn: typeof fetch): Promise<GPSPosition | null> {
		try {
			const gpsResponse = await fetchFn('/api/gps/position');
			if (gpsResponse.ok) {
				const rawData = await gpsResponse.json();

				// Validate GPS API response (T-kismet-1)
				const validated = safeParseWithHandling(
					GPSAPIResponseSchema,
					rawData,
					'background'
				);
				if (!validated) {
					logError('Invalid GPS API response', { rawData }, 'gps-api-validation-failed');
					return null;
				}

				if (validated.success && validated.data) {
					return {
						latitude: validated.data.latitude,
						longitude: validated.data.longitude
					};
				}
			}
		} catch (error) {
			logWarn('Could not get GPS position', { error });
		}

		return null;
	}

	/**
	 * Retrieves wireless devices from Kismet using multiple fallback strategies
	 * @param fetchFn - The fetch function to use for HTTP requests
	 * @returns Device list with source information and any errors
	 */
	static async getDevices(fetchFn: typeof fetch): Promise<DevicesResponse> {
		const gpsPosition = await this.getGPSPosition(fetchFn);
		let devices: KismetDevice[] = [];
		let error: string | null = null;

		// Method 1: Try the KismetProxy getDevices method
		try {
			logWarn('Attempting to fetch devices from Kismet using KismetProxy...');
			const kismetDevices = await KismetProxy.getDevices();
			devices = this.transformKismetDevices(kismetDevices, gpsPosition);
			logInfo(`Successfully fetched ${devices.length} devices from Kismet`);
			return { devices, error: null, source: 'kismet' };
		} catch (err: unknown) {
			// Safe: Error-like object narrowed for message property access
			error = (err as { message?: string }).message || 'Unknown error';
			logError('KismetProxy.getDevices failed', { error });
		}

		// Method 2: Try direct REST API endpoints
		try {
			logWarn('Attempting direct Kismet REST API...');
			const timestamp = Math.floor(Date.now() / 1000) - 1800; // 30 minutes ago for better coverage
			const response = await KismetProxy.proxyGet(
				`/devices/last-time/${timestamp}/devices.json`
			);

			if (Array.isArray(response)) {
				if (response.length > 0) {
					logWarn('Sample device signal data', {
						// Safe: Array element cast to Record for Kismet JSON field access
						signal: (response[0] as Record<string, unknown>)[
							'kismet.device.base.signal'
						]
					});
				}
				devices = this.transformRawKismetDevices(response, gpsPosition);
				logInfo(`Fetched ${devices.length} devices via last-time endpoint`);
				return { devices, error: null, source: 'kismet' };
			}
		} catch (err2: unknown) {
			// Safe: Error-like object narrowed for message property access
			logError('Direct REST API failed', { error: (err2 as { message?: string }).message });
		}

		// Method 3: Try simple devices endpoint
		try {
			const simpleResponse = await KismetProxy.proxyGet('/devices/summary/devices.json');
			if (Array.isArray(simpleResponse)) {
				devices = this.transformRawKismetDevices(simpleResponse.slice(0, 50), gpsPosition);
				return { devices, error: null, source: 'kismet' };
			}
		} catch (err3: unknown) {
			// Safe: Error-like object narrowed for message property access
			logError('Summary endpoint failed', { error: (err3 as { message?: string }).message });
		}

		logWarn(`Returning ${devices.length} devices (error: ${error || 'none'})`);
		return { devices, error, source: error ? 'fallback' : 'kismet' };
	}

	/**
	 * Checks if a device has valid GPS coordinates (not 0,0 or missing)
	 */
	private static hasValidLocation(lat: number | undefined, lon: number | undefined): boolean {
		return lat !== undefined && lon !== undefined && !(lat === 0 && lon === 0);
	}

	/**
	 * FNV-1a 32-bit hash of a MAC address, normalized to [0, 1).
	 * Deterministic: same MAC always produces the same value.
	 */
	private static hashMAC(mac: string): number {
		let hash = 0x811c9dc5;
		for (let i = 0; i < mac.length; i++) {
			hash ^= mac.charCodeAt(i);
			hash = (hash * 0x01000193) | 0;
		}
		return ((hash >>> 0) % 100000) / 100000;
	}

	/** Second independent hash for the same MAC (different seed). */
	private static hashMAC2(mac: string): number {
		let hash = 0x01000193;
		for (let i = 0; i < mac.length; i++) {
			hash ^= mac.charCodeAt(i);
			hash = (hash * 0x811c9dc5) | 0;
		}
		return ((hash >>> 0) % 100000) / 100000;
	}

	/**
	 * Returns device coordinates, falling back to receiver GPS with deterministic,
	 * signal-aware positioning when device has no valid location.
	 *
	 * - Angle is derived from MAC hash (stable across refreshes)
	 * - Distance from center is driven by signal strength:
	 *   strong signals (~-30 dBm) → ~20m, weak (~-100 dBm) → ~200m
	 */
	private static resolveLocation(
		deviceLat: number | undefined,
		deviceLon: number | undefined,
		gpsPosition: GPSPosition | null,
		mac: string,
		signalDbm: number
	): { lat: number; lon: number } {
		if (
			this.hasValidLocation(deviceLat, deviceLon) &&
			deviceLat !== null &&
			deviceLon !== null &&
			deviceLat !== undefined &&
			deviceLon !== undefined
		) {
			return { lat: deviceLat, lon: deviceLon };
		}

		if (gpsPosition) {
			const angle = this.hashMAC(mac) * 2 * Math.PI;

			// Quantize to 10 dBm steps so positions stay rock-stable across polls
			const quantized = Math.round(signalDbm / 10) * 10;
			const clamped = Math.max(-100, Math.min(-20, quantized));
			const signalNorm = (clamped + 100) / 80;

			const minDist = 20;
			const maxDist = 200;
			const variation = this.hashMAC2(mac) * 0.3; // 0-30 % per-device spread
			const baseDist = minDist + (1 - signalNorm) * (maxDist - minDist);
			const dist = baseDist * (0.85 + variation);

			const R = 6371000;
			const dLat = ((dist * Math.cos(angle)) / R) * (180 / Math.PI);
			const dLon =
				((dist * Math.sin(angle)) /
					(R * Math.cos((gpsPosition.latitude * Math.PI) / 180))) *
				(180 / Math.PI);

			return {
				lat: gpsPosition.latitude + dLat,
				lon: gpsPosition.longitude + dLon
			};
		}

		return { lat: 0, lon: 0 };
	}

	private static transformKismetDevices(
		kismetDevices: unknown[],
		gpsPosition: GPSPosition | null
	): KismetDevice[] {
		const validatedDevices: KismetDevice[] = [];

		for (const device of kismetDevices) {
			// Validate simplified Kismet device data (T-kismet-2)
			const validated = safeParseWithHandling(
				SimplifiedKismetDeviceSchema,
				device,
				'background'
			);

			if (!validated) {
				logError(
					'Invalid simplified Kismet device',
					{ device },
					'kismet-device-validation-failed'
				);
				continue; // Skip invalid device, continue with valid ones
			}

			const rawSignal = validated.signal ?? this.DEFAULT_SIGNAL;
			const rawType = validated.type ?? 'unknown';
			const deviceLat = validated.location?.lat;
			const deviceLon = validated.location?.lon;

			// Convert lastSeen to timestamp
			const lastSeenTimestamp =
				typeof validated.lastSeen === 'string'
					? new Date(validated.lastSeen).getTime()
					: validated.lastSeen;

			validatedDevices.push({
				mac: validated.mac,
				last_seen: lastSeenTimestamp,
				signal: {
					last_signal: rawSignal,
					max_signal: rawSignal,
					min_signal: rawSignal
				},
				manufacturer: validated.manufacturer || 'Unknown',
				type: rawType.toLowerCase(),
				channel: parseInt(String(validated.channel)) || 0,
				frequency:
					validated.frequency || (parseInt(String(validated.channel)) || 0) * 5 + 2400,
				packets: validated.packets || 0,
				datasize: validated.packets || 0,
				ssid: validated.ssid || validated.name || undefined,
				encryption: validated.encryption || validated.encryptionType || undefined,
				location: this.resolveLocation(
					deviceLat,
					deviceLon,
					gpsPosition,
					validated.mac,
					rawSignal
				)
			});
		}

		return validatedDevices;
	}

	private static transformRawKismetDevices(
		rawDevices: unknown[],
		gpsPosition: GPSPosition | null
	): KismetDevice[] {
		const validatedDevices: KismetDevice[] = [];

		for (const device of rawDevices) {
			// Validate raw Kismet device data (T-kismet-3)
			const validated = safeParseWithHandling(RawKismetDeviceSchema, device, 'background');

			if (!validated) {
				logError(
					'Invalid raw Kismet device',
					{ device },
					'raw-kismet-device-validation-failed'
				);
				continue; // Skip invalid device, continue with valid ones
			}

			// Extract signal from validated device
			const rawSignal =
				typeof validated['kismet.device.base.signal'] === 'object' &&
				validated['kismet.device.base.signal'] !== null
					? validated['kismet.device.base.signal']['kismet.common.signal.last_signal'] ||
						validated['kismet.device.base.signal']['kismet.common.signal.max_signal'] ||
						this.DEFAULT_SIGNAL
					: validated['kismet.device.base.signal'] || this.DEFAULT_SIGNAL;

			const rawType = validated['kismet.device.base.type'] || 'Unknown';

			// Extract SSID from multiple possible locations
			let ssid: string | undefined = undefined;
			if (validated['dot11.device']) {
				ssid =
					validated['dot11.device']['dot11.device.last_beaconed_ssid'] ||
					validated['dot11.device']['dot11.device.advertised_ssid_map']?.ssid ||
					undefined;
			}
			if (!ssid && validated['kismet.device.base.name']) {
				ssid = validated['kismet.device.base.name'];
			}

			const deviceLat =
				validated['kismet.device.base.location']?.['kismet.common.location.lat'];
			const deviceLon =
				validated['kismet.device.base.location']?.['kismet.common.location.lon'];
			const mac = validated['kismet.device.base.macaddr'] || 'Unknown';

			validatedDevices.push({
				mac,
				last_seen: (validated['kismet.device.base.last_time'] || 0) * 1000,
				signal: {
					last_signal: rawSignal,
					max_signal: rawSignal,
					min_signal: rawSignal
				},
				manufacturer: validated['kismet.device.base.manuf'] || 'Unknown',
				type: rawType.toLowerCase(),
				channel: parseInt(String(validated['kismet.device.base.channel'])) || 0,
				frequency:
					validated['kismet.device.base.frequency'] ||
					(parseInt(String(validated['kismet.device.base.channel'])) || 0) * 5 + 2400,
				packets: validated['kismet.device.base.packets.total'] || 0,
				datasize: validated['kismet.device.base.packets.total'] || 0,
				ssid,
				location: this.resolveLocation(deviceLat, deviceLon, gpsPosition, mac, rawSignal)
			});
		}

		return validatedDevices;
	}
}
