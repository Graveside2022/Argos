/**
 * Kismet API Client Service
 * Connects to the Express backend Kismet endpoints
 */

import {
	API_ENDPOINTS,
	defaultRequestOptions,
	handleResponse,
	buildQueryString,
	retryRequest,
	withTimeout,
	APIError
} from './config';

export interface KismetStatus {
	running: boolean;
	pid?: number;
	uptime?: number;
	version?: string;
	devices?: number;
	lastUpdate?: string;
}

export interface KismetDevice {
	mac: string;
	type?: 'AP' | 'CLIENT' | 'BRIDGE' | 'UNKNOWN';
	firstSeen: string;
	lastSeen: string;
	ssid?: string;
	manufacturer?: string;
	signalStrength?: number;
	signal?: number; // Alias for signalStrength
	channel?: number;
	encryption?: string[];
	frequency?: number;
	packets?: number;
	lat?: number;
	lon?: number;
	alt?: number;
	gps?: {
		lat: number;
		lon: number;
		alt?: number;
	};
	bytes?: {
		rate?: number;
		total?: number;
	};
	wps?: {
		enabled: boolean;
		locked: boolean;
		version?: string;
	};
	probes?: string[];
}

export interface KismetScript {
	name: string;
	path: string;
	description?: string;
	running?: boolean;
	pid?: number;
}

export interface KismetStats {
	totalDevices: number;
	activeDevices: number;
	packetsPerSecond: number;
	memoryUsage: number;
	cpuUsage: number;
	uptime: number;
}

export interface KismetConfig {
	interfaces: string[];
	logLevel: string;
	gpsd: {
		enabled: boolean;
		host: string;
		port: number;
	};
	channels?: string[];
	hopRate?: number;
}

export interface DeviceFilter {
	ssid?: string;
	manufacturer?: string;
	minSignal?: number;
	maxSignal?: number;
	encryption?: string;
	channel?: number;
	lastSeenMinutes?: number;
}

class KismetAPI {
	private baseUrl = API_ENDPOINTS.kismet;

	/**
	 * Get Kismet service status
	 */
	async getStatus(): Promise<KismetStatus> {
		const response = await fetch(`${this.baseUrl}/status`, {
			...defaultRequestOptions,
			method: 'GET'
		});

		return handleResponse<KismetStatus>(response);
	}

	/**
	 * Start Kismet service
	 */
	async startService(): Promise<{ success: boolean; message: string; pid?: number }> {
		const response = await retryRequest(async () => {
			const res = await fetch(`${this.baseUrl}/service/start`, {
				...defaultRequestOptions,
				method: 'POST'
			});
			return res;
		});

		return handleResponse(response);
	}

	/**
	 * Stop Kismet service
	 */
	async stopService(): Promise<{ success: boolean; message: string }> {
		const response = await fetch(`${this.baseUrl}/service/stop`, {
			...defaultRequestOptions,
			method: 'POST'
		});

		return handleResponse(response);
	}

	/**
	 * Restart Kismet service
	 */
	async restartService(): Promise<{ success: boolean; message: string; pid?: number }> {
		const response = await retryRequest(
			async () => {
				const res = await fetch(`${this.baseUrl}/service/restart`, {
					...defaultRequestOptions,
					method: 'POST'
				});
				return res;
			},
			{ delay: 2000 }
		); // Longer delay for restart

		return handleResponse(response);
	}

	/**
	 * Get all devices
	 */
	async getDevices(options?: {
		limit?: number;
		offset?: number;
		sort?: 'lastSeen' | 'firstSeen' | 'signal' | 'packets';
		order?: 'asc' | 'desc';
	}): Promise<{ devices: KismetDevice[]; total: number }> {
		const queryString = buildQueryString(options || {});
		const response = await fetch(`${this.baseUrl}/devices${queryString}`, {
			...defaultRequestOptions,
			method: 'GET'
		});

		return handleResponse(response);
	}

	/**
	 * Get device by MAC address
	 */
	async getDevice(mac: string): Promise<KismetDevice> {
		const response = await fetch(`${this.baseUrl}/devices/${encodeURIComponent(mac)}`, {
			...defaultRequestOptions,
			method: 'GET'
		});

		return handleResponse<KismetDevice>(response);
	}

	/**
	 * Search devices with filters
	 */
	async searchDevices(filter: DeviceFilter): Promise<KismetDevice[]> {
		const queryString = buildQueryString(
			filter as Record<string, string | number | boolean | null | undefined>
		);
		const response = await fetch(`${this.baseUrl}/devices/search${queryString}`, {
			...defaultRequestOptions,
			method: 'GET'
		});

		return handleResponse<KismetDevice[]>(response);
	}

	/**
	 * Get available scripts
	 */
	async getScripts(): Promise<KismetScript[]> {
		const response = await fetch(`${this.baseUrl}/scripts`, {
			...defaultRequestOptions,
			method: 'GET'
		});

		return handleResponse<KismetScript[]>(response);
	}

