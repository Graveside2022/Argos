import { RawKismetDeviceSchema, SimplifiedKismetDeviceSchema } from '$lib/schemas/kismet';
import { KismetProxy } from '$lib/server/kismet/kismet-proxy';
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';
import { logError, logInfo, logWarn } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import { buildRawDevice, buildSimplifiedDevice } from './kismet-service-transform';

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
	/** Check if GPS coordinates are valid (non-zero, non-null) */
	private static hasValidLocation(
		lat: number | null | undefined,
		lon: number | null | undefined
	): boolean {
		return lat != null && lon != null && !(lat === 0 && lon === 0);
	}

	/**
	 * Retrieves current GPS position via direct service call.
	 * Uses the GPS service directly instead of HTTP fetch to avoid auth gate blocking.
	 * @returns GPS position or null if unavailable
	 */
	static async getGPSPosition(): Promise<GPSPosition | null> {
		try {
			const position = await getGpsPosition();
			if (!position.success || !position.data) return null;
			const { latitude, longitude } = position.data;
			if (!this.hasValidLocation(latitude, longitude)) return null;
			return { latitude: latitude!, longitude: longitude! };
		} catch (error) {
			logWarn('Could not get GPS position', { error });
			return null;
		}
	}

	/** Try fetching devices via KismetProxy.getDevices() */
	private static async tryProxyMethod(
		gpsPosition: GPSPosition | null
	): Promise<KismetDevice[] | null> {
		logWarn('Attempting to fetch devices from Kismet using KismetProxy...');
		const kismetDevices = await KismetProxy.getDevices();
		const devices = this.transformKismetDevices(kismetDevices, gpsPosition);
		logInfo(`Successfully fetched ${devices.length} devices from Kismet`);
		return devices;
	}

	/** Try fetching devices via last-time REST endpoint */
	private static async tryLastTimeEndpoint(
		gpsPosition: GPSPosition | null
	): Promise<KismetDevice[] | null> {
		logWarn('Attempting direct Kismet REST API...');
		const timestamp = Math.floor(Date.now() / 1000) - 1800;
		const response = await KismetProxy.proxyGet(`/devices/last-time/${timestamp}/devices.json`);
		if (!Array.isArray(response)) return null;
		const devices = this.transformRawKismetDevices(response, gpsPosition);
		logInfo(`Fetched ${devices.length} devices via last-time endpoint`);
		return devices;
	}

	/** Try fetching devices via summary endpoint */
	private static async trySummaryEndpoint(
		gpsPosition: GPSPosition | null
	): Promise<KismetDevice[] | null> {
		const response = await KismetProxy.proxyGet('/devices/summary/devices.json');
		if (!Array.isArray(response)) return null;
		return this.transformRawKismetDevices(response.slice(0, 50), gpsPosition);
	}

	/** Extract error message from unknown error */
	private static extractErrorMessage(err: unknown): string {
		return (err as { message?: string }).message || 'Unknown error';
	}

	/** Try each strategy in order, returning the first successful result */
	private static async tryStrategies(
		strategies: (() => Promise<KismetDevice[] | null>)[]
	): Promise<{ devices: KismetDevice[] | null; firstError: string | null }> {
		let firstError: string | null = null;
		for (const strategy of strategies) {
			try {
				const devices = await strategy();
				if (devices) return { devices, firstError: null };
			} catch (err: unknown) {
				const msg = this.extractErrorMessage(err);
				firstError ??= msg;
				logError('Kismet fetch strategy failed', { error: msg });
			}
		}
		return { devices: null, firstError };
	}

	/** Retrieves wireless devices from Kismet using multiple fallback strategies */
	static async getDevices(): Promise<DevicesResponse> {
		const gpsPosition = await this.getGPSPosition();
		const strategies = [
			() => this.tryProxyMethod(gpsPosition),
			() => this.tryLastTimeEndpoint(gpsPosition),
			() => this.trySummaryEndpoint(gpsPosition)
		];

		const { devices, firstError } = await this.tryStrategies(strategies);
		if (devices) return { devices, error: null, source: 'kismet' };

		logWarn(`Returning 0 devices (error: ${firstError || 'none'})`);
		return { devices: [], error: firstError, source: firstError ? 'fallback' : 'kismet' };
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

	/** Compute deterministic distance from signal strength */
	private static signalToDistance(signalDbm: number, mac: string): number {
		const quantized = Math.round(signalDbm / 10) * 10;
		const clamped = Math.max(-100, Math.min(-20, quantized));
		const signalNorm = (clamped + 100) / 80;
		const variation = this.hashMAC2(mac) * 0.3;
		const baseDist = 20 + (1 - signalNorm) * 180;
		return baseDist * (0.85 + variation);
	}

	/** Offset GPS position by angle and distance (haversine approximation) */
	private static offsetGps(
		gps: GPSPosition,
		angle: number,
		dist: number
	): { lat: number; lon: number } {
		const R = 6371000;
		const dLat = ((dist * Math.cos(angle)) / R) * (180 / Math.PI);
		const dLon =
			((dist * Math.sin(angle)) / (R * Math.cos((gps.latitude * Math.PI) / 180))) *
			(180 / Math.PI);
		return { lat: gps.latitude + dLat, lon: gps.longitude + dLon };
	}

	/** Resolve device location, falling back to GPS with signal-aware offset */
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
			const dist = this.signalToDistance(signalDbm, mac);
			return this.offsetGps(gpsPosition, angle, dist);
		}
		return { lat: 0, lon: 0 };
	}

	/** Bound resolveLocation for use by transform helpers */
	private static readonly locationResolver = (
		lat: number | undefined,
		lon: number | undefined,
		gps: GPSPosition | null,
		mac: string,
		signal: number
	) => KismetService.resolveLocation(lat, lon, gps, mac, signal);

	private static transformKismetDevices(
		kismetDevices: unknown[],
		gpsPosition: GPSPosition | null
	): KismetDevice[] {
		const validatedDevices: KismetDevice[] = [];
		for (const device of kismetDevices) {
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
				continue;
			}
			validatedDevices.push(
				buildSimplifiedDevice(validated, gpsPosition, this.locationResolver)
			);
		}
		return validatedDevices;
	}

	private static transformRawKismetDevices(
		rawDevices: unknown[],
		gpsPosition: GPSPosition | null
	): KismetDevice[] {
		const validatedDevices: KismetDevice[] = [];
		for (const device of rawDevices) {
			const validated = safeParseWithHandling(RawKismetDeviceSchema, device, 'background');
			if (!validated) {
				logError(
					'Invalid raw Kismet device',
					{ device },
					'raw-kismet-device-validation-failed'
				);
				continue;
			}
			validatedDevices.push(buildRawDevice(validated, gpsPosition, this.locationResolver));
		}
		return validatedDevices;
	}
}
