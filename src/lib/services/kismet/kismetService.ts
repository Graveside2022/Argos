/**
 * Kismet Service Layer
 * High-level service for managing Kismet operations with real-time streaming
 */

import { writable, derived, get, type Readable, type Writable } from 'svelte/store';
import { kismetAPI } from '../api';
import { KismetWebSocketClient } from '../websocket/kismet';
import { WebSocketEvent as WebSocketEventEnum } from '$lib/types/enums';
import type { WebSocketEvent } from '../websocket/base';
import type {
	KismetStatus,
	KismetDevice,
	KismetScript,
	KismetStats,
	KismetConfig,
	DeviceFilter
} from '../api/kismet';

interface KismetServiceState {
	status: KismetStatus;
	devices: KismetDevice[];
	scripts: KismetScript[];
	stats: KismetStats | null;
	config: KismetConfig | null;
	filters: DeviceFilter[];
	isConnecting: boolean;
	error: string | null;
	lastUpdate: number;
}

interface ServiceControlOptions {
	autoRestart?: boolean;
	restartDelay?: number;
	maxRestartAttempts?: number;
}

class KismetService {
	private state: Writable<KismetServiceState>;
	private websocket: KismetWebSocketClient | null = null;
	private statusInterval: ReturnType<typeof setInterval> | null = null;
	private deviceInterval: ReturnType<typeof setInterval> | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;

	// Service control
	private serviceOptions: ServiceControlOptions = {
		autoRestart: true,
		restartDelay: 5000,
		maxRestartAttempts: 3
	};
	private restartAttempts = 0;

	// Public readable stores
	public readonly status: Readable<KismetStatus>;
	public readonly devices: Readable<KismetDevice[]>;
	public readonly scripts: Readable<KismetScript[]>;
	public readonly stats: Readable<KismetStats | null>;
	public readonly config: Readable<KismetConfig | null>;
	public readonly isConnecting: Readable<boolean>;
	public readonly error: Readable<string | null>;

	// Derived stores
	public readonly deviceCount: Readable<number>;
	public readonly activeDevices: Readable<KismetDevice[]>;
	public readonly apCount: Readable<number>;
	public readonly clientCount: Readable<number>;

	constructor() {
		// Initialize state
		this.state = writable<KismetServiceState>({
			status: {
				running: false,
				version: 'Unknown',
				devices: 0
			},
			devices: [],
			scripts: [],
			stats: null,
			config: null,
			filters: [],
			isConnecting: false,
			error: null,
			lastUpdate: Date.now()
		});

		// Create derived stores for public access
		this.status = derived(this.state, ($state) => $state.status);
		this.devices = derived(this.state, ($state) => $state.devices);
		this.scripts = derived(this.state, ($state) => $state.scripts);
		this.stats = derived(this.state, ($state) => $state.stats);
		this.config = derived(this.state, ($state) => $state.config);
		this.isConnecting = derived(this.state, ($state) => $state.isConnecting);
		this.error = derived(this.state, ($state) => $state.error);

		// Create additional derived stores
		this.deviceCount = derived(this.state, ($state) => $state.devices.length);
		this.activeDevices = derived(
			this.state,
			($state) =>
				$state.devices.filter(
					(d) => d.lastSeen && Date.now() - new Date(d.lastSeen).getTime() < 300000
				) // Active in last 5 min
		);
		this.apCount = derived(
			this.state,
			($state) => $state.devices.filter((d) => d.type === 'AP').length
		);
		this.clientCount = derived(
			this.state,
			($state) => $state.devices.filter((d) => d.type === 'CLIENT').length
		);
	}

	/**
	 * Initialize the service
	 */
	async initialize(): Promise<void> {
		try {
			this.updateState({ isConnecting: true, error: null });

			// Get initial status
			await this.updateStatus();

			// Load available scripts
			await this.loadScripts();

			// Setup WebSocket connection
			this.setupWebSocket();

			// Start polling
			this.startPolling();

			this.updateState({ isConnecting: false });
		} catch (error) {
			this.handleError('Failed to initialize Kismet service', error);
			this.updateState({ isConnecting: false });
		}
	}

	/**
	 * Start Kismet service
	 */
	async startService(): Promise<void> {
		try {
			this.updateState({ error: null });

			const result = await kismetAPI.startService();
			if (!result.success) {
				throw new Error(result.message);
			}

			// Wait for service to fully start
			await new Promise((resolve) => setTimeout(resolve, 3000));

			await this.updateStatus();

			// Reinitialize WebSocket after service start
			if (this.websocket) {
				void this.websocket.connect();
			}
		} catch (error) {
			this.handleError('Failed to start Kismet service', error);
			throw error;
		}
	}

