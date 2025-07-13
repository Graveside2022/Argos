// Proxy for Kismet REST API
import type { KismetDevice, DeviceFilter, DeviceStats } from './types';

// Kismet API response types
interface KismetDeviceResponse {
	'kismet.device.base.macaddr'?: string;
	'kismet.device.base.name'?: string;
	'kismet.device.base.type'?: string;
	'kismet.device.base.channel'?: number;
	'kismet.device.base.frequency'?: number;
	'kismet.device.base.signal'?: number;
	'kismet.device.base.first_time'?: number;
	'kismet.device.base.last_time'?: number;
	'kismet.device.base.packets.total'?: number;
	'kismet.device.base.packets.data'?: number;
	'kismet.device.base.crypt'?: number;
	'kismet.device.base.location'?: {
		lat?: number;
		lon?: number;
		alt?: number;
	};
	'kismet.device.base.manuf'?: string;
}

interface KismetLocationData {
	lat?: number;
	lon?: number;
	alt?: number;
}

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
	private static readonly KISMET_PASSWORD = process.env.KISMET_PASSWORD || 'admin';
	private static readonly BASE_URL = `http://${KismetProxy.KISMET_HOST}:${KismetProxy.KISMET_PORT}`;

	/**
	 * Make a request to the Kismet API
	 */
	private static async request<T = unknown>(
		endpoint: string,
		options: globalThis.RequestInit = {}
	): Promise<T> {
		const url = `${this.BASE_URL}${endpoint}`;

		// Create basic auth header
		const auth = Buffer.from(`${this.KISMET_USER}:${this.KISMET_PASSWORD}`).toString('base64');

		const headers: Record<string, string> = {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/json',
			...((options.headers as Record<string, string>) || {})
		};

		// If API key is provided, add it as well
		if (this.API_KEY) {
			headers['KISMET'] = this.API_KEY;
		}

		try {
			const response = await fetch(url, {
				...options,
				headers
			});

			if (!response.ok) {
				throw new Error(`Kismet API error: ${response.status} ${response.statusText}`);
			}

			return (await response.json()) as T;
		} catch (error) {
			if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
				throw new Error('Cannot connect to Kismet. Is it running?');
			}
			throw error;
		}
	}

	/**
	 * Get all devices from Kismet
	 */
	static async getDevices(filter?: DeviceFilter): Promise<KismetDevice[]> {
		try {
			// Kismet uses a specific JSON command structure for queries
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
				'kismet.device.base.manuf'
			];

			// Build the JSON query
			const query: KismetQueryRequest = { fields };

			// Add filters if provided
			const regex: Array<[string, string]> = [];

			if (filter?.ssid) {
				regex.push(['kismet.device.base.name', filter.ssid]);
			}

			if (filter?.manufacturer) {
				regex.push(['kismet.device.base.manuf', filter.manufacturer]);
			}

			if (regex.length > 0) {
				query.regex = regex;
			}

			// Use the actual Kismet endpoint
			const devices = await this.request<KismetDeviceResponse[]>(
				'/devices/views/all/devices.json',
				{
					method: 'POST',
					body: JSON.stringify(query)
				}
			);

			// Transform and filter the devices
			let transformedDevices = devices.map((device) => this.transformDevice(device));

			// Apply additional filters that can't be done via Kismet query
			if (filter) {
				transformedDevices = this.applyFilters(transformedDevices, filter);
			}

			return transformedDevices;
		} catch (error) {
			console.error('Error fetching devices:', error);
			throw error;
		}
	}

	/**
	 * Apply filters that can't be done via Kismet query
	 */
	private static applyFilters(devices: KismetDevice[], filter: DeviceFilter): KismetDevice[] {
		return devices.filter((device) => {
			// Filter by type
			if (filter.type && device.type !== filter.type) {
				return false;
			}

			// Filter by signal strength
			if (
				filter.minSignal !== undefined &&
				device.signal !== undefined &&
				device.signal < filter.minSignal
			) {
				return false;
			}

			if (
				filter.maxSignal !== undefined &&
				device.signal !== undefined &&
				device.signal > filter.maxSignal
			) {
				return false;
			}

			// Filter by last seen time
			if (filter.seenWithin !== undefined) {
				const lastSeenTime = new Date(device.lastSeen).getTime();
				const cutoffTime = Date.now() - filter.seenWithin * 60 * 1000;
				if (lastSeenTime < cutoffTime) {
					return false;
				}
			}

			return true;
		});
	}

	/**
	 * Get device statistics
	 */
	static async getDeviceStats(): Promise<DeviceStats> {
		try {
			const devices = await this.getDevices();
			const now = Date.now();
			const fiveMinAgo = now - 5 * 60 * 1000;
			const fifteenMinAgo = now - 15 * 60 * 1000;

			const stats: DeviceStats = {
				total: devices.length,
				byType: {
					AP: 0,
					Client: 0,
					Bridge: 0,
					Unknown: 0
				},
				byEncryption: {},
				byManufacturer: {},
				activeInLast5Min: 0,
				activeInLast15Min: 0
			};

			devices.forEach((device) => {
				// Count by type
				stats.byType[device.type]++;

				// Count by encryption
				if (device.encryptionType) {
					device.encryptionType.forEach((enc) => {
						stats.byEncryption[enc] = (stats.byEncryption[enc] || 0) + 1;
					});
				}

				// Count by manufacturer
				if (device.manufacturer) {
					stats.byManufacturer[device.manufacturer] =
						(stats.byManufacturer[device.manufacturer] || 0) + 1;
				}

				// Count active devices
				const lastSeenTime = new Date(device.lastSeen).getTime();
				if (lastSeenTime > fiveMinAgo) {
					stats.activeInLast5Min++;
				}
				if (lastSeenTime > fifteenMinAgo) {
					stats.activeInLast15Min++;
				}
			});

			return stats;
		} catch (error) {
			console.error('Error calculating device stats:', error);
			throw error;
		}
	}

	/**
	 * Transform raw Kismet device data to our format
	 */
	private static transformDevice(raw: KismetDeviceResponse): KismetDevice {
		const getNestedValue = (obj: KismetDeviceResponse, path: string): unknown => {
			return path.split('.').reduce((acc: unknown, part: string) => {
				if (acc && typeof acc === 'object' && part in acc) {
					return (acc as Record<string, unknown>)[part];
				}
				return undefined;
			}, obj);
		};

		const type = this.mapDeviceType(getNestedValue(raw, 'kismet.device.base.type') as string);
		const encryptionBitmask = getNestedValue(raw, 'kismet.device.base.crypt') as number;
		const manufacturer = getNestedValue(raw, 'kismet.device.base.manuf') as string;

		return {
			mac: (getNestedValue(raw, 'kismet.device.base.macaddr') as string) || 'Unknown',
			ssid: getNestedValue(raw, 'kismet.device.base.name') as string,
			manufacturer:
				manufacturer ||
				this.extractManufacturer(
					(getNestedValue(raw, 'kismet.device.base.macaddr') as string) || ''
				),
			type,
			channel: getNestedValue(raw, 'kismet.device.base.channel') as number,
			frequency: getNestedValue(raw, 'kismet.device.base.frequency') as number,
			signal: getNestedValue(raw, 'kismet.device.base.signal') as number,
			firstSeen: new Date(
				(getNestedValue(raw, 'kismet.device.base.first_time') as number) * 1000
			).toISOString(),
			lastSeen: new Date(
				(getNestedValue(raw, 'kismet.device.base.last_time') as number) * 1000
			).toISOString(),
			packets: (getNestedValue(raw, 'kismet.device.base.packets.total') as number) || 0,
			dataPackets: getNestedValue(raw, 'kismet.device.base.packets.data') as number,
			encryptionType: this.parseEncryption(encryptionBitmask),
			location: this.extractLocation(
				getNestedValue(raw, 'kismet.device.base.location') as KismetLocationData
			)
		};
	}

	/**
	 * Map Kismet device type to our type
	 */
	private static mapDeviceType(kismetType: string | undefined): KismetDevice['type'] {
		if (!kismetType) return 'Unknown';
		const typeMap: Record<string, KismetDevice['type']> = {
			'Wi-Fi AP': 'AP',
			'Wi-Fi Client': 'Client',
			'Wi-Fi Bridge': 'Bridge'
		};
		return typeMap[kismetType] || 'Unknown';
	}

	/**
	 * Parse encryption bitmask to array of encryption types
	 */
	private static parseEncryption(bitmask: number | undefined): string[] {
		if (!bitmask) return ['Open'];

		const encryption: string[] = [];
		// Kismet encryption flags (simplified)
		if (bitmask & 0x00000001) encryption.push('WEP');
		if (bitmask & 0x00000002) encryption.push('WPA');
		if (bitmask & 0x00000004) encryption.push('WPA2');
		if (bitmask & 0x00000008) encryption.push('WPA3');
		if (bitmask & 0x00000010) encryption.push('WPS');

		return encryption.length > 0 ? encryption : ['Unknown'];
	}

	/**
	 * Extract manufacturer from MAC address
	 */
	private static extractManufacturer(mac: string | undefined): string {
		// This would normally use an OUI database lookup
		// For now, return a placeholder
		if (!mac) return 'Unknown';
		return 'Unknown';
	}

	/**
	 * Extract location data
	 */
	private static extractLocation(
		locationData: KismetLocationData | undefined
	): KismetDevice['location'] | undefined {
		if (!locationData) return undefined;

		return {
			lat: locationData.lat,
			lon: locationData.lon,
			alt: locationData.alt
		};
	}

	/**
	 * Generic proxy method for GET requests
	 */
	static async proxyGet(path: string): Promise<unknown> {
		return this.request(path, { method: 'GET' });
	}

	/**
	 * Generic proxy method for POST requests
	 */
	static async proxyPost(path: string, body?: unknown): Promise<unknown> {
		return this.request(path, {
			method: 'POST',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	/**
	 * Generic proxy method that handles any HTTP method
	 */
	static async proxy(
		path: string,
		method: string,
		body?: unknown,
		headers?: Record<string, string>
	): Promise<unknown> {
		const options: globalThis.RequestInit = {
			method,
			headers: headers
		};

		if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
			options.body = typeof body === 'string' ? body : JSON.stringify(body);
		}

		return this.request(path, options);
	}

	/**
	 * Get Kismet system status
	 */
	static async getSystemStatus(): Promise<KismetSystemStatus> {
		return this.request<KismetSystemStatus>('/system/status.json');
	}

	/**
	 * Get Kismet datasources
	 */
	static async getDatasources(): Promise<KismetDatasourceResponse> {
		return this.request<KismetDatasourceResponse>('/datasource/all_sources.json');
	}

	/**
	 * Check if API key is configured
	 */
	static isApiKeyConfigured(): boolean {
		return this.API_KEY !== '';
	}

	/**
	 * Get proxy configuration info
	 */
	static getConfig() {
		return {
			host: this.KISMET_HOST,
			port: this.KISMET_PORT,
			baseUrl: this.BASE_URL,
			apiKeyConfigured: this.isApiKeyConfigured()
		};
	}
}
