import { EventEmitter } from 'events';
import { logInfo, logError, logWarn, logDebug } from '$lib/utils/logger';
import type { KismetConfig } from './types';

/**
 * Kismet REST API client for device discovery and monitoring
 * Handles authentication, request management, and real-time event streaming
 */
export class KismetAPIClient extends EventEmitter {
	private config: KismetConfig;
	private baseUrl: string;
	private authToken: string | null = null;
	private isConnected = false;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 10;
	private reconnectDelay = 5000;
	private websocket: WebSocket | null = null;
	private eventStream: EventSource | null = null;
	private requestCache = new Map<string, { data: any; timestamp: number }>();
	private cacheTimeout = 30000; // 30 seconds

	constructor(config: KismetConfig) {
		super();
		this.config = config;
		this.baseUrl = `http://localhost:${config.restPort}`;
	}

	/**
	 * Connect to Kismet REST API
	 */
	async connect(): Promise<void> {
		try {
			logInfo('Connecting to Kismet REST API...');

			// Authenticate with Kismet
			await this.authenticate();

			// Setup event streaming
			await this.setupEventStreaming();

			this.isConnected = true;
			this.reconnectAttempts = 0;

			logInfo('Connected to Kismet REST API');
			this.emit('connected');
		} catch (error) {
			logError('Failed to connect to Kismet API', {
				error: error instanceof Error ? (error as Error).message : String(error)
			});
			this.emit('error', error);
			throw error;
		}
	}

	/**
	 * Disconnect from Kismet API
	 */
	async disconnect(): Promise<void> {
		try {
			logInfo('Disconnecting from Kismet API...');

			// Close event streaming
			if (this.eventStream) {
				this.eventStream.close();
				this.eventStream = null;
			}

			if (this.websocket) {
				this.websocket.close();
				this.websocket = null;
			}

			this.isConnected = false;
			this.authToken = null;

			logInfo('Disconnected from Kismet API');
			this.emit('disconnected');
		} catch (error) {
			logError('Error during disconnect', {
				error: error instanceof Error ? (error as Error).message : String(error)
			});
		}
	}

	/**
	 * Ping Kismet server to check connectivity
	 */
	async ping(): Promise<void> {
		try {
			await this.makeRequest('GET', '/system/status.json');
		} catch (_error: unknown) {
			throw new Error('Kismet server not responding');
		}
	}

	/**
	 * Get all discovered devices
	 */
	async getDevices(): Promise<any[]> {
		try {
			const cacheKey = 'devices';
			const cached = this.getFromCache(cacheKey);

			if (cached) {
				return cached;
			}

			// Try multiple endpoints for device data
			let devices: any[] = [];

			// Method 1: Recent devices (last 5 minutes for live tactical view)
			try {
				const timestamp = Math.floor(Date.now() / 1000) - 300; // 5 minutes
				const response = await this.makeRequest(
					'GET',
					`/devices/last-time/${timestamp}/devices.json`
				);
				devices = Array.isArray(response) ? response : [];

				if (devices.length > 0) {
					this.setCache(cacheKey, devices);
					return devices;
				}
			} catch (_error: unknown) {
				logWarn('Failed to get recent devices, trying summary endpoint');
			}

			// Method 2: Device summary
			try {
				const response = await this.makeRequest('GET', '/devices/summary/devices.json');
				devices = Array.isArray(response) ? response : [];

				if (devices.length > 0) {
					this.setCache(cacheKey, devices);
					return devices;
				}
			} catch (_error: unknown) {
				logWarn('Failed to get device summary');
			}

			// Method 3: All devices
			try {
				const response = await this.makeRequest('GET', '/devices/all_devices.json');
				devices = Array.isArray(response) ? response : [];

				if (devices.length > 0) {
					this.setCache(cacheKey, devices);
					return devices;
				}
			} catch (_error: unknown) {
				logWarn('Failed to get all devices');
			}

			// Return empty array if all methods fail
			return [];
		} catch (error) {
			logError('Failed to get devices', {
				error: error instanceof Error ? (error as Error).message : String(error)
			});
			return [];
		}
	}

	/**
	 * Get device details by MAC address
	 */
	async getDeviceDetails(mac: string): Promise<any> {
		try {
			const deviceKey = mac.replace(/:/g, '');
			const response = await this.makeRequest(
				'GET',
				`/devices/by-mac/${deviceKey}/device.json`
			);
			return response;
		} catch (error) {
			logError('Failed to get device details', { mac, error: (error as Error).message });
			return null;
		}
	}

	/**
	 * Get system status
	 */
	async getSystemStatus(): Promise<any> {
		try {
			const response = await this.makeRequest('GET', '/system/status.json');
			return response;
		} catch (error) {
			logError('Failed to get system status', { error: (error as Error).message });
			return null;
		}
	}

	/**
	 * Get channel usage statistics
	 */
	async getChannelUsage(): Promise<any> {
		try {
			const response = await this.makeRequest('GET', '/channels/channels.json');
			return response;
		} catch (error) {
			logError('Failed to get channel usage', { error: (error as Error).message });
			return null;
		}
	}

	/**
	 * Get alerts from Kismet
	 */
	async getAlerts(): Promise<any[]> {
		try {
			const response = await this.makeRequest('GET', '/alerts/all_alerts.json');
			return Array.isArray(response) ? response : [];
		} catch (error) {
			logError('Failed to get alerts', { error: (error as Error).message });
			return [];
		}
	}