	/**
	 * Stop Kismet service
	 */
	async stopService(): Promise<void> {
		try {
			const result = await kismetAPI.stopService();
			if (!result.success) {
				throw new Error(result.message);
			}

			await this.updateStatus();
		} catch (error) {
			this.handleError('Failed to stop Kismet service', error);
			throw error;
		}
	}

	/**
	 * Restart Kismet service
	 */
	async restartService(): Promise<void> {
		try {
			const result = await kismetAPI.restartService();
			if (!result.success) {
				throw new Error(result.message);
			}

			// Wait for service to restart
			await new Promise((resolve) => setTimeout(resolve, 5000));

			await this.updateStatus();

			// Reinitialize WebSocket
			if (this.websocket) {
				void this.websocket.connect();
			}
		} catch (error) {
			this.handleError('Failed to restart Kismet service', error);
			throw error;
		}
	}

	/**
	 * Get service logs
	 */
	async getLogs(lines: number = 100): Promise<string[]> {
		try {
			const result = await kismetAPI.getLogs({ lines });
			return result.logs;
		} catch (error) {
			this.handleError('Failed to get service logs', error);
			throw error;
		}
	}

	/**
	 * Execute a script
	 */
	async executeScript(scriptName: string, args?: string[]): Promise<unknown> {
		try {
			const result = await kismetAPI.runScript(scriptName, args);

			// Refresh scripts list in case status changed
			await this.loadScripts();

			return result;
		} catch (error) {
			this.handleError(`Failed to execute script ${scriptName}`, error);
			throw error;
		}
	}

	/**
	 * Apply device filters
	 */
	async applyFilters(filters: DeviceFilter[]): Promise<void> {
		try {
			this.updateState({ filters });

			// If we have a WebSocket connection, send filters through it
			if (this.websocket?.isConnected()) {
				this.websocket.send({ type: 'apply_filters', filters });
			}

			// Also refresh devices with filters
			await this.updateDevices();
		} catch (error) {
			this.handleError('Failed to apply filters', error);
			throw error;
		}
	}

	/**
	 * Get filtered devices
	 */
	getFilteredDevices(): KismetDevice[] {
		const currentState = get(this.state);
		const { devices, filters } = currentState;

		if (filters.length === 0) {
			return devices;
		}

		return devices.filter((device) => {
			return filters.every((filter) => {
				// Check each filter property
				if (filter.ssid && device.ssid) {
					if (!device.ssid.toLowerCase().includes(filter.ssid.toLowerCase())) {
						return false;
					}
				}

				if (filter.manufacturer && device.manufacturer) {
					if (
						!device.manufacturer
							.toLowerCase()
							.includes(filter.manufacturer.toLowerCase())
					) {
						return false;
					}
				}

				if (filter.minSignal !== undefined && device.signalStrength !== undefined) {
					if (device.signalStrength < filter.minSignal) {
						return false;
					}
				}

				if (filter.maxSignal !== undefined && device.signalStrength !== undefined) {
					if (device.signalStrength > filter.maxSignal) {
						return false;
					}
				}

				if (filter.encryption && device.encryption) {
					if (!device.encryption.includes(filter.encryption)) {
						return false;
					}
				}

				if (filter.channel !== undefined && device.channel !== undefined) {
					if (device.channel !== filter.channel) {
						return false;
					}
				}

				if (filter.lastSeenMinutes !== undefined) {
					const lastSeenTime = new Date(device.lastSeen).getTime();
					const cutoffTime = Date.now() - filter.lastSeenMinutes * 60 * 1000;
					if (lastSeenTime < cutoffTime) {
						return false;
					}
				}

				return true;
			});
		});
	}

