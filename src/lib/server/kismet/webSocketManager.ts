// WebSocket management for Kismet real-time data
import { WebSocket } from 'ws';
import type { WebSocketMessage, KismetDevice } from './types';
import { EventEmitter } from 'events';
import { logError, logInfo } from '$lib/utils/logger';

// Kismet API raw device data interface
interface KismetRawDevice {
	'kismet.device.base.key': string;
	'kismet.device.base.macaddr': string;
	'kismet.device.base.name'?: string;
	'kismet.device.base.manuf'?: string;
	'kismet.device.base.type'?: string;
	'kismet.device.base.channel'?: number;
	'kismet.device.base.frequency'?: number;
	'kismet.device.base.signal'?: {
		'kismet.common.signal.last_signal'?: number;
	};
	'kismet.device.base.last_time'?: number;
	'kismet.device.base.first_time'?: number;
	'kismet.device.base.packets.total'?: number;
	'kismet.device.base.packets.data'?: number;
	'kismet.device.base.crypt'?: Record<string, boolean>;
	'kismet.device.base.location'?: {
		'kismet.common.location.lat'?: number;
		'kismet.common.location.lon'?: number;
		'kismet.common.location.alt'?: number;
	};
}

// Kismet system status interface
interface KismetSystemStatus {
	'kismet.system.packets.rate'?: number;
	'kismet.system.memory.rss'?: number;
	'kismet.system.cpu.system'?: number;
	'kismet.system.timestamp.start_sec'?: number;
	'kismet.system.channels.channels'?: unknown[];
	'kismet.system.interfaces'?: unknown[];
}

// Client message interface
interface ClientMessage {
	type: string;
	events?: string[];
	filters?: {
		minSignal?: number;
		deviceTypes?: string[];
	};
}

interface CachedDevice {
	device: KismetDevice;
	lastUpdate: number;
}

interface Subscription {
	types: Set<string>;
	filters?: {
		minSignal?: number;
		deviceTypes?: string[];
	};
}

export class WebSocketManager extends EventEmitter {
	private static instance: WebSocketManager;
	private clients = new Map<WebSocket, Subscription>();
	private pollingInterval?: ReturnType<typeof setInterval>;
	private deviceCache = new Map<string, CachedDevice>();
	private lastPollTime = 0;
	private isPolling = false;

	// Configuration
	private readonly POLL_INTERVAL = 2000; // 2 seconds
	private readonly THROTTLE_INTERVAL = 500; // 500ms throttle for updates
	private readonly CACHE_EXPIRY = 300000; // 5 minutes
	private readonly KISMET_API_URL = process.env.KISMET_API_URL || 'http://localhost:2501';
	private readonly KISMET_API_KEY = process.env.KISMET_API_KEY || '';

	// Throttle management
	private updateThrottles = new Map<string, number>();
	private statsThrottle = 0;

	private constructor() {
		super();
		this.startPolling();

		// Cleanup stale cache periodically
		setInterval(() => this.cleanupCache(), 60000); // Every minute
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): WebSocketManager {
		if (!this.instance) {
			this.instance = new WebSocketManager();
		}
		return this.instance;
	}

	/**
	 * Start polling Kismet API
	 */
	private startPolling() {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
		}

		// Initial poll
		void this.pollKismetData();

