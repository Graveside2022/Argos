import { BaseWebSocket, type BaseWebSocketConfig } from './base';
import {
	updateSpectrumData,
	updateSweepStatus,
	updateConnectionStatus,
	updateCycleStatus,
	updateEmergencyStopStatus,
	type SpectrumData,
	type SweepStatus,
	type CycleStatus,
	type DeviceInfo
} from '$lib/stores/hackrf';
import { isObject, hasProperty } from '$lib/types/validation';

export interface HackRFWebSocketConfig extends BaseWebSocketConfig {
	bufferSize?: number;
	enableCompression?: boolean;
}

export interface HackRFMessage {
	type: string;
	data?: unknown;
	timestamp?: number;
	sequence?: number;
}

// Type guards for validating unknown data
function isSpectrumData(data: unknown): data is SpectrumData {
	if (!isObject(data)) return false;

	return (
		hasProperty(data, 'frequencies') &&
		hasProperty(data, 'power') &&
		Array.isArray(data.frequencies) &&
		Array.isArray(data.power)
	);
}

function isSweepStatus(data: unknown): data is Partial<SweepStatus> {
	if (!isObject(data)) return false;

	// All properties are optional in Partial<SweepStatus>
	return (
		(!hasProperty(data, 'active') || typeof data.active === 'boolean') &&
		(!hasProperty(data, 'startFreq') || typeof data.startFreq === 'number') &&
		(!hasProperty(data, 'endFreq') || typeof data.endFreq === 'number') &&
		(!hasProperty(data, 'binSize') || typeof data.binSize === 'number') &&
		(!hasProperty(data, 'progress') || typeof data.progress === 'number')
	);
}

function isCycleStatus(data: unknown): data is Partial<CycleStatus> {
	if (!isObject(data)) return false;

	// Validate the expected properties of CycleStatus
	return (
		(!hasProperty(data, 'cycleNumber') || typeof data.cycleNumber === 'number') &&
		(!hasProperty(data, 'startTime') || typeof data.startTime === 'number') &&
		(!hasProperty(data, 'endTime') || typeof data.endTime === 'number')
	);
}

function isEmergencyStopData(data: unknown): data is { active: boolean; reason?: string } {
	if (!isObject(data)) return false;

	return (
		hasProperty(data, 'active') &&
		typeof data.active === 'boolean' &&
		(!hasProperty(data, 'reason') || typeof data.reason === 'string')
	);
}

function isDeviceStatus(data: unknown): data is { connected?: boolean; info?: unknown } {
	if (!isObject(data)) return false;

	return !hasProperty(data, 'connected') || typeof data.connected === 'boolean';
}

export class HackRFWebSocketClient extends BaseWebSocket {
	private messageBuffer: SpectrumData[] = [];
	private bufferSize: number;
	private enableCompression: boolean;
	private lastSequence = 0;

	constructor(config: Partial<HackRFWebSocketConfig> = {}) {
		const finalConfig: HackRFWebSocketConfig = {
			url: 'ws://localhost:5173/ws/hackrf',
			heartbeatInterval: 10000, // More frequent for real-time data
			...config
		};
		super(finalConfig);

		this.bufferSize = config.bufferSize || 10;
		this.enableCompression = config.enableCompression ?? true;

		// Setup message handlers
		this.setupMessageHandlers();
	}

	private setupMessageHandlers(): void {
		// Spectrum data updates
		this.onMessage('spectrum_data', (data) => {
			if (isSpectrumData(data)) {
				this.handleSpectrumData(data);
			} else {
				console.error('[HackRF] Invalid spectrum data received:', data);
			}
		});

		// Sweep status updates
		this.onMessage('sweep_status', (data) => {
			if (isSweepStatus(data)) {
				this.handleSweepStatus(data);
			} else {
				console.error('[HackRF] Invalid sweep status received:', data);
			}
		});

		// Cycle status updates
		this.onMessage('cycle_status', (data) => {
			if (isCycleStatus(data)) {
				this.handleCycleStatus(data);
			} else {
				console.error('[HackRF] Invalid cycle status received:', data);
			}
		});

		// Emergency stop updates
		this.onMessage('emergency_stop', (data) => {
			if (isEmergencyStopData(data)) {
				this.handleEmergencyStop(data);
			} else {
				console.error('[HackRF] Invalid emergency stop data received:', data);
			}
		});

		// Device status updates
		this.onMessage('device_status', (data) => {
			if (isDeviceStatus(data)) {
				this.handleDeviceStatus(data);
			} else {
				console.error('[HackRF] Invalid device status received:', data);
			}
		});

		// Error messages
		this.onMessage('error', (data) => {
			this.handleError(data);
		});

		// Heartbeat response
		this.onMessage('pong', () => {
			this.lastHeartbeat = Date.now();
		});
	}

	protected onConnected(): void {
		// console.info('[HackRF] WebSocket connected');

		updateConnectionStatus({
			connected: true,
			connecting: false,
			error: null,
			lastConnected: Date.now()
		});

		// Request initial status
		this.requestStatus();
		this.requestSweepStatus();

		// Subscribe to real-time updates
		this.subscribe(['spectrum', 'status', 'alerts']);
	}

