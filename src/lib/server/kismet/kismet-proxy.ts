// Proxy for Kismet REST API
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
	// Read configuration from environment variables with defaults
	private static readonly KISMET_HOST = process.env.KISMET_HOST || 'localhost';
	private static readonly KISMET_PORT = process.env.KISMET_PORT || '2501';
	private static readonly API_KEY = process.env.KISMET_API_KEY || '';
	private static readonly KISMET_USER = process.env.KISMET_USER || 'admin';
	private static readonly BASE_URL = `http://${KismetProxy.KISMET_HOST}:${KismetProxy.KISMET_PORT}`;

	private static getPassword(): string {
		const pass = process.env.KISMET_PASSWORD;
		if (!pass) {
			throw new Error(
				'KISMET_PASSWORD environment variable must be set. See .env.example for configuration.'
			);
		}
		return pass;
	}

	/** Make a request to the Kismet API */
	private static async request<T = unknown>(
		endpoint: string,
		options: globalThis.RequestInit = {}
	): Promise<T> {
		const url = `${this.BASE_URL}${endpoint}`;
		const auth = Buffer.from(`${this.KISMET_USER}:${this.getPassword()}`).toString('base64');

		const headers: Record<string, string> = {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/json',
			// Safe: options.headers may be Headers or Record; cast to Record for spread
			...((options.headers as Record<string, string>) || {})
		};

		if (this.API_KEY) {
			headers['KISMET'] = this.API_KEY;
		}

		try {
			const response = await fetch(url, { ...options, headers });

			if (!response.ok) {
				throw new Error(`Kismet API error: ${response.status} ${response.statusText}`);
			}

			// Safe: Caller provides T matching the expected Kismet API response shape
			return (await response.json()) as T;
		} catch (error) {
			// Safe: error narrowed by instanceof
			if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
				throw new Error('Cannot connect to Kismet. Is it running?');
			}
			throw error;
		}
	}

	/** Get all devices from Kismet */
	static async getDevices(filter?: DeviceFilter): Promise<KismetDevice[]> {
		try {
			const fields = [
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

			const query: KismetQueryRequest = { fields };
			const regex: Array<[string, string]> = [];

			if (filter?.ssid) regex.push(['kismet.device.base.name', filter.ssid]);
			if (filter?.manufacturer) regex.push(['kismet.device.base.manuf', filter.manufacturer]);
			if (regex.length > 0) query.regex = regex;

			const devices = await this.request<KismetDeviceResponse[]>(
				'/devices/views/all/devices.json',
				{ method: 'POST', body: JSON.stringify(query) }
			);

			let transformedDevices = devices.map((device) => transformDevice(device));
			if (filter) {
				transformedDevices = this.applyFilters(transformedDevices, filter);
			}

			return transformedDevices;
		} catch (error) {
			logger.error('[kismet-proxy] Error fetching devices', { error: String(error) });
			throw error;
		}
	}

	/** Apply filters that can't be done via Kismet query */
	private static applyFilters(devices: KismetDevice[], filter: DeviceFilter): KismetDevice[] {
		return devices.filter((device) => {
			if (filter.type && device.type !== filter.type) return false;
			if (
				filter.minSignal !== undefined &&
				device.signalStrength !== undefined &&
				device.signalStrength < filter.minSignal
			)
				return false;
			if (
				filter.maxSignal !== undefined &&
				device.signalStrength !== undefined &&
				device.signalStrength > filter.maxSignal
			)
				return false;

			if (filter.seenWithin !== undefined) {
				const lastSeenTime = new Date(device.lastSeen).getTime();
				const cutoffTime = Date.now() - filter.seenWithin * 60 * 1000;
				if (lastSeenTime < cutoffTime) return false;
			}

			return true;
		});
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

			devices.forEach((device) => {
				stats.byType[device.type]++;
				if (device.encryptionType) {
					device.encryptionType.forEach((enc) => {
						stats.byEncryption[enc] = (stats.byEncryption[enc] || 0) + 1;
					});
				}
				if (device.manufacturer) {
					stats.byManufacturer[device.manufacturer] =
						(stats.byManufacturer[device.manufacturer] || 0) + 1;
				}
				const lastSeenTime = new Date(device.lastSeen).getTime();
				if (lastSeenTime > fiveMinAgo) stats.activeInLast5Min++;
				if (lastSeenTime > fifteenMinAgo) stats.activeInLast15Min++;
			});

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

	/** Generic proxy method that handles any HTTP method */
	static async proxy(
		path: string,
		method: string,
		body?: unknown,
		headers?: Record<string, string>
	): Promise<unknown> {
		const options: globalThis.RequestInit = { method, headers };
		if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
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
