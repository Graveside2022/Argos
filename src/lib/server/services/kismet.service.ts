import { RawKismetDeviceSchema, SimplifiedKismetDeviceSchema } from '$lib/schemas/kismet';
import { errMsg } from '$lib/server/api/error-utils';
import { hasValidGpsCoords } from '$lib/server/db/geo';
import { KismetProxy } from '$lib/server/kismet/kismet-proxy';
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import { hashMAC, offsetGps, signalToDistance } from './kismet/kismet-geo-helpers';
import { buildRawDevice, buildSimplifiedDevice } from './kismet-service-transform';
import type { DevicesResponse, GPSPosition, KismetDevice } from './kismet-service-types';

// Re-export types for backward compatibility
export type { DevicesResponse, GPSPosition, KismetDevice } from './kismet-service-types';

/**
 * Service layer for Kismet device operations
 * Handles communication with Kismet server and provides fallback mechanisms
 */
export class KismetService {
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
			if (!hasValidGpsCoords(latitude, longitude)) return null;
			return { latitude: latitude!, longitude: longitude! };
		} catch (error) {
			logger.warn('Could not get GPS position', { error });
			return null;
		}
	}

	/** Try fetching devices via KismetProxy.getDevices() */
	private static async tryProxyMethod(
		gpsPosition: GPSPosition | null
	): Promise<KismetDevice[] | null> {
		logger.warn('Attempting to fetch devices from Kismet using KismetProxy...');
		const kismetDevices = await KismetProxy.getDevices();
		const devices = this.transformKismetDevices(kismetDevices, gpsPosition);
		logger.info(`Successfully fetched ${devices.length} devices from Kismet`);
		return devices;
	}

	/** Try fetching devices via last-time REST endpoint */
	private static async tryLastTimeEndpoint(
		gpsPosition: GPSPosition | null
	): Promise<KismetDevice[] | null> {
		logger.warn('Attempting direct Kismet REST API...');
		const timestamp = Math.floor(Date.now() / 1000) - 1800;
		const response = await KismetProxy.proxyGet(`/devices/last-time/${timestamp}/devices.json`);
		if (!Array.isArray(response)) return null;
		const devices = this.transformRawKismetDevices(response, gpsPosition);
		logger.info(`Fetched ${devices.length} devices via last-time endpoint`);
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
		return errMsg(err);
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
				logger.error('Kismet fetch strategy failed', { error: msg });
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

		logger.warn(`Returning 0 devices (error: ${firstError || 'none'})`);
		return { devices: [], error: firstError, source: firstError ? 'fallback' : 'kismet' };
	}

	/** Resolve device location, falling back to GPS with signal-aware offset */
	private static resolveLocation(
		deviceLat: number | undefined,
		deviceLon: number | undefined,
		gpsPosition: GPSPosition | null,
		mac: string,
		signalDbm: number
	): { lat: number; lon: number } {
		if (hasValidGpsCoords(deviceLat, deviceLon)) {
			return { lat: deviceLat!, lon: deviceLon! };
		}
		if (gpsPosition) {
			const angle = hashMAC(mac) * 2 * Math.PI;
			const dist = signalToDistance(signalDbm, mac);
			return offsetGps(gpsPosition.latitude, gpsPosition.longitude, angle, dist);
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
				logger.error(
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
				logger.error(
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
