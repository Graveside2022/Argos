/**
 * HackRF Service Layer
 * High-level service for managing HackRF operations with real-time streaming
 */

import { derived, type Readable, type Writable,writable } from 'svelte/store';

import { hackrfAPI } from '$lib/services/api';
import type {
	HackRFConfig,
	HackRFStatus,
	SignalDetection,
	SpectrumData,
	SweepResult} from '$lib/services/api/hackrf';
import type { WebSocketEvent, WebSocketEventType } from '$lib/services/websocket/base';
import { HackRFWebSocketClient } from '$lib/services/websocket/hackrf';
import { WebSocketEvent as WebSocketEventEnum } from '$lib/types/enums';
import { logWarn } from '$lib/utils/logger';

interface HackRFServiceState {
	status: HackRFStatus;
	config: HackRFConfig | null;
	sweepResults: SweepResult[];
	detectedSignals: SignalDetection[];
	spectrumData: SpectrumData | null;
	isConnecting: boolean;
	error: string | null;
	lastUpdate: number;
}

interface SweepControlOptions {
	startFreq: number;
	endFreq: number;
	binSize?: number;
	sampleRate?: number;
	gain?: number;
	amplifierEnabled?: boolean;
	cycleTime?: number;
}

interface HackRFWebSocketEvent {
	type: WebSocketEventType;
	data?: unknown;
	error?: Error | { message: string };
	timestamp: number;
}

export class HackRFService {
	private state: Writable<HackRFServiceState>;
	private websocket: HackRFWebSocketClient | null = null;
	private statusInterval: ReturnType<typeof setInterval> | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;

	// Public readable stores
	public readonly status: Readable<HackRFStatus>;
	public readonly config: Readable<HackRFConfig | null>;
	public readonly sweepResults: Readable<SweepResult[]>;
	public readonly detectedSignals: Readable<SignalDetection[]>;
	public readonly spectrumData: Readable<SpectrumData | null>;
	public readonly isConnecting: Readable<boolean>;
	public readonly error: Readable<string | null>;

	constructor() {
		// Initialize state
		this.state = writable<HackRFServiceState>({
			status: {
				connected: false,
				sweeping: false
			},
			config: null,
			sweepResults: [],
			detectedSignals: [],
			spectrumData: null,
			isConnecting: false,
			error: null,
			lastUpdate: Date.now()
		});

		// Create derived stores for public access
		this.status = derived(this.state, ($state) => $state.status);
		this.config = derived(this.state, ($state) => $state.config);
		this.sweepResults = derived(this.state, ($state) => $state.sweepResults);
		this.detectedSignals = derived(this.state, ($state) => $state.detectedSignals);
		this.spectrumData = derived(this.state, ($state) => $state.spectrumData);
		this.isConnecting = derived(this.state, ($state) => $state.isConnecting);
		this.error = derived(this.state, ($state) => $state.error);
	}

	/**
	 * Initialize the service and connect to HackRF
	 */
	async initialize(): Promise<void> {
		try {
			this.updateState({ isConnecting: true, error: null });

			// Get initial status
			await this.updateStatus();

			// Setup WebSocket connection
			this.setupWebSocket();

			// Start status polling
			this.startStatusPolling();

			this.updateState({ isConnecting: false });
		} catch (error) {
			this.handleError('Failed to initialize HackRF service', error);
			this.updateState({ isConnecting: false });
		}
	}

	/**
	 * Connect to HackRF device
	 */
	async connect(): Promise<void> {
		try {
			this.updateState({ isConnecting: true, error: null });

			const result = await hackrfAPI.connect();
			if (!result.success) {
				throw new Error(result.message);
			}

			// Update status and config after connection
			await this.updateStatus();
			await this.refreshConfig();

			this.updateState({ isConnecting: false });
		} catch (error) {
			this.handleError('Failed to connect to HackRF', error);
			this.updateState({ isConnecting: false });
			throw error;
		}
	}

	/**
	 * Disconnect from HackRF device
	 */
	async disconnect(): Promise<void> {
		try {
			const result = await hackrfAPI.disconnect();
			if (!result.success) {
				throw new Error(result.message);
			}

			await this.updateStatus();
		} catch (error) {
			this.handleError('Failed to disconnect from HackRF', error);
			throw error;
		}
	}

	/**
	 * Start frequency sweep with configuration
	 */
	async startSweep(options: SweepControlOptions): Promise<void> {
		try {
			this.updateState({ error: null });

			// Prepare config
			const config: Partial<HackRFConfig> = {
				startFreq: options.startFreq,
				endFreq: options.endFreq,
				binSize: options.binSize || 100000,
				sampleRate: options.sampleRate || 20000000,
				gain: options.gain || 20,
				amplifierEnabled: options.amplifierEnabled || false
			};

			// Send start sweep request
			const result = await hackrfAPI.startSweep(config);
			if (!result.success) {
				throw new Error(result.message);
			}

			// Clear previous results
			this.updateState({
				sweepResults: [],
				detectedSignals: [],
				spectrumData: null
			});

			await this.updateStatus();
		} catch (error) {
			this.handleError('Failed to start sweep', error);
			throw error;
		}
	}

	/**
	 * Stop frequency sweep
	 */
	async stopSweep(): Promise<void> {
		try {
			const result = await hackrfAPI.stopSweep();
			if (!result.success) {
				throw new Error(result.message);
			}

			await this.updateStatus();
		} catch (error) {
			this.handleError('Failed to stop sweep', error);
			throw error;
		}
	}

