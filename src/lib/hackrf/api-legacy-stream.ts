/**
 * EventSource stream management for HackRF SSE data stream.
 * Extracted from api-legacy.ts for constitutional compliance (Article 2.2).
 */

import type { SpectrumData } from '$lib/hackrf/stores';
import {
	updateConnectionStatus,
	updateCycleStatus,
	updateSpectrumData,
	updateSweepStatus
} from '$lib/hackrf/stores';
import { SystemStatus } from '$lib/types/enums';
import type { HackRFData } from '$lib/types/signals';
import { logDebug, logInfo, logWarn } from '$lib/utils/logger';

import type { HackRFAPI } from './api-legacy';

/**
 * Register all SSE event listeners on the given HackRFAPI instance.
 * Called when connectToDataStream establishes a new EventSource.
 */
export function registerStreamListeners(api: HackRFAPI): void {
	api.addTrackedListener('connected', (_event) => {
		logInfo('[HackRFAPI] Connected to data stream');
		updateConnectionStatus({ isConnected: true, isConnecting: false, error: null });
		api.lastDataTimestamp = Date.now();

		// Reset reconnection state
		api.reconnectAttempts = 0;
		api.isReconnecting = false;

		// Clear any reconnect timer
		if (api.reconnectTimer) {
			clearTimeout(api.reconnectTimer);
			api.reconnectTimer = null;
		}

		// Start connection health monitoring
		api.startConnectionMonitoring();

		// Handle browser tab visibility changes
		api.setupVisibilityHandler();
	});

	api.addTrackedListener('sweep_data', (event) => {
		handleSweepData(api, event);
	});

	api.addTrackedListener('status', (event) => {
		handleStatusEvent(event);
	});

	api.addTrackedListener('cycle_config', (event) => {
		handleCycleConfig(event);
	});

	api.addTrackedListener('status_change', (event) => {
		handleStatusChange(event);
	});

	api.addTrackedListener('heartbeat', (event) => {
		handleHeartbeat(api, event);
	});

	api.addTrackedListener('recovery_start', (event) => {
		handleRecoveryStart(event);
	});

	api.addTrackedListener('recovery_complete', (_event) => {
		updateConnectionStatus({
			isConnected: true,
			isConnecting: false,
			error: null
		});
	});

	api.addTrackedListener('error', (_event) => {
		const errorData = { message: 'Connection error' };
		// Don't disconnect on recovery errors
		if (api.eventSource?.readyState === EventSource.CLOSED) {
			updateConnectionStatus({
				isConnected: false,
				isConnecting: false,
				error: errorData.message
			});
		}
	});
}

/** Handle incoming sweep data SSE event */
function handleSweepData(api: HackRFAPI, event: MessageEvent): void {
	let rawData: HackRFData & {
		binData?: number[];
		metadata?: {
			frequencyRange?: { low?: number; high?: number; center?: number };
			binWidth?: number;
		};
		sweepId?: string;
	};
	try {
		// Safe: SSE MessageEvent.data is always string (not ArrayBuffer/Blob)
		rawData = JSON.parse(event.data as string);
	} catch (error) {
		logWarn('[HackRFAPI] Invalid JSON in sweep_data event', { error });
		return;
	}
	api.lastDataTimestamp = Date.now();

	// Convert SSE data format to SpectrumData format
	const spectrumData: SpectrumData = {
		frequencies: [],
		power: [],
		power_levels: rawData.binData || [],
		start_freq: rawData.metadata?.frequencyRange?.low
			? rawData.metadata.frequencyRange.low / 1e6
			: undefined,
		stop_freq: rawData.metadata?.frequencyRange?.high
			? rawData.metadata.frequencyRange.high / 1e6
			: undefined,
		center_freq: rawData.metadata?.frequencyRange?.center
			? rawData.metadata.frequencyRange.center / 1e6
			: undefined,
		peak_power: rawData.power,
		peak_freq: rawData.frequency,
		avg_power: rawData.binData
			? rawData.binData.reduce((a: number, b: number) => a + b, 0) / rawData.binData.length
			: undefined,
		centerFreq: rawData.frequency,
		sampleRate: 20e6,
		binSize: rawData.metadata?.binWidth || 0,
		timestamp: new Date(rawData.timestamp).getTime(),
		sweepId: rawData.sweepId,
		processed: true
	};

	updateSpectrumData(spectrumData);
}