	/**
	 * Get GPS location data
	 */
	async getGPSLocation(): Promise<any> {
		try {
			const response = await this.makeRequest('GET', '/gps/location.json');
			return response;
		} catch (error) {
			logError('Failed to get GPS location', { error: (error as Error).message });
			return null;
		}
	}

	/**
	 * Authenticate with Kismet server
	 */
	private async authenticate(): Promise<void> {
		try {
			// For now, use basic auth or session tokens
			// In production, implement proper authentication

			const response = await this.makeRequest('GET', '/system/status.json');

			if (response) {
				logInfo('Authenticated with Kismet server');
				this.authToken = 'authenticated'; // Simplified for demo
			} else {
				throw new Error('Authentication failed');
			}
		} catch (error) {
			logError('Kismet authentication failed', { error: (error as Error).message });
			throw error;
		}
	}

	/**
	 * Setup real-time event streaming
	 */
	private async setupEventStreaming(): Promise<void> {
		try {
			// Setup EventSource for real-time updates
			this.eventStream = new EventSource(`${this.baseUrl}/eventbus/events.json`);

			this.eventStream.onopen = () => {
				logInfo('Kismet event stream connected');
				this.emit('stream_connected');
			};

			this.eventStream.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					this.handleEventStreamMessage(data);
				} catch (error) {
					logWarn('Failed to parse event stream message', {
						error: (error as Error).message
					});
				}
			};

			this.eventStream.onerror = (error) => {
				logError('Event stream error', { error });
				this.emit('stream_error', error);
				this.handleConnectionLoss();
			};
		} catch (_error: unknown) {
			logWarn('Failed to setup event streaming, using polling instead');
			this.setupPolling();
		}
	}

	/**
	 * Handle incoming event stream messages
	 */
	private handleEventStreamMessage(data: any): void {
		try {
			// Handle different event types
			switch (data.type) {
				case 'NEWDEVICE':
					this.emit('device_discovered', data.device);
					break;

				case 'UPDATEDEVICE':
					this.emit('device_updated', data.device);
					break;

				case 'LOSTDEVICE':
					this.emit('device_lost', data.device);
					break;

				case 'ALERT':
					this.emit('alert', data.alert);
					break;

				case 'PACKET':
					this.emit('packet_received', data.packet);
					break;

				default:
					logDebug('Unknown event type', { type: data.type });
			}
		} catch (error) {
			logError('Error handling event stream message', { error: (error as Error).message });
		}
	}

	/**
	 * Setup polling as fallback for event streaming
	 */
	private setupPolling(): void {
		setInterval(async () => {
			if (!this.isConnected) return;

			try {
				// Poll for device updates
				const devices = await this.getDevices();
				this.emit('devices_updated', devices);

				// Poll for alerts
				const alerts = await this.getAlerts();
				if (alerts.length > 0) {
					alerts.forEach((alert) => this.emit('alert', alert));
				}
			} catch (error) {
				logError('Polling error', { error: (error as Error).message });
			}
		}, 5000); // Poll every 5 seconds
	}

	/**
	 * Handle connection loss and attempt reconnection
	 */
	private handleConnectionLoss(): void {
		if (!this.isConnected) return;

		this.isConnected = false;
		this.emit('connection_lost');

		// Attempt reconnection
		this.attemptReconnection();
	}

	/**
	 * Attempt to reconnect to Kismet
	 */
	private async attemptReconnection(): Promise<void> {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			logError('Maximum reconnection attempts reached');
			this.emit('reconnection_failed');
			return;
		}

		this.reconnectAttempts++;
		logInfo(
			`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
		);

		await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay));

		try {
			await this.connect();
			this.emit('connection_restored');
		} catch (error) {
			logWarn('Reconnection failed', { error: (error as Error).message });
			this.attemptReconnection();
		}
	}

	/**
	 * Make HTTP request to Kismet API
	 */
	private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
		try {
			const url = `${this.baseUrl}${endpoint}`;
			const options: globalThis.RequestInit = {
				method,
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Argos-Fusion-Client/1.0'
				}
			};

			// Add authentication if available
			if (this.authToken) {
				(options.headers as Record<string, string>)['Authorization'] =
					`Bearer ${this.authToken}`;
			}

			// Add body for POST/PUT requests
			if (data && (method === 'POST' || method === 'PUT')) {
				options.body = JSON.stringify(data);
			}

			const response = await fetch(url, options);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const responseData = await response.json();
			return responseData;
		} catch (error) {
			logError('API request failed', {
				method,
				endpoint,
				error: (error as Error).message
			});
			throw error;
		}
	}

	/**
	 * Get data from cache if available and not expired
	 */
	private getFromCache(key: string): any | null {
		const cached = this.requestCache.get(key);

		if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
			return cached.data;
		}

		return null;
	}

	/**
	 * Set data in cache
	 */
	private setCache(key: string, data: any): void {
		this.requestCache.set(key, {
			data,
			timestamp: Date.now()
		});

		// Clean up expired cache entries
		this.cleanupCache();
	}

	/**
	 * Clean up expired cache entries
	 */
	private cleanupCache(): void {
		const now = Date.now();

		for (const [key, entry] of this.requestCache.entries()) {
			if (now - entry.timestamp > this.cacheTimeout) {
				this.requestCache.delete(key);
			}
		}
	}
}