	/**
	 * Emergency stop - forcefully terminate all operations
	 */
	async emergencyStop(): Promise<void> {
		try {
			// Call emergency stop endpoint
			const response = await fetch('/api/hackrf/emergency-stop', {
				method: 'POST'
			});

			if (!response.ok) {
				throw new Error('Emergency stop failed');
			}

			await this.updateStatus();
		} catch (error) {
			this.handleError('Emergency stop failed', error);
			throw error;
		}
	}

	/**
	 * Update device configuration
	 */
	async updateConfig(config: Partial<HackRFConfig>): Promise<void> {
		try {
			const result = await hackrfAPI.updateConfig(config);
			if (!result.success) {
				throw new Error('Failed to update configuration');
			}

			this.updateState({ config: result.config });
		} catch (error) {
			this.handleError('Failed to update configuration', error);
			throw error;
		}
	}

	/**
	 * Set gain level
	 */
	async setGain(gain: number): Promise<void> {
		try {
			const result = await hackrfAPI.setGain(gain);
			if (!result.success) {
				throw new Error('Failed to set gain');
			}

			await this.refreshConfig();
		} catch (error) {
			this.handleError('Failed to set gain', error);
			throw error;
		}
	}

	/**
	 * Toggle amplifier
	 */
	async toggleAmplifier(enabled: boolean): Promise<void> {
		try {
			const result = await hackrfAPI.toggleAmplifier(enabled);
			if (!result.success) {
				throw new Error('Failed to toggle amplifier');
			}

			await this.refreshConfig();
		} catch (error) {
			this.handleError('Failed to toggle amplifier', error);
			throw error;
		}
	}

	/**
	 * Get device information
	 */
	async getDeviceInfo(): Promise<{
		serial: string;
		boardId: string;
		firmwareVersion: string;
		partId: string;
	}> {
		try {
			return await hackrfAPI.getDeviceInfo();
		} catch (error) {
			this.handleError('Failed to get device info', error);
			throw error;
		}
	}

	/**
	 * Export sweep data
	 */
	async exportData(format: 'csv' | 'json' = 'json'): Promise<void> {
		try {
			const blob = await hackrfAPI.exportData(format);

			// Create download link
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `hackrf-sweep-${Date.now()}.${format}`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			this.handleError('Failed to export data', error);
			throw error;
		}
	}

	/**
	 * Setup WebSocket connection for real-time data
	 */
	private setupWebSocket(): void {
		try {
			this.websocket = new HackRFWebSocketClient();

			// Handle connection events
			this.websocket.on(WebSocketEventEnum.Open, (_event: WebSocketEvent) => {
				// HackRF WebSocket connected
				this.reconnectAttempts = 0;
			});

			this.websocket.on(WebSocketEventEnum.Close, (_event: WebSocketEvent) => {
				// HackRF WebSocket disconnected
				void this.handleReconnect();
			});

			this.websocket.on(WebSocketEventEnum.Error, (event: HackRFWebSocketEvent) => {
				// HackRF WebSocket error
				this.updateState({ error: event.error?.message || 'WebSocket error' });
			});

			// Handle data events using message handlers
			this.websocket.onMessage('status', (status: unknown) => {
				this.updateState({ status: status as HackRFStatus, lastUpdate: Date.now() });
			});

			this.websocket.onMessage('sweep_data', (data: unknown) => {
				this.updateState({ spectrumData: data as SpectrumData });
			});

			this.websocket.onMessage('signal_detected', (signal: unknown) => {
				this.state.update((state) => ({
					...state,
					detectedSignals: [
						...state.detectedSignals.slice(-99),
						signal as SignalDetection
					]
				}));
			});

			this.websocket.onMessage('config_update', (config: unknown) => {
				this.updateState({ config: config as HackRFConfig });
			});

			// Connect
			this.websocket.connect();
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			logWarn('[HackRF] WebSocket setup failed, continuing without real-time updates', {
				error: msg,
				operation: 'WebSocket.setup'
			});
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

		// Reconnecting WebSocket

		setTimeout(() => {
			if (this.websocket) {
				try {
					this.websocket.connect();
				} catch (error: unknown) {
					console.error(
						'WebSocket reconnect failed:',
						error instanceof Error ? error.message : String(error)
					);
					void this.handleReconnect();
				}
			}
		}, delay);
	}

	/**
	 * Start status polling
	 */
	private startStatusPolling(): void {
		this.statusInterval = setInterval(() => {
			void this.updateStatus().catch((error: unknown) => {
				const msg = error instanceof Error ? error.message : String(error);
				logWarn('[HackRF] Status poll failed', { error: msg }, 'hackrf-poll');
			});
		}, 5000);
	}

	/**
	 * Update current status
	 */
	private async updateStatus(): Promise<void> {
		try {
			const status = await hackrfAPI.getStatus();
			this.updateState({ status, lastUpdate: Date.now() });
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			logWarn(
				'[HackRF] Status update failed',
				{ error: msg, operation: 'status.poll' },
				'hackrf-status-poll'
			);
		}
	}

	/**
	 * Refresh current configuration from server
	 */
	private async refreshConfig(): Promise<void> {
		try {
			const config = await hackrfAPI.getConfig();
			this.updateState({ config });
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			logWarn('[HackRF] Config refresh failed', { error: msg, operation: 'config.refresh' });
		}
	}

	/**
	 * Update state helper
	 */
	private updateState(partial: Partial<HackRFServiceState>): void {
		this.state.update((state) => ({ ...state, ...partial }));
	}

	/**
	 * Handle errors
	 */
	private handleError(message: string, error: unknown): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		// Error logged
		this.updateState({ error: `${message}: ${errorMessage}` });
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		if (this.statusInterval) {
			clearInterval(this.statusInterval);
		}

		if (this.websocket) {
			this.websocket.disconnect();
		}
	}
}

// Export singleton instance
export const hackrfService = new HackRFService();