	/**
	 * Export devices data
	 */
	exportDevices(format: 'csv' | 'json' = 'json'): void {
		try {
			const devices = this.getFilteredDevices();
			let content: string;
			let filename: string;

			if (format === 'csv') {
				// Create CSV content
				const headers = [
					'MAC',
					'Type',
					'SSID',
					'Manufacturer',
					'Channel',
					'Signal',
					'First Seen',
					'Last Seen'
				];
				const rows = devices.map(
					(d) =>
						[
							d.mac,
							d.type,
							d.ssid || '',
							d.manufacturer || '',
							d.channel || '',
							d.signal || '',
							d.firstSeen || '',
							d.lastSeen || ''
						] as string[]
				);

				content = [headers, ...rows].map((row) => row.join(',')).join('\n');
				filename = `kismet-devices-${Date.now()}.csv`;
			} else {
				// Create JSON content
				content = JSON.stringify(devices, null, 2);
				filename = `kismet-devices-${Date.now()}.json`;
			}

			// Create download
			const blob = new Blob([content], {
				type: format === 'csv' ? 'text/csv' : 'application/json'
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			this.handleError('Failed to export devices', error);
			throw error;
		}
	}

	/**
	 * Setup WebSocket connection for real-time updates
	 */
	private setupWebSocket(): void {
		try {
			this.websocket = new KismetWebSocketClient();

			// Handle connection events
			this.websocket.on(WebSocketEventEnum.Open, () => {
				// console.info('Kismet WebSocket connected');
				this.reconnectAttempts = 0;

				// Apply any existing filters
				const currentState = get(this.state);
				if (currentState.filters.length > 0) {
					this.websocket?.send({
						command: 'apply_filters',
						filters: currentState.filters
					});
				}
			});

			this.websocket.on(WebSocketEventEnum.Close, () => {
				// console.info('Kismet WebSocket disconnected');
				void this.handleReconnect();
			});

			this.websocket.on(WebSocketEventEnum.Error, (event: WebSocketEvent) => {
				console.error('Kismet WebSocket error:', event.error);
				this.updateState({ error: event.error?.message || 'WebSocket error' });
			});

			// Note: The KismetWebSocketClient handles device updates internally
			// and updates the kismetStore directly. We'll sync with the store
			// through our polling mechanism instead of WebSocket events.

			// Connect
			void this.websocket.connect();
		} catch (error) {
			console.error('Failed to setup WebSocket:', error);
			// Don't throw - service can work without WebSocket
		}
	}

	/**
	 * Handle WebSocket reconnection
	 */
	private handleReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.updateState({
				error: 'WebSocket connection lost. Please refresh the page.'
			});
			return;
		}

		this.reconnectAttempts++;
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

		// console.info(`Reconnecting WebSocket in ${delay}ms (attempt ${this.reconnectAttempts}`);

		setTimeout(() => {
			if (this.websocket) {
				void this.websocket.connect();
			}
		}, delay);
	}

	/**
	 * Start polling for updates
	 */
	private startPolling(): void {
		// Status polling (every 5 seconds)
		this.statusInterval = setInterval(() => {
			try {
				void this.updateStatus();
			} catch (error) {
				console.error('Status polling error:', error);
			}
		}, 5000);

		// Device polling (every 10 seconds)
		this.deviceInterval = setInterval(() => {
			try {
				void this.updateDevices();
			} catch (error) {
				console.error('Device polling error:', error);
			}
		}, 10000);
	}

	/**
	 * Update service status
	 */
	private async updateStatus(): Promise<void> {
		try {
			const status = await kismetAPI.getStatus();
			this.updateState({ status, lastUpdate: Date.now() });

			// Handle service health
			if (!status.running && this.serviceOptions.autoRestart) {
				void this.handleServiceDown();
			} else {
				this.restartAttempts = 0;
			}
		} catch (error) {
			console.error('Failed to update status:', error);
		}
	}

	/**
	 * Update devices list
	 */
	private async updateDevices(): Promise<void> {
		try {
			const result = await kismetAPI.getDevices({
				limit: 1000
			});
			const devices = result.devices || [];

			this.updateState({ devices });
		} catch (error) {
			console.error('Failed to update devices:', error);
		}
	}

	/**
	 * Load available scripts
	 */
	private async loadScripts(): Promise<void> {
		try {
			const scripts = await kismetAPI.getScripts();
			this.updateState({ scripts });
		} catch (error) {
			console.error('Failed to load scripts:', error);
		}
	}

	/**
	 * Handle service down
	 */
	private handleServiceDown(): void {
		if (this.restartAttempts >= (this.serviceOptions.maxRestartAttempts || 3)) {
			this.updateState({
				error: 'Kismet service is down and auto-restart failed. Please check the service manually.'
			});
			return;
		}

		this.restartAttempts++;
		// console.info(`Attempting to restart Kismet service (attempt ${this.restartAttempts})`);

		setTimeout(() => {
			try {
				void this.startService();
			} catch (error) {
				console.error('Auto-restart failed:', error);
			}
		}, this.serviceOptions.restartDelay);
	}

	/**
	 * Update state helper
	 */
	private updateState(partial: Partial<KismetServiceState>): void {
		this.state.update((state) => ({ ...state, ...partial }));
	}

	/**
	 * Handle errors
	 */
	private handleError(message: string, error: unknown): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`${message}:`, error);
		this.updateState({ error: `${message}: ${errorMessage}` });
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		if (this.statusInterval) {
			clearInterval(this.statusInterval);
		}

		if (this.deviceInterval) {
			clearInterval(this.deviceInterval);
		}

		if (this.websocket) {
			this.websocket.disconnect();
		}
	}
}

// Export singleton instance
export const kismetService = new KismetService();
