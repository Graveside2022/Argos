// Proxy for Kismet REST API
import { env } from '$lib/server/env';
import { logger } from '$lib/utils/logger';

import type { KismetDeviceResponse } from './kismet-proxy-transform';
import { transformDevice } from './kismet-proxy-transform';
import type { DeviceFilter, DeviceStats, KismetDevice } from './types';

interface KismetQueryRequest {
	fields: string[];
	regex?: Array<[string, string]>;
}

interface KismetSystemStatus {
	[key: string]: unknown;
}

interface KismetDatasourceResponse {
	[key: string]: unknown;
}

export class KismetProxy {
	// Read configuration from typed env module
	private static readonly KISMET_HOST = env.KISMET_HOST;
	private static readonly KISMET_PORT = String(env.KISMET_PORT);
	private static readonly API_KEY = env.KISMET_API_KEY;
	private static readonly KISMET_USER = env.KISMET_USER;
	private static readonly BASE_URL = `http://${KismetProxy.KISMET_HOST}:${KismetProxy.KISMET_PORT}`;

	private static getPassword(): string {
		if (!env.KISMET_PASSWORD) {
			throw new Error(
				'KISMET_PASSWORD environment variable must be set. See .env.example for configuration.'
			);
		}
		return env.KISMET_PASSWORD;
	}

