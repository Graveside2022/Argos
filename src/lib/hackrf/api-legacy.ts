import type { HackRFStatus } from '$lib/api/hackrf';
import { updateConnectionStatus, updateEmergencyStopStatus } from '$lib/hackrf/stores';
import { logDebug, logError, logInfo, logWarn } from '$lib/utils/logger';

import { registerStreamListeners } from './api-legacy-stream';

export class HackRFAPI {
	eventSource: EventSource | null = null;
	reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	lastDataTimestamp: number = 0;
	connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
	reconnectAttempts: number = 0;
	maxReconnectAttempts: number = 10;
	isReconnecting: boolean = false;
	visibilityHandler: (() => void) | null = null;

	// Store listener references for proper cleanup (prevents memory leaks)
	private eventListeners: Map<string, (event: MessageEvent) => void> = new Map();

	/**
	 * Add event listener with automatic cleanup tracking
	 */
	addTrackedListener(eventName: string, handler: (event: MessageEvent) => void): void {
		if (!this.eventSource) return;
		this.eventSource.addEventListener(eventName, handler);
		this.eventListeners.set(eventName, handler);
	}

	async getStatus(): Promise<HackRFStatus> {
		const response = await fetch('/api/hackrf/status');
		if (!response.ok) throw new Error('Failed to get status');
		return response.json() as Promise<HackRFStatus>;
	}

	async startSweep(
		frequencies: Array<{ start: number; stop: number; step: number }>,
		cycleTime: number
	): Promise<{ message: string }> {
		const response = await fetch('/api/hackrf/start-sweep', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ frequencies, cycleTime })
		});
		if (!response.ok) throw new Error('Failed to start sweep');
		this.connectToDataStream();
		return response.json() as Promise<{ message: string }>;
	}

	async stopSweep(): Promise<{ message: string }> {
		this.disconnectDataStream();
		const response = await fetch('/api/hackrf/stop-sweep', { method: 'POST' });
		if (!response.ok) throw new Error('Failed to stop sweep');
		return response.json() as Promise<{ message: string }>;
	}

	async emergencyStop(): Promise<{ message: string }> {
		const response = await fetch('/api/hackrf/emergency-stop', { method: 'POST' });
		if (!response.ok) throw new Error('Failed to emergency stop');
		updateEmergencyStopStatus({ isActive: true, timestamp: Date.now() });
		return response.json() as Promise<{ message: string }>;
	}

	connectToDataStream(): void {
		if (this.isReconnecting) {
			logDebug('[HackRFAPI] Already reconnecting, skipping...');
			return;
		}

		if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
			logDebug('[HackRFAPI] Closing existing connection before reconnecting...');
			this.eventSource.close();
			this.eventSource = null;
		}

		logDebug('[HackRFAPI] Connecting to data stream...');
		this.eventSource = new EventSource('/api/hackrf/data-stream');
		this.eventListeners.clear();

		// Register all SSE event listeners (extracted to api-legacy-stream.ts)
		registerStreamListeners(this);

		this.eventSource.onerror = (_error) => {
			logError('[HackRFAPI] EventSource error:', { error: _error });
			this.reconnectAttempts++;

			if (this.reconnectAttempts >= this.maxReconnectAttempts) {
				logError('[HackRFAPI] Max reconnection attempts reached');
				updateConnectionStatus({
					isConnected: false,
					isConnecting: false,
					error: 'Connection lost - please refresh page'
				});
				this.disconnectDataStream();
				return;
			}

			updateConnectionStatus({
				isConnected: false,
				isConnecting: true,
				error: `Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
			});

			const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer);
			}
			this.isReconnecting = true;
			this.reconnectTimer = setTimeout(() => {
				logInfo(`[HackRFAPI] Reconnecting after ${backoffDelay}ms delay...`);
				this.isReconnecting = false;
				this.connectToDataStream();
				this.reconnectTimer = null;
			}, backoffDelay);
		};
	}

	disconnectDataStream(): void {
		logDebug('[HackRFAPI] Disconnecting data stream');
		this.stopConnectionMonitoring();
		this.cleanupVisibilityHandler();

		if (this.eventSource) {
			this.eventListeners.forEach((handler, eventName) => {
				this.eventSource?.removeEventListener(eventName, handler);
			});
			this.eventListeners.clear();
			this.eventSource.close();
			this.eventSource = null;
		}

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.isReconnecting = false;
		this.reconnectAttempts = 0;
		this.lastDataTimestamp = 0;
	}

	startConnectionMonitoring(): void {
		this.stopConnectionMonitoring();
		this.connectionCheckInterval = setInterval(() => {
			const timeSinceLastData = Date.now() - this.lastDataTimestamp;
			if (timeSinceLastData > 90000) {
				logWarn(
					`[HackRFAPI] No data received for ${Math.floor(timeSinceLastData / 1000)} seconds, connection may be stale`
				);
				if (!this.isReconnecting) {
					updateConnectionStatus({
						isConnected: true,
						isConnecting: false,
						error: 'Connection stale - attempting to reconnect...'
					});
					logInfo('[HackRFAPI] Forcing reconnection due to stale connection');
					if (this.eventSource) {
						this.eventSource.close();
						this.eventSource = null;
					}
					this.isReconnecting = false;
					this.connectToDataStream();
				}
			}
		}, 30000);
	}

	private stopConnectionMonitoring(): void {
		if (this.connectionCheckInterval) {
			clearInterval(this.connectionCheckInterval);
			this.connectionCheckInterval = null;
		}
	}

	setupVisibilityHandler(): void {
		if (this.visibilityHandler && typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', this.visibilityHandler);
		}

		if (typeof document !== 'undefined') {
			this.visibilityHandler = () => {
				if (document.hidden) {
					logDebug('[HackRFAPI] Tab became hidden, pausing connection monitoring');
					this.stopConnectionMonitoring();
				} else {
					logDebug('[HackRFAPI] Tab became visible, resuming connection monitoring');
					this.lastDataTimestamp = Date.now();
					this.startConnectionMonitoring();
					if (this.eventSource?.readyState !== EventSource.OPEN) {
						logInfo(
							'[HackRFAPI] Connection lost while tab was hidden, reconnecting...'
						);
						this.connectToDataStream();
					}
				}
			};
			document.addEventListener('visibilitychange', this.visibilityHandler);
		}
	}

	private cleanupVisibilityHandler(): void {
		if (this.visibilityHandler && typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', this.visibilityHandler);
			this.visibilityHandler = null;
		}
	}

	disconnect(): void {
		this.disconnectDataStream();
		this.cleanupVisibilityHandler();
		updateConnectionStatus({ isConnected: false, isConnecting: false, error: null });
	}

	reconnect(): void {
		logInfo('[HackRFAPI] Manual reconnect requested');
		this.reconnectAttempts = 0;
		this.isReconnecting = false;
		this.lastDataTimestamp = Date.now();
		this.disconnectDataStream();
		setTimeout(() => {
			this.connectToDataStream();
		}, 100);
	}
}

export const hackrfAPI = new HackRFAPI();
