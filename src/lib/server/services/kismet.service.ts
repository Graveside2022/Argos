import { KismetProxy } from '$lib/server/kismet';
import { logError, logInfo, logWarn } from '$lib/utils/logger';

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
				const gpsData = (await gpsResponse.json()) as Record<string, unknown>;
				if (gpsData.success && gpsData.data) {
					const data = gpsData.data as Record<string, unknown>;
					return {
						latitude: data.latitude as number,
						longitude: data.longitude as number
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
		if (this.hasValidLocation(deviceLat, deviceLon)) {
			return { lat: deviceLat!, lon: deviceLon! };
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
		return kismetDevices.map((device: unknown) => {
			const d = device as Record<string, unknown>;
			const rawSignal = (d.signal as number) || this.DEFAULT_SIGNAL;
			const rawType = d.type as string;

			const deviceLat = (d.location as Record<string, unknown>)?.lat as number;
			const deviceLon = (d.location as Record<string, unknown>)?.lon as number;

			return {
				mac: d.mac as string,
				last_seen: new Date(d.lastSeen as string).getTime(),
				signal: {
					last_signal: rawSignal,
					max_signal: rawSignal,
					min_signal: rawSignal
				},
				manufacturer: (d.manufacturer as string) || 'Unknown',
				type: rawType?.toLowerCase() || 'unknown',
				channel: parseInt(String(d.channel)) || 0,
				frequency: (d.frequency as number) || 0,
				packets: (d.packets as number) || 0,
				datasize: (d.packets as number) || 0,
				ssid: (d.ssid as string) || (d.name as string) || undefined,
				encryption: Array.isArray(d.encryption)
					? (d.encryption as string[])
					: Array.isArray(d.encryptionType)
						? (d.encryptionType as string[])
						: undefined,
				location: this.resolveLocation(
					deviceLat,
					deviceLon,
					gpsPosition,
					d.mac as string,
					rawSignal
				)
			};
		});
	}

	private static transformRawKismetDevices(
		rawDevices: unknown[],
		gpsPosition: GPSPosition | null
	): KismetDevice[] {
		return rawDevices.map((device: unknown) => {
			const d = device as Record<string, unknown>;
			const rawSignal = this.extractSignalFromDevice(d);
			const rawType = (d['kismet.device.base.type'] as string) || 'Unknown';

			// Extract SSID from multiple possible locations in Kismet data
			let ssid: string | undefined = undefined;
			if (d['dot11.device']) {
				const dot11 = d['dot11.device'] as Record<string, unknown>;
				ssid =
					(dot11['dot11.device.last_beaconed_ssid'] as string) ||
					((dot11['dot11.device.advertised_ssid_map'] as Record<string, unknown>)?.[
						'ssid'
					] as string) ||
					undefined;
			}
			if (!ssid && d['kismet.device.base.name']) {
				ssid = d['kismet.device.base.name'] as string;
			}

			const locationData = d['kismet.device.base.location'] as
				| Record<string, unknown>
				| undefined;
			const deviceLat = locationData?.['kismet.common.location.lat'] as number | undefined;
			const deviceLon = locationData?.['kismet.common.location.lon'] as number | undefined;

			return {
				mac: (d['kismet.device.base.macaddr'] as string) || 'Unknown',
				last_seen: ((d['kismet.device.base.last_time'] as number) || 0) * 1000,
				signal: {
					last_signal: rawSignal,
					max_signal: rawSignal,
					min_signal: rawSignal
				},
				manufacturer: (d['kismet.device.base.manuf'] as string) || 'Unknown',
				type: rawType.toLowerCase(),
				channel: parseInt(String(d['kismet.device.base.channel'])) || 0,
				frequency: (d['kismet.device.base.frequency'] as number) || 0,
				packets: (d['kismet.device.base.packets.total'] as number) || 0,
				datasize: (d['kismet.device.base.packets.total'] as number) || 0,
				ssid: ssid,
				location: this.resolveLocation(
					deviceLat,
					deviceLon,
					gpsPosition,
					(d['kismet.device.base.macaddr'] as string) || 'Unknown',
					rawSignal
				)
			};
		});
	}

	private static extractSignalFromDevice(device: Record<string, unknown>): number {
		const signalField = device['kismet.device.base.signal'];

		if (typeof signalField === 'object' && signalField !== null) {
			const signalObj = signalField as Record<string, unknown>;
			return (
				(signalObj['kismet.common.signal.last_signal'] as number) ||
				(signalObj['kismet.common.signal.max_signal'] as number) ||
				this.DEFAULT_SIGNAL
			);
		}

		return (signalField as number) || this.DEFAULT_SIGNAL;
	}
}