	/** Build request headers including auth and API key */
	private static buildHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
		const auth = Buffer.from(`${this.KISMET_USER}:${this.getPassword()}`).toString('base64');
		const headers: Record<string, string> = {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/json',
			...(extraHeaders || {})
		};
		if (this.API_KEY) headers['KISMET'] = this.API_KEY;
		return headers;
	}

	/** Wrap connection refused errors with a user-friendly message */
	private static wrapConnectionError(error: unknown): never {
		if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
			throw new Error('Cannot connect to Kismet. Is it running?');
		}
		throw error;
	}

	/** Make a request to the Kismet API */
	private static async request<T = unknown>(
		endpoint: string,
		options: globalThis.RequestInit = {}
	): Promise<T> {
		const url = `${this.BASE_URL}${endpoint}`;
		// Safe: options.headers may be Headers or Record; cast to Record for spread
		const headers = this.buildHeaders((options.headers as Record<string, string>) || undefined);

		try {
			const response = await fetch(url, { ...options, headers });
			if (!response.ok) {
				throw new Error(`Kismet API error: ${response.status} ${response.statusText}`);
			}
			// Safe: Caller provides T matching the expected Kismet API response shape
			return (await response.json()) as T;
		} catch (error) {
			this.wrapConnectionError(error);
		}
	}

	/** Kismet device query fields */
	private static readonly DEVICE_FIELDS = [
		'kismet.device.base.macaddr',
		'kismet.device.base.name',
		'kismet.device.base.type',
		'kismet.device.base.channel',
		'kismet.device.base.frequency',
		'kismet.device.base.signal',
		'kismet.device.base.first_time',
		'kismet.device.base.last_time',
		'kismet.device.base.packets.total',
		'kismet.device.base.packets.data',
		'kismet.device.base.crypt',
		'kismet.device.base.location',
		'kismet.device.base.manuf',
		'dot11.device'
	];

	/** Build regex filters from DeviceFilter */
	private static buildQueryRegex(filter?: DeviceFilter): Array<[string, string]> {
		const regex: Array<[string, string]> = [];
		if (filter?.ssid) regex.push(['kismet.device.base.name', filter.ssid]);
		if (filter?.manufacturer) regex.push(['kismet.device.base.manuf', filter.manufacturer]);
		return regex;
	}

	/** Get all devices from Kismet */
	static async getDevices(filter?: DeviceFilter): Promise<KismetDevice[]> {
		try {
			const query: KismetQueryRequest = { fields: this.DEVICE_FIELDS };
			const regex = this.buildQueryRegex(filter);
			if (regex.length > 0) query.regex = regex;

			const devices = await this.request<KismetDeviceResponse[]>(
				'/devices/views/all/devices.json',
				{ method: 'POST', body: JSON.stringify(query) }
			);

			const transformed = devices.map((device) => transformDevice(device));
			return filter ? this.applyFilters(transformed, filter) : transformed;
		} catch (error) {
			logger.error('[kismet-proxy] Error fetching devices', { error: String(error) });
			throw error;
		}
	}

	/** Check if a value is within optional bounds */
	private static isInRange(
		value: number | undefined,
		min: number | undefined,
		max: number | undefined
	): boolean {
		if (value === undefined) return true;
		if (min !== undefined && value < min) return false;
		return !(max !== undefined && value > max);
	}

	/** Check if device signal is within filter bounds */
	private static matchesSignal(device: KismetDevice, filter: DeviceFilter): boolean {
		return this.isInRange(device.signalStrength, filter.minSignal, filter.maxSignal);
	}

	/** Check if device was seen within the time window */
	private static matchesRecency(device: KismetDevice, seenWithin: number): boolean {
		const lastSeenTime = new Date(device.lastSeen).getTime();
		return lastSeenTime >= Date.now() - seenWithin * 60 * 1000;
	}

	/** Check if a single device passes all filter criteria */
	private static matchesFilter(device: KismetDevice, filter: DeviceFilter): boolean {
		if (filter.type && device.type !== filter.type) return false;
		if (!this.matchesSignal(device, filter)) return false;
		return !(
			filter.seenWithin !== undefined && !this.matchesRecency(device, filter.seenWithin)
		);
	}

	/** Apply filters that can't be done via Kismet query */
	private static applyFilters(devices: KismetDevice[], filter: DeviceFilter): KismetDevice[] {
		return devices.filter((device) => this.matchesFilter(device, filter));
	}

	/** Tally encryption and manufacturer breakdowns for a single device */
	private static tallyBreakdowns(device: KismetDevice, stats: DeviceStats): void {
		if (device.encryptionType) {
			device.encryptionType.forEach((enc) => {
				stats.byEncryption[enc] = (stats.byEncryption[enc] || 0) + 1;
			});
		}
		if (device.manufacturer) {
			stats.byManufacturer[device.manufacturer] =
				(stats.byManufacturer[device.manufacturer] || 0) + 1;
		}
	}

	/** Accumulate a single device into the stats counters */
	private static accumulateDeviceStats(
		device: KismetDevice,
		stats: DeviceStats,
		fiveMinAgo: number,
		fifteenMinAgo: number
	): void {
		stats.byType[device.type]++;
		this.tallyBreakdowns(device, stats);
		const lastSeenTime = new Date(device.lastSeen).getTime();
		if (lastSeenTime > fiveMinAgo) stats.activeInLast5Min++;
		if (lastSeenTime > fifteenMinAgo) stats.activeInLast15Min++;
	}

	/** Get device statistics */
	static async getDeviceStats(): Promise<DeviceStats> {
		try {
			const devices = await this.getDevices();
			const now = Date.now();
			const fiveMinAgo = now - 5 * 60 * 1000;
			const fifteenMinAgo = now - 15 * 60 * 1000;

			const stats: DeviceStats = {
				total: devices.length,
				byType: { AP: 0, Client: 0, Bridge: 0, Unknown: 0 },
				byEncryption: {},
				byManufacturer: {},
				activeInLast5Min: 0,
				activeInLast15Min: 0,
				totalDevices: devices.length,
				accessPoints: 0,
				clients: 0,
				unknownDevices: 0,
				newDevicesLastHour: 0,
				activeDevicesLast5Min: 0,
				securityThreats: 0,
				rogueAPs: 0,
				encryptionTypes: new Map<string, number>(),
				manufacturers: new Map<string, number>(),
				channelUsage: new Map<number, number>(),
				signalStrengthDistribution: new Map<string, number>(),
				lastUpdate: new Date()
			};

			devices.forEach((device) =>
				this.accumulateDeviceStats(device, stats, fiveMinAgo, fifteenMinAgo)
			);

			return stats;
		} catch (error) {
			logger.error('[kismet-proxy] Error calculating device stats', { error: String(error) });
			throw error;
		}
	}

	/** Generic proxy method for GET requests */
	static async proxyGet(path: string): Promise<unknown> {
		return this.request(path, { method: 'GET' });
	}

	/** Generic proxy method for POST requests */
	static async proxyPost(path: string, body?: unknown): Promise<unknown> {
		return this.request(path, {
			method: 'POST',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	/** Methods that accept a request body */
	private static readonly BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

	/** Generic proxy method that handles any HTTP method */
	static async proxy(
		path: string,
		method: string,
		body?: unknown,
		headers?: Record<string, string>
	): Promise<unknown> {
		const options: globalThis.RequestInit = { method, headers };
		if (body && this.BODY_METHODS.has(method)) {
			options.body = typeof body === 'string' ? body : JSON.stringify(body);
		}
		return this.request(path, options);
	}

	/** Get Kismet system status */
	static async getSystemStatus(): Promise<KismetSystemStatus> {
		return this.request<KismetSystemStatus>('/system/status.json');
	}

	/** Get Kismet datasources */
	static async getDatasources(): Promise<KismetDatasourceResponse> {
		return this.request<KismetDatasourceResponse>('/datasource/all_sources.json');
	}

	/** Check if API key is configured */
	static isApiKeyConfigured(): boolean {
		return this.API_KEY !== '';
	}

	/** Get proxy configuration info */
	static getConfig() {
		return {
			host: this.KISMET_HOST,
			port: this.KISMET_PORT,
			baseUrl: this.BASE_URL,
			apiKeyConfigured: this.isApiKeyConfigured()
		};
	}
}