	protected onDisconnected(): void {
		// console.info('[HackRF] WebSocket disconnected');

		updateConnectionStatus({
			connected: false,
			connecting: false
		});

		// Clear real-time data
		this.messageBuffer = [];
		updateSpectrumData(null);
	}

	protected handleIncomingMessage(data: unknown): void {
		// Base message handling is done through message handlers
		// This is for any additional processing needed
		const typedData = data as { sequence?: number };
		if (typedData.sequence !== undefined) {
			// Check for missed messages
			if (typedData.sequence > this.lastSequence + 1) {
				console.warn(
					`[HackRF] Missed ${typedData.sequence - this.lastSequence - 1} messages`
				);
			}
			this.lastSequence = typedData.sequence;
		}
	}

	protected onError(error: Error): void {
		console.error('[HackRF] WebSocket error:', error);

		updateConnectionStatus({
			error: error.message,
			lastError: error.message
		});
	}

	protected sendHeartbeat(): void {
		this.send({ type: 'ping', timestamp: Date.now() });
	}

	private handleSpectrumData(data: SpectrumData): void {
		// Add to buffer for smoothing
		this.messageBuffer.push(data);
		if (this.messageBuffer.length > this.bufferSize) {
			this.messageBuffer.shift();
		}

		// Process and update store
		const processedData = this.processSpectrumData(data);
		updateSpectrumData(processedData);
	}

	private processSpectrumData(data: SpectrumData): SpectrumData {
		// Apply any necessary processing (e.g., averaging, smoothing)
		if (this.messageBuffer.length > 1) {
			// Simple moving average for power values
			const avgPower = data.power.map((value, index) => {
				const sum = this.messageBuffer.reduce(
					(acc, buf) => acc + (buf.power[index] || 0),
					0
				);
				return sum / this.messageBuffer.length;
			});

			return {
				...data,
				power: avgPower,
				processed: true
			};
		}

		return data;
	}

	private handleSweepStatus(status: Partial<SweepStatus>): void {
		updateSweepStatus(status);
	}

	private handleCycleStatus(status: Partial<CycleStatus>): void {
		updateCycleStatus(status);
	}

	private handleEmergencyStop(data: { active: boolean; reason?: string }): void {
		updateEmergencyStopStatus({
			active: data.active,
			reason: data.reason,
			timestamp: Date.now()
		});
	}

	private handleDeviceStatus(status: { connected?: boolean; info?: unknown }): void {
		updateConnectionStatus({
			deviceConnected: status.connected,
			deviceInfo: status.info as DeviceInfo | undefined
		});
	}

	private handleError(error: unknown): void {
		console.error('[HackRF] Server error:', error);

		const errorMessage =
			error && typeof error === 'object' && 'message' in error
				? (error as { message: string }).message
				: 'Unknown error';

		updateConnectionStatus({
			error: errorMessage,
			lastError: errorMessage
		});
	}

	// Public API methods

	/**
	 * Start a frequency sweep
	 */
	startSweep(config?: {
		startFreq?: number;
		endFreq?: number;
		binSize?: number;
		gain?: number;
		sampleRate?: number;
	}): void {
		this.send({
			type: 'start_sweep',
			config
		});
	}

	/**
	 * Stop the current sweep
	 */
	stopSweep(): void {
		this.send({ type: 'stop_sweep' });
	}

	/**
	 * Trigger emergency stop
	 */
	emergencyStop(reason?: string): void {
		this.send({
			type: 'emergency_stop',
			reason
		});
	}

	/**
	 * Request current status
	 */
	requestStatus(): void {
		this.send({ type: 'request_status' });
	}

	/**
	 * Request sweep status
	 */
	requestSweepStatus(): void {
		this.send({ type: 'request_sweep_status' });
	}

	/**
	 * Subscribe to specific data streams
	 */
	subscribe(streams: string[]): void {
		this.send({
			type: 'subscribe',
			streams
		});
	}

	/**
	 * Unsubscribe from data streams
	 */
	unsubscribe(streams: string[]): void {
		this.send({
			type: 'unsubscribe',
			streams
		});
	}

	/**
	 * Set data compression
	 */
	setCompression(enabled: boolean): void {
		this.enableCompression = enabled;
		this.send({
			type: 'set_compression',
			enabled
		});
	}

	/**
	 * Set buffer size
	 */
	setBufferSize(size: number): void {
		this.bufferSize = Math.max(1, Math.min(100, size));
		// Trim buffer if needed
		while (this.messageBuffer.length > this.bufferSize) {
			this.messageBuffer.shift();
		}
	}

	/**
	 * Get current buffer size
	 */
	getBufferSize(): number {
		return this.bufferSize;
	}

	/**
	 * Clear the message buffer
	 */
	clearBuffer(): void {
		this.messageBuffer = [];
	}
}

// Singleton instance management
let clientInstance: HackRFWebSocketClient | null = null;

export function getHackRFWebSocketClient(config?: HackRFWebSocketConfig): HackRFWebSocketClient {
	if (!clientInstance) {
		clientInstance = new HackRFWebSocketClient(config);
	}
	return clientInstance;
}

export function destroyHackRFWebSocketClient(): void {
	if (clientInstance) {
		clientInstance.destroy();
		clientInstance = null;
	}
}