		// Set up regular polling
		this.pollingInterval = setInterval(() => {
			void this.pollKismetData();
		}, this.POLL_INTERVAL);
	}

	/**
	 * Poll Kismet for updates
	 */
	private async pollKismetData() {
		if (this.isPolling || this.clients.size === 0) {
			return;
		}

		this.isPolling = true;
		const startTime = Date.now();

		try {
			// Fetch devices from Kismet
			const response = await fetch(
				`${this.KISMET_API_URL}/devices/last-time/${this.lastPollTime}/devices.json`,
				{
					headers: {
						KISMET: this.KISMET_API_KEY
					}
				}
			);

			if (!response.ok) {
				throw new Error(`Kismet API error: ${response.status}`);
			}

			const devices = (await response.json()) as KismetRawDevice[];

			// Process device updates
			for (const device of devices) {
				this.processDeviceUpdate(device);
			}

			// Update last poll time
			this.lastPollTime = Math.floor(startTime / 1000);

			// Emit system status if not throttled
			if (Date.now() - this.statsThrottle > this.THROTTLE_INTERVAL) {
				void this.emitSystemStatus();
				this.statsThrottle = Date.now();
			}
		} catch (error) {
			logError('Error polling Kismet:', { error });
			this.emitError('Failed to poll Kismet data');
		} finally {
			this.isPolling = false;
		}
	}

	/**
	 * Process a device update from Kismet
	 */
	private processDeviceUpdate(kismetDevice: KismetRawDevice) {
		const deviceKey = kismetDevice['kismet.device.base.key'];
		const macAddr = kismetDevice['kismet.device.base.macaddr'];

		if (!deviceKey || !macAddr) return;

		// Transform to our device format
		const device: KismetDevice = {
			mac: macAddr,
			ssid: kismetDevice['kismet.device.base.name'] || '',
			manufacturer: kismetDevice['kismet.device.base.manuf'] || 'Unknown',
			type: this.getDeviceType(kismetDevice),
			channel: kismetDevice['kismet.device.base.channel'],
			frequency: kismetDevice['kismet.device.base.frequency'],
			signal: kismetDevice['kismet.device.base.signal']?.['kismet.common.signal.last_signal'],
			lastSeen: kismetDevice['kismet.device.base.last_time']
				? new Date(kismetDevice['kismet.device.base.last_time'] * 1000).toISOString()
				: new Date().toISOString(),
			firstSeen: kismetDevice['kismet.device.base.first_time']
				? new Date(kismetDevice['kismet.device.base.first_time'] * 1000).toISOString()
				: new Date().toISOString(),
			packets: kismetDevice['kismet.device.base.packets.total'] || 0,
			dataPackets: kismetDevice['kismet.device.base.packets.data'] || 0,
			encryptionType: this.getEncryptionTypes(kismetDevice),
			location: this.getDeviceLocation(kismetDevice)
		};

		// Check if device has changed
		const cached = this.deviceCache.get(deviceKey);
		const hasChanged = !cached || this.hasDeviceChanged(cached.device, device);

		if (hasChanged) {
			// Update cache
			this.deviceCache.set(deviceKey, {
				device,
				lastUpdate: Date.now()
			});

			// Check throttle
			const lastEmit = this.updateThrottles.get(deviceKey) || 0;
			if (Date.now() - lastEmit > this.THROTTLE_INTERVAL) {
				this.emitDeviceUpdate(device);
				this.updateThrottles.set(deviceKey, Date.now());
			}
		}
	}

	/**
	 * Determine device type from Kismet data
	 */
	private getDeviceType(device: KismetRawDevice): 'AP' | 'Client' | 'Bridge' | 'Unknown' {
		const type = device['kismet.device.base.type'];
		if (type === 'Wi-Fi AP') return 'AP';
		if (type === 'Wi-Fi Client') return 'Client';
		if (type === 'Wi-Fi Bridge') return 'Bridge';
		return 'Unknown';
	}

	/**
	 * Extract encryption types
	 */
	private getEncryptionTypes(device: KismetRawDevice): string[] {
		const crypt = device['kismet.device.base.crypt'];
		const types: string[] = [];

		if (!crypt) return types;

		if (crypt['Open']) types.push('Open');
		if (crypt['WEP']) types.push('WEP');
		if (crypt['WPA']) types.push('WPA');
		if (crypt['WPA2']) types.push('WPA2');
		if (crypt['WPA3']) types.push('WPA3');

		return types;
	}

	/**
	 * Extract device location
	 */
	private getDeviceLocation(device: KismetRawDevice): KismetDevice['location'] | undefined {
		const location = device['kismet.device.base.location'];
		if (!location) return undefined;

		return {
			lat: location['kismet.common.location.lat'],
			lon: location['kismet.common.location.lon'],
			alt: location['kismet.common.location.alt']
		};
	}

	/**
	 * Check if device has changed
	 */
	private hasDeviceChanged(oldDevice: KismetDevice, newDevice: KismetDevice): boolean {
		return (
			oldDevice.signal !== newDevice.signal ||
			oldDevice.channel !== newDevice.channel ||
			oldDevice.packets !== newDevice.packets ||
			oldDevice.ssid !== newDevice.ssid ||
			oldDevice.lastSeen !== newDevice.lastSeen
		);
	}

	/**
	 * Emit device update to subscribed clients
	 */
	private emitDeviceUpdate(device: KismetDevice) {
		const message: WebSocketMessage = {
			type: 'device_update',
			data: device,
			timestamp: new Date().toISOString()
		};

		this.broadcast(message, (sub) => {
			// Check if client is subscribed to device updates
			if (!sub.types.has('device_update') && !sub.types.has('*')) {
				return false;
			}

			// Apply filters
			if (sub.filters) {
				if (
					sub.filters.minSignal &&
					device.signal &&
					device.signal < sub.filters.minSignal
				) {
					return false;
				}
				if (sub.filters.deviceTypes && !sub.filters.deviceTypes.includes(device.type)) {
					return false;
				}
			}

			return true;
		});
	}

	/**
	 * Emit system status
	 */
	private async emitSystemStatus() {
		try {
			// Get system stats from Kismet
			const response = await fetch(`${this.KISMET_API_URL}/system/status.json`, {
				headers: {
					KISMET: this.KISMET_API_KEY
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to get system status: ${response.status}`);
			}

			const status = (await response.json()) as KismetSystemStatus;

			const message: WebSocketMessage = {
				type: 'status_change',
				data: {
					devices_count: this.deviceCache.size,
					packets_rate: status['kismet.system.packets.rate'] || 0,
					memory_usage: status['kismet.system.memory.rss'] || 0,
					cpu_usage: status['kismet.system.cpu.system'] || 0,
					uptime: status['kismet.system.timestamp.start_sec']
						? Date.now() - status['kismet.system.timestamp.start_sec'] * 1000
						: 0,
					channels: status['kismet.system.channels.channels'] || [],
					interfaces: status['kismet.system.interfaces'] || []
				},
				timestamp: new Date().toISOString()
			};

			this.broadcast(message, (sub) => sub.types.has('status_change') || sub.types.has('*'));
		} catch (error) {
			logError('Error emitting system status:', { error });
		}
	}

	/**
	 * Emit error message
	 */
	private emitError(errorText: string) {
		const message: WebSocketMessage = {
			type: 'error',
			data: {
				error: errorText,
				timestamp: new Date().toISOString()
			},
			timestamp: new Date().toISOString()
		};

		this.broadcast(message);
	}

	/**
	 * Add a client WebSocket with subscription preferences
	 */
	addClient(ws: WebSocket, subscription?: Partial<Subscription>) {
		// Default subscription
		const sub: Subscription = {
			types: new Set(subscription?.types || ['device_update', 'status_change', 'alert']),
			filters: subscription?.filters
		};

		this.clients.set(ws, sub);

		ws.on('close', () => {
			this.clients.delete(ws);
			logInfo(`Client disconnected. Total clients: ${this.clients.size}`);
		});

		ws.on('error', (error) => {
			logError('Client WebSocket error:', { error });
			this.clients.delete(ws);
		});

		ws.on('message', (data: Buffer) => {
			try {
				const message = JSON.parse(data.toString()) as ClientMessage;
				this.handleClientMessage(ws, message);
			} catch (error) {
				logError('Error parsing client message:', { error });
			}
		});

		// Send initial status
		const statusMessage: WebSocketMessage = {
			type: 'status_change',
			data: {
				connected: true,
				polling_active: !!this.pollingInterval,
				clients_connected: this.clients.size,
				devices_cached: this.deviceCache.size
			},
			timestamp: new Date().toISOString()
		};

		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(statusMessage));
		}

		// Send cached devices if subscribed
		if (sub.types.has('device_update') || sub.types.has('*')) {
			this.sendCachedDevices(ws, sub);
		}

		logInfo(`Client connected. Total clients: ${this.clients.size}`);
	}

	/**
	 * Handle messages from clients
	 */
	private handleClientMessage(ws: WebSocket, message: ClientMessage) {
		const sub = this.clients.get(ws);
		if (!sub) return;

		switch (message.type) {
			case 'subscribe':
				if (message.events) {
					message.events.forEach((event: string) => sub.types.add(event));
				}
				break;

			case 'unsubscribe':
				if (message.events) {
					message.events.forEach((event: string) => sub.types.delete(event));
				}
				break;

			case 'set_filters':
				sub.filters = message.filters;
				break;

			case 'get_devices':
				this.sendCachedDevices(ws, sub);
				break;

			case 'ping':
				if (ws.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
				}
				break;
		}
	}

	/**
	 * Send cached devices to a client
	 */
	private sendCachedDevices(ws: WebSocket, sub: Subscription) {
		const devices = Array.from(this.deviceCache.values())
			.map((cached) => cached.device)
			.filter((device) => {
				if (sub.filters) {
					if (
						sub.filters.minSignal &&
						device.signal &&
						device.signal < sub.filters.minSignal
					) {
						return false;
					}
					if (sub.filters.deviceTypes && !sub.filters.deviceTypes.includes(device.type)) {
						return false;
					}
				}
				return true;
			});

		const message: WebSocketMessage = {
			type: 'device_update',
			data: {
				devices,
				total: devices.length,
				cached: true
			},
			timestamp: new Date().toISOString()
		};

		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	}

	/**
	 * Broadcast message to clients with optional filter
	 */
	private broadcast(message: WebSocketMessage, filter?: (sub: Subscription) => boolean) {
		const data = JSON.stringify(message);

		this.clients.forEach((sub, client) => {
			if (client.readyState === WebSocket.OPEN) {
				if (!filter || filter(sub)) {
					client.send(data);
				}
			}
		});
	}

	/**
	 * Clean up stale cache entries
	 */
	private cleanupCache() {
		const now = Date.now();
		const staleKeys: string[] = [];

		this.deviceCache.forEach((cached, key) => {
			if (now - cached.lastUpdate > this.CACHE_EXPIRY) {
				staleKeys.push(key);
			}
		});

		staleKeys.forEach((key) => {
			this.deviceCache.delete(key);
			this.updateThrottles.delete(key);
		});

		if (staleKeys.length > 0) {
			logInfo(`Cleaned up ${staleKeys.length} stale devices from cache`);
		}
	}

	/**
	 * Get current statistics
	 */
	getStats() {
		return {
			clients: this.clients.size,
			devices: this.deviceCache.size,
			polling: !!this.pollingInterval,
			lastPoll: this.lastPollTime
		};
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = undefined;
		}

		this.clients.forEach((_, client) => {
			client.close();
		});

		this.clients.clear();
		this.deviceCache.clear();
		this.updateThrottles.clear();
		this.removeAllListeners();
	}
}
