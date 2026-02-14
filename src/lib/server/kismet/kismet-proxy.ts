// Proxy for Kismet REST API
import type { DeviceFilter, DeviceStats, KismetDevice } from './types';

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

interface _KismetLocationData {
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

	/**
	 * Make a request to the Kismet API
	 */
	private static async request<T = unknown>(
		endpoint: string,
		options: globalThis.RequestInit = {}
	): Promise<T> {
		const url = `${this.BASE_URL}${endpoint}`;

		// Create basic auth header
		const auth = Buffer.from(`${this.KISMET_USER}:${this.getPassword()}`).toString('base64');

		const headers: Record<string, string> = {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/json',
			// Safe: Type cast for dynamic data access
			// Safe: options.headers may be Headers or Record; cast to Record for spread
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

			// Safe: Caller provides T matching the expected Kismet API response shape
			return (await response.json()) as T;
		} catch (error) {
			// Safe: Error handling
			// Safe: error already narrowed by instanceof; cast is redundant but explicit
			if (error instanceof Error && (error as Error).message.includes('ECONNREFUSED')) {
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
				'kismet.device.base.manuf',
				'dot11.device'
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
				device.signalStrength !== undefined &&
				device.signalStrength < filter.minSignal
			) {
				return false;
			}

			if (
				filter.maxSignal !== undefined &&
				device.signalStrength !== undefined &&
				device.signalStrength > filter.maxSignal
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
				activeInLast15Min: 0,
				// Extended properties for comprehensive stats
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
		// Since the raw data already has the full field names as keys,
		// we can access them directly
		const type = this.mapDeviceType(raw['kismet.device.base.type']);
		const encryptionNumber = raw['kismet.device.base.crypt'];
		const manufacturer = raw['kismet.device.base.manuf'] || 'Unknown';
		// @constitutional-exemption Article-II-2.1 issue:#999 — Kismet REST API dynamic field access — external API returns untyped data
		const signalRaw = raw['kismet.device.base.signal'] as
			| number
			| Record<string, number>
			| undefined;
		// Kismet returns signal as either a plain number or an object with nested fields
		const lastSignal =
			typeof signalRaw === 'number'
				? signalRaw
				: (signalRaw?.['kismet.common.signal.last_signal'] ?? -100);
		const maxSignal =
			typeof signalRaw === 'object' && signalRaw
				? (signalRaw['kismet.common.signal.max_signal'] ?? lastSignal)
				: lastSignal;
		const minSignal =
			typeof signalRaw === 'object' && signalRaw
				? (signalRaw['kismet.common.signal.min_signal'] ?? lastSignal)
				: lastSignal;

		// Extract dot11 association data (must fetch whole dot11.device object)
		// Safe: Type cast for dynamic data access
		// Safe: Kismet raw device JSON objects use dotted key names; cast for dynamic access
		const dot11 = (raw as Record<string, unknown>)['dot11.device'] as
			| Record<string, unknown>
			| undefined;
		const mac = raw['kismet.device.base.macaddr'] || 'Unknown';
		let clients: string[] | undefined;
		let parentAP: string | undefined;

		if (dot11 && typeof dot11 === 'object') {
			// AP → clients: extract MAC keys from associated_client_map
			const clientMap = dot11['dot11.device.associated_client_map'];
			if (clientMap && typeof clientMap === 'object') {
				// Safe: Type cast for dynamic data access
				// Safe: clientMap confirmed as object via typeof check in Kismet response structure
				clients = Object.keys(clientMap as Record<string, unknown>);
				if (clients.length === 0) clients = undefined;
			}

			// Client → parent AP: last_bssid (exclude self-reference and null)
			const bssid = dot11['dot11.device.last_bssid'] as string | undefined;
			if (bssid && bssid !== '00:00:00:00:00:00' && bssid !== mac) {
				parentAP = bssid;
			}
		}

		return {
			mac,
			macaddr: mac, // Alias for mac
			ssid: raw['kismet.device.base.name'] || undefined,
			manufacturer: manufacturer,
			type,
			channel: (raw['kismet.device.base.channel'] as unknown as number) || 0,
			frequency: raw['kismet.device.base.frequency'] || 0,
			signal: { last_signal: lastSignal, max_signal: maxSignal, min_signal: minSignal },
			signalStrength: lastSignal,
			firstSeen: this.convertTimestamp(raw['kismet.device.base.first_time']),
			lastSeen: this.convertTimestamp(raw['kismet.device.base.last_time']),
			packets: raw['kismet.device.base.packets.total'] || 0,
			dataSize: raw['kismet.device.base.packets.data'] || 0,
			encryptionType: this.parseEncryptionNumber(encryptionNumber),
			encryption: this.parseEncryptionNumber(encryptionNumber), // Alias for encryptionType
			location: this.extractLocationFromRaw(raw),
			clients,
			parentAP
		};
	}

	/**
	 * Map Kismet device type to display label.
	 * Passes through ALL types Kismet reports — strips common prefixes for cleaner display.
	 */
	private static mapDeviceType(kismetType: string | undefined): KismetDevice['type'] {
		if (!kismetType) return 'Unknown';
		// Strip common Kismet prefixes for cleaner display
		if (kismetType.startsWith('Wi-Fi ')) return kismetType.slice(6);
		if (kismetType.startsWith('Bluetooth ')) return kismetType.slice(10);
		if (kismetType.startsWith('BTLE ')) return 'BLE ' + kismetType.slice(5);
		if (kismetType.startsWith('RTL433 ')) return kismetType.slice(7);
		if (kismetType.startsWith('UAV ')) return kismetType;
		return kismetType;
	}

	/**
	 * Parse encryption string to array of encryption types
	 */
	private static parseEncryptionString(encryptionStr: string | undefined): string[] {
		if (!encryptionStr || encryptionStr === 'Open') return ['Open'];

		// Split the encryption string and clean up
		const parts = encryptionStr.split(' ').filter((p) => p.length > 0);
		const uniqueParts = Array.from(new Set(parts));

		return uniqueParts.length > 0 ? uniqueParts : ['Unknown'];
	}

	/**
	 * Parse encryption number to array of encryption types
	 */
	private static parseEncryptionNumber(encryptionValue: number | string | undefined): string[] {
		if (!encryptionValue) return ['Open'];

		// Kismet can return crypt as a string like "WPA2 WPA2-PSK AES-CCMP"
		if (typeof encryptionValue === 'string') {
			const parts = encryptionValue.split(/\s+/).filter((p) => p.length > 0);
			if (parts.length === 0) return ['Open'];
			// Extract the primary encryption types (WEP, WPA, WPA2, WPA3)
			const primary = new Set<string>();
			for (const p of parts) {
				if (/wpa3|sae/i.test(p)) primary.add('WPA3');
				else if (/wpa2/i.test(p)) primary.add('WPA2');
				else if (/wpa/i.test(p)) primary.add('WPA');
				else if (/wep/i.test(p)) primary.add('WEP');
				else if (/owe/i.test(p)) primary.add('OWE');
			}
			return primary.size > 0 ? Array.from(primary) : parts;
		}

		if (encryptionValue === 0) return ['Open'];

		// Fallback: treat as bit flags
		const encryptionTypes: string[] = [];
		if (encryptionValue & 1) encryptionTypes.push('WEP');
		if (encryptionValue & 2) encryptionTypes.push('WPA');
		if (encryptionValue & 4) encryptionTypes.push('WPA2');
		if (encryptionValue & 8) encryptionTypes.push('WPA3');
		if (encryptionValue & 16) encryptionTypes.push('WPS');

		return encryptionTypes.length > 0 ? encryptionTypes : ['Open'];
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
	 * Extract location data from raw device
	 */
	private static extractLocationFromRaw(
		raw: KismetDeviceResponse
	): KismetDevice['location'] | undefined {
		// Kismet may store location in different ways
		const location = raw['kismet.device.base.location'] as
			| Record<string, number>
			| number
			| undefined;

		if (!location || location === 0) return undefined;

		if (typeof location === 'object') {
			return {
				latitude: location.lat || location['kismet.common.location.lat'] || 0,
				longitude: location.lon || location['kismet.common.location.lon'] || 0,
				accuracy: location.accuracy || 0
			};
		}

		return undefined;
	}

	/**
	 * Convert Kismet timestamp to milliseconds
	 */
	private static convertTimestamp(timestamp: number | undefined): number {
		if (!timestamp || timestamp === 0) {
			return Date.now();
		}

		// Kismet timestamps are in seconds, not milliseconds
		return timestamp * 1000;
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