	/**
	 * Run a script
	 */
	async runScript(
		scriptName: string,
		args?: string[]
	): Promise<{
		success: boolean;
		message: string;
		pid?: number;
		output?: string;
	}> {
		const response = await fetch(`${this.baseUrl}/scripts/run`, {
			...defaultRequestOptions,
			method: 'POST',
			body: JSON.stringify({ script: scriptName, args })
		});

		return handleResponse(response);
	}

	/**
	 * Stop a running script
	 */
	async stopScript(scriptName: string): Promise<{ success: boolean; message: string }> {
		const response = await fetch(`${this.baseUrl}/scripts/stop`, {
			...defaultRequestOptions,
			method: 'POST',
			body: JSON.stringify({ script: scriptName })
		});

		return handleResponse(response);
	}

	/**
	 * Get Kismet statistics
	 */
	async getStats(): Promise<KismetStats> {
		const response = await withTimeout(
			fetch(`${this.baseUrl}/stats`, {
				...defaultRequestOptions,
				method: 'GET'
			}),
			3000
		);

		return handleResponse<KismetStats>(response);
	}

	/**
	 * Get Kismet configuration
	 */
	async getConfig(): Promise<KismetConfig> {
		const response = await fetch(`${this.baseUrl}/config`, {
			...defaultRequestOptions,
			method: 'GET'
		});

		return handleResponse<KismetConfig>(response);
	}

	/**
	 * Update Kismet configuration
	 */
	async updateConfig(config: Partial<KismetConfig>): Promise<{
		success: boolean;
		config: KismetConfig;
		requiresRestart?: boolean;
	}> {
		const response = await fetch(`${this.baseUrl}/config`, {
			...defaultRequestOptions,
			method: 'PUT',
			body: JSON.stringify(config)
		});

		return handleResponse(response);
	}

	/**
	 * Get Kismet logs
	 */
	async getLogs(options?: {
		lines?: number;
		level?: 'error' | 'warn' | 'info' | 'debug';
		since?: Date;
	}): Promise<{ logs: string[]; timestamp: string }> {
		const queryString = buildQueryString({
			...options,
			since: options?.since?.toISOString()
		});

		const response = await fetch(`${this.baseUrl}/logs${queryString}`, {
			...defaultRequestOptions,
			method: 'GET'
		});

		return handleResponse(response);
	}

	/**
	 * Clear device database
	 */
	async clearDevices(): Promise<{ success: boolean; message: string }> {
		const response = await fetch(`${this.baseUrl}/devices`, {
			...defaultRequestOptions,
			method: 'DELETE'
		});

		return handleResponse(response);
	}

	/**
	 * Export devices data
	 */
	async exportDevices(format: 'csv' | 'json' | 'wigle' = 'json'): Promise<Blob> {
		const response = await fetch(`${this.baseUrl}/export?format=${format}`, {
			...defaultRequestOptions,
			method: 'GET'
		});

		if (!response.ok) {
			throw new APIError(`Export failed: ${response.statusText}`, response.status);
		}

		return response.blob();
	}

	/**
	 * Get interface list
	 */
	async getInterfaces(): Promise<
		{
			name: string;
			type: string;
			hardware: string;
			active: boolean;
			monitoring: boolean;
		}[]
	> {
		const response = await fetch(`${this.baseUrl}/interfaces`, {
			...defaultRequestOptions,
			method: 'GET'
		});

		return handleResponse(response);
	}

	/**
	 * Add interface to Kismet
	 */
	async addInterface(interfaceName: string): Promise<{ success: boolean; message: string }> {
		const response = await fetch(`${this.baseUrl}/interfaces`, {
			...defaultRequestOptions,
			method: 'POST',
			body: JSON.stringify({ interface: interfaceName })
		});

		return handleResponse(response);
	}

	/**
	 * Remove interface from Kismet
	 */
	async removeInterface(interfaceName: string): Promise<{ success: boolean; message: string }> {
		const response = await fetch(
			`${this.baseUrl}/interfaces/${encodeURIComponent(interfaceName)}`,
			{
				...defaultRequestOptions,
				method: 'DELETE'
			}
		);

		return handleResponse(response);
	}

	/**
	 * Set channel hopping
	 */
	async setChannelHopping(options: {
		enabled: boolean;
		channels?: number[];
		hopRate?: number;
	}): Promise<{ success: boolean; message: string }> {
		const response = await fetch(`${this.baseUrl}/channels`, {
			...defaultRequestOptions,
			method: 'PUT',
			body: JSON.stringify(options)
		});

		return handleResponse(response);
	}

	/**
	 * Get channel usage statistics
	 */
	async getChannelStats(): Promise<
		{
			channel: number;
			frequency: number;
			devices: number;
			packets: number;
			utilization: number;
		}[]
	> {
		const response = await fetch(`${this.baseUrl}/channels/stats`, {
			...defaultRequestOptions,
			method: 'GET'
		});

		return handleResponse(response);
	}
}

// Export singleton instance
export const kismetAPI = new KismetAPI();
