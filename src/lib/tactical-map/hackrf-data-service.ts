/**
 * HackRF SSE data service — subscribes to /api/hackrf/data-stream
 * and populates hackrfStore with frequency and connection status.
 *
 * Analogous to GPSService but uses EventSource instead of polling.
 * Lifecycle: start() on map mount, stop() on map unmount.
 */
import { setConnectionStatus, setTargetFrequency } from '$lib/stores/tactical-map/hackrf-store';
import { logger } from '$lib/utils/logger';

// ── Constants ────────────────────────────────────────────────────────

const SSE_URL = '/api/hackrf/data-stream';
const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

// ── Types ────────────────────────────────────────────────────────────

interface SweepStatusEvent {
	state?: string;
	currentFrequency?: number;
}

// ── Service class ────────────────────────────────────────────────────

export class HackRFDataService {
	private eventSource: EventSource | null = null;
	private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private stopped = false;

	start(): void {
		this.stopped = false;
		this.connect();
	}

	stop(): void {
		this.stopped = true;
		this.clearReconnectTimer();
		this.closeEventSource();
		setConnectionStatus('Disconnected');
	}

	private connect(): void {
		if (this.stopped) return;

		this.closeEventSource();

		const es = new EventSource(SSE_URL);
		this.eventSource = es;

		es.addEventListener('connected', () => {
			this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
			setConnectionStatus('Connected');
		});

		es.addEventListener('status', (event: MessageEvent) => {
			try {
				const status = JSON.parse(event.data) as SweepStatusEvent;
				this.applyStatusUpdate(status);
			} catch {
				logger.debug('Failed to parse HackRF status event');
			}
		});

		es.addEventListener('error', () => {
			this.closeEventSource();
			setConnectionStatus('Disconnected');
			this.scheduleReconnect();
		});
	}

	private applyStatusUpdate(status: SweepStatusEvent): void {
		if (typeof status.currentFrequency === 'number' && status.currentFrequency > 0) {
			// SSE sends frequency in Hz; hackrfStore.targetFrequency is in MHz
			setTargetFrequency(status.currentFrequency / 1e6);
		}
		if (status.state === 'running' || status.state === 'idle') {
			setConnectionStatus('Connected');
		}
	}

	private scheduleReconnect(): void {
		if (this.stopped) return;
		this.clearReconnectTimer();

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, this.reconnectDelay);

		// Exponential backoff with cap
		this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
	}

	private closeEventSource(): void {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}
}