/** Handle status SSE event */
function handleStatusEvent(event: MessageEvent): void {
	let status: {
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
	try {
		// Safe: SSE MessageEvent.data is always string (not ArrayBuffer/Blob)
		status = JSON.parse(event.data as string);
	} catch (error) {
		logWarn('[HackRFAPI] Invalid JSON in status event', { error });
		return;
	}
	logDebug('[EventSource] Status event received:', { status });

	const newStatus = {
		isActive: status.state === SystemStatus.Running || status.state === SystemStatus.Sweeping,
		startFreq: status.startFrequency || 0,
		endFreq: status.endFrequency || 0,
		currentFreq: status.currentFrequency || 0,
		progress: status.sweepProgress || 0
	};
	logDebug('[EventSource] Updating sweep status to:', { newStatus });
	updateSweepStatus(newStatus);

	if (status.totalSweeps && status.completedSweeps !== undefined) {
		const cycleTime = status.cycleTime || 10000;
		const elapsed = status.startTime ? Date.now() - status.startTime : 0;
		const timeRemaining = Math.max(0, cycleTime - (elapsed % cycleTime));

		updateCycleStatus({
			isActive: true,
			currentCycle: status.completedSweeps + 1,
			totalCycles: status.totalSweeps,
			cycleTime: cycleTime,
			timeRemaining: timeRemaining,
			progress: ((elapsed % cycleTime) / cycleTime) * 100
		});
	}
}

/** Handle cycle_config SSE event */
function handleCycleConfig(event: MessageEvent): void {
	let config: Record<string, unknown>;
	try {
		// Safe: SSE MessageEvent.data is always string (not ArrayBuffer/Blob)
		config = JSON.parse(event.data as string);
	} catch (error) {
		logWarn('[HackRFAPI] Invalid JSON in cycle_config event', { error });
		return;
	}
	updateCycleStatus({
		...config,
		isActive: true
	});
}

/** Handle status_change SSE event */
function handleStatusChange(event: MessageEvent): void {
	let change: {
		isSweping?: boolean;
		status?: string;
	};
	try {
		// Safe: SSE MessageEvent.data is always string (not ArrayBuffer/Blob)
		change = JSON.parse(event.data as string);
	} catch (error) {
		logWarn('[HackRFAPI] Invalid JSON in status_change event', { error });
		return;
	}
	logDebug('[EventSource] Status change event:', { change });
	if (change.isSweping !== undefined) {
		updateSweepStatus({ isActive: change.isSweping });
	}
	if (change.status === 'stopped') {
		logDebug('[EventSource] Received stopped status, setting isActive to false');
		updateSweepStatus({ isActive: false });
	}
}

/** Handle heartbeat SSE event */
function handleHeartbeat(api: HackRFAPI, event: MessageEvent): void {
	api.lastDataTimestamp = Date.now();
	let _data: {
		uptime: number;
		connectionId: string;
	};
	try {
		// Safe: SSE MessageEvent.data is always string (not ArrayBuffer/Blob)
		_data = JSON.parse(event.data as string);
	} catch (error) {
		logWarn('[HackRFAPI] Invalid JSON in heartbeat event', { error });
		return;
	}
	logDebug('[HackRFAPI] Heartbeat received:', {
		uptime: Math.floor(_data.uptime / 1000) + 's',
		connectionId: _data.connectionId
	});
}

/** Handle recovery_start SSE event */
function handleRecoveryStart(event: MessageEvent): void {
	let recoveryData: {
		reason: string;
		attempt: number;
		maxAttempts: number;
	};
	try {
		// Safe: SSE MessageEvent.data is always string (not ArrayBuffer/Blob)
		recoveryData = JSON.parse(event.data as string);
	} catch (error) {
		logWarn('[HackRFAPI] Invalid JSON in recovery_start event', { error });
		return;
	}
	updateConnectionStatus({
		isConnected: true,
		isConnecting: false,
		error: `Recovering: ${recoveryData.reason} (attempt ${recoveryData.attempt}/${recoveryData.maxAttempts})`
	});
}
