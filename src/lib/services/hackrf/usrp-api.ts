import {
	updateConnectionStatus,
	updateSweepStatus,
	updateSpectrumData,
	updateCycleStatus,
	updateEmergencyStopStatus,
	type SpectrumData
} from '$lib/stores/hackrf';
import type { HackRFStatus } from '$lib/services/api/hackrf';
import { logError, logInfo, logDebug, logWarn } from '$lib/utils/logger';
import { SystemStatus } from '$lib/types/enums';

/**
 * USRP API that maintains the same interface as HackRF API
 * This allows the UI to work without any changes
 */
export class USRPAPI {
	eventSource: EventSource | null = null;
	reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	lastDataTimestamp: number = 0;
	connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
	reconnectAttempts: number = 0;
	maxReconnectAttempts: number = 10;
	isReconnecting: boolean = false;
	visibilityHandler: (() => void) | null = null;

	async getStatus(): Promise<HackRFStatus> {
		const response = await fetch('/api/rf/status?device=usrp');
		if (!response.ok) throw new Error('Failed to get USRP status');
		return response.json() as Promise<HackRFStatus>;
	}

	async startSweep(
		frequencies: Array<{ start: number; stop: number; step: number }>,
		cycleTime: number,
		device: 'hackrf' | 'usrp' = 'hackrf'
	): Promise<{ message: string }> {
		// Use hackrf endpoint since auto_sweep.sh handles device detection
		const response = await fetch('/api/hackrf/start-sweep', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				frequencies,
				cycleTime,
				device
			})
		});

		if (!response.ok) throw new Error(`Failed to start ${device} sweep`);

		// Connect to SSE for real-time data
		this.connectToDataStream();

		return response.json() as Promise<{ message: string }>;
	}

	async stopSweep(): Promise<{ message: string }> {
		this.disconnectDataStream();

		// Use hackrf endpoint since auto_sweep.sh handles device detection
		const response = await fetch('/api/hackrf/stop-sweep', {
			method: 'POST'
		});

		if (!response.ok) throw new Error('Failed to stop USRP sweep');

		return response.json() as Promise<{ message: string }>;
	}

	async emergencyStop(): Promise<{ message: string }> {
		// Use hackrf endpoint since auto_sweep.sh handles device detection
		const response = await fetch('/api/hackrf/emergency-stop', {
			method: 'POST'
		});

		if (!response.ok) throw new Error('Failed to emergency stop USRP');

		updateEmergencyStopStatus({ active: true, timestamp: Date.now() });

		return response.json() as Promise<{ message: string }>;
	}

	connectToDataStream() {
		// Prevent multiple simultaneous reconnection attempts
		if (this.isReconnecting) {
			logDebug('[USRPAPI] Already reconnecting, skipping...');
			return;
		}

		// Close existing connection properly
		if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
			logDebug('[USRPAPI] Closing existing connection before reconnecting...');
			this.eventSource.close();
			this.eventSource = null;
		}

		logDebug('[USRPAPI] Connecting to data stream...');

		// Since auto_sweep.sh outputs through the hackrf pipeline, connect to hackrf data stream
		this.eventSource = new EventSource('/api/hackrf/data-stream');

		this.eventSource.addEventListener('connected', (_event) => {
			logInfo('[USRPAPI] Connected to data stream');
			updateConnectionStatus({ connected: true, connecting: false, error: null });
			this.lastDataTimestamp = Date.now();

			// Reset reconnection state
			this.reconnectAttempts = 0;
			this.isReconnecting = false;

			// Clear any reconnect timer
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer);
				this.reconnectTimer = null;
			}

			// Start connection health monitoring
			this.startConnectionMonitoring();

			// Handle browser tab visibility changes
			this.setupVisibilityHandler();
		});

		this.eventSource.addEventListener('sweep_data', (event) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const rawData = JSON.parse(event.data as string) as any;
			this.lastDataTimestamp = Date.now();

			// The SSE data already has the correct format, just pass it through
			const spectrumData: SpectrumData = {
				frequencies: rawData.frequencies || [],
				power: rawData.power || [],
				power_levels: rawData.power_levels || [],
				start_freq: rawData.start_freq,
				stop_freq: rawData.stop_freq,
				center_freq: rawData.center_freq,
				peak_power: rawData.peak_power,
				peak_freq: rawData.peak_freq,
				avg_power: rawData.power_levels
					? rawData.power_levels.reduce((a: number, b: number) => a + b, 0) /
						rawData.power_levels.length
					: undefined,
				centerFreq: rawData.center_freq,
				sampleRate: 20e6, // 20 MHz for USRP B205 mini
				binSize: 0.02, // 20 kHz bin width
				timestamp: new Date(rawData.timestamp).getTime(),
				sweepId: rawData.sweepId,
				processed: true
			};

			updateSpectrumData(spectrumData);
		});

		this.eventSource.addEventListener('status', (event) => {
			const status = JSON.parse(event.data as string) as {
				state?: string;
				startFrequency?: number;
				endFrequency?: number;
				currentFrequency?: number;
				sweepProgress?: number;
				totalSweeps?: number;
				completedSweeps?: number;
				cycleTime?: number;
				startTime?: number;
			};
			logDebug('[EventSource] Status event received:', { status });

			// Update sweep status
			const newStatus = {
				active:
					status.state === SystemStatus.Running || status.state === SystemStatus.Sweeping,
				startFreq: status.startFrequency || 0,
				endFreq: status.endFrequency || 0,
				currentFreq: status.currentFrequency || 0,
				progress: status.sweepProgress || 0
			};
			logDebug('[EventSource] Updating sweep status to:', { newStatus });
			updateSweepStatus(newStatus);

			// Update cycle status if cycling
			if (status.totalSweeps && status.completedSweeps !== undefined) {
				const cycleTime = status.cycleTime || 10000;
				const elapsed = status.startTime ? Date.now() - status.startTime : 0;
				const timeRemaining = Math.max(0, cycleTime - (elapsed % cycleTime));

				updateCycleStatus({
					active: true,
					currentCycle: status.completedSweeps + 1,
					totalCycles: status.totalSweeps,
					cycleTime: cycleTime,
					timeRemaining: timeRemaining,
					progress: ((elapsed % cycleTime) / cycleTime) * 100
				});
			}
		});

		this.eventSource.addEventListener('cycle_config', (event) => {
			const config = JSON.parse(event.data as string) as Record<string, unknown>;
			updateCycleStatus({
				...config,
				active: true
			});
		});

		this.eventSource.addEventListener('status_change', (event) => {
			const change = JSON.parse(event.data as string) as {
				isSweping?: boolean;
				status?: string;
			};
			logDebug('[EventSource] Status change event:', { change });
			if (change.isSweping !== undefined) {
				updateSweepStatus({ active: change.isSweping });
			}
			if (change.status === 'stopped') {
				logDebug('[EventSource] Received stopped status, setting active to false');
				updateSweepStatus({ active: false });
			}
		});

		// Heartbeat event - critical for connection health
		this.eventSource.addEventListener('heartbeat', (event) => {
			this.lastDataTimestamp = Date.now();
			const _data = JSON.parse(event.data as string) as {
				uptime: number;
				connectionId: string;
			};
			logDebug('[USRPAPI] Heartbeat received:', {
				uptime: Math.floor(_data.uptime / 1000) + 's',
				connectionId: _data.connectionId
			});
		});

		// Recovery events
		this.eventSource.addEventListener('recovery_start', (event) => {
			const recoveryData = JSON.parse(event.data as string) as {
				reason: string;
				attempt: number;
				maxAttempts: number;
			};
			updateConnectionStatus({
				connected: true,
				connecting: false,
				error: `Recovering: ${recoveryData.reason} (attempt ${recoveryData.attempt}/${recoveryData.maxAttempts})`
			});
		});

		this.eventSource.addEventListener('recovery_complete', (_event) => {
			updateConnectionStatus({
				connected: true,
				connecting: false,
				error: null
			});
		});

		this.eventSource.addEventListener('error', (_event) => {
			const errorData = { message: 'Connection error' };
			// Don't disconnect on recovery errors
			if (this.eventSource?.readyState === EventSource.CLOSED) {
				updateConnectionStatus({
					connected: false,
					connecting: false,
					error: errorData.message
				});
			}
		});

		this.eventSource.onerror = (_error) => {
			logError('[USRPAPI] EventSource error:', { error: _error });

			// Increment reconnection attempts
			this.reconnectAttempts++;

			if (this.reconnectAttempts >= this.maxReconnectAttempts) {
				logError('[USRPAPI] Max reconnection attempts reached');
				updateConnectionStatus({
					connected: false,
					connecting: false,
					error: 'Connection lost - please refresh page'
				});
				this.disconnectDataStream();
				return;
			}

			// Show reconnecting status
			updateConnectionStatus({
				connected: false,
				connecting: true,
				error: `Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
			});

			// Exponential backoff for reconnection
			const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

			// Clear existing reconnect timer
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer);
			}

			// Mark as reconnecting
			this.isReconnecting = true;

			// Attempt to reconnect after backoff delay
			this.reconnectTimer = setTimeout(() => {
				logInfo(`[USRPAPI] Reconnecting after ${backoffDelay}ms delay...`);
				// Clear reconnecting flag before attempting connection
				this.isReconnecting = false;
				this.connectToDataStream();
				this.reconnectTimer = null;
			}, backoffDelay);
		};
	}

	disconnectDataStream() {
		logDebug('[USRPAPI] Disconnecting data stream');

		// Stop monitoring first to prevent any race conditions
		this.stopConnectionMonitoring();

		// Clean up visibility handler
		this.cleanupVisibilityHandler();

		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		// Reset connection state
		this.isReconnecting = false;
		this.reconnectAttempts = 0;
		this.lastDataTimestamp = 0;
	}

	private startConnectionMonitoring() {
		this.stopConnectionMonitoring();

		// Check for data timeout every 30 seconds (less aggressive)
		this.connectionCheckInterval = setInterval(() => {
			const timeSinceLastData = Date.now() - this.lastDataTimestamp;

			// Much more lenient - 90 seconds without data (server sends heartbeat every 15s, so this allows for 6 missed heartbeats)
			if (timeSinceLastData > 90000) {
				logWarn(
					`[USRPAPI] No data received for ${Math.floor(timeSinceLastData / 1000)} seconds, connection may be stale`
				);

				// Only show stale message if not already reconnecting
				if (!this.isReconnecting) {
					updateConnectionStatus({
						connected: true,
						connecting: false,
						error: 'Connection stale - attempting to reconnect...'
					});

					// Force reconnect
					logInfo('[USRPAPI] Forcing reconnection due to stale connection');
					// Properly close and reset before reconnecting
					if (this.eventSource) {
						this.eventSource.close();
						this.eventSource = null;
					}
					// Reset reconnection state to allow new connection
					this.isReconnecting = false;
					this.connectToDataStream();
				}
			}
		}, 30000); // Check every 30 seconds (less frequent)
	}

	private stopConnectionMonitoring() {
		if (this.connectionCheckInterval) {
			clearInterval(this.connectionCheckInterval);
			this.connectionCheckInterval = null;
		}
	}

	private setupVisibilityHandler() {
		// Remove existing handler if any
		if (this.visibilityHandler && typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', this.visibilityHandler);
		}

		// Set up new handler
		if (typeof document !== 'undefined') {
			this.visibilityHandler = () => {
				if (document.hidden) {
					logDebug('[USRPAPI] Tab became hidden, pausing connection monitoring');
					this.stopConnectionMonitoring();
				} else {
					logDebug('[USRPAPI] Tab became visible, resuming connection monitoring');
					// Reset last data timestamp to prevent false stale detection
					this.lastDataTimestamp = Date.now();
					this.startConnectionMonitoring();

					// If connection was lost while hidden, try to reconnect
					if (this.eventSource?.readyState !== EventSource.OPEN) {
						logInfo('[USRPAPI] Connection lost while tab was hidden, reconnecting...');
						this.connectToDataStream();
					}
				}
			};

			document.addEventListener('visibilitychange', this.visibilityHandler);
		}
	}

	private cleanupVisibilityHandler() {
		if (this.visibilityHandler && typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', this.visibilityHandler);
			this.visibilityHandler = null;
		}
	}

	disconnect() {
		this.disconnectDataStream();
		this.cleanupVisibilityHandler();
		updateConnectionStatus({ connected: false, connecting: false, error: null });
	}

	// Manual reconnect method that resets attempts
	reconnect() {
		logInfo('[USRPAPI] Manual reconnect requested');
		// Reset all connection state
		this.reconnectAttempts = 0;
		this.isReconnecting = false;
		this.lastDataTimestamp = Date.now(); // Reset timestamp to prevent immediate stale detection
		this.disconnectDataStream();
		// Small delay to ensure clean disconnect
		setTimeout(() => {
			this.connectToDataStream();
		}, 100);
	}
}

export const usrpAPI = new USRPAPI();
