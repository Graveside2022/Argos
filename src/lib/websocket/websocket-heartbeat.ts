import { logger } from '$lib/utils/logger';

import type { ResolvedConfig } from './websocket-types';

/** Mutable heartbeat state tracked per WebSocket instance. */
export interface HeartbeatState {
	heartbeatTimer: ReturnType<typeof setInterval> | null;
	lastHeartbeat: number;
}

/**
 * Stops any running heartbeat interval and clears the timer reference.
 */
export function stopHeartbeat(state: HeartbeatState): void {
	if (state.heartbeatTimer !== null) {
		clearInterval(state.heartbeatTimer);
		state.heartbeatTimer = null;
	}
}

/**
 * Starts the heartbeat interval. Calls `sendFn` every
 * `config.heartbeatInterval` ms when the socket is open. Closes the
 * socket with code 4000 if no heartbeat response has been received
 * within two intervals.
 *
 * Any previously running heartbeat is stopped before starting a new one.
 */
export function startHeartbeat(
	state: HeartbeatState,
	config: ResolvedConfig,
	ws: WebSocket,
	sendFn: () => void,
	sourceName: string
): void {
	stopHeartbeat(state);

	state.heartbeatTimer = setInterval(() => {
		if (ws.readyState !== WebSocket.OPEN) return;

		sendFn();

		const timeSinceLastBeat = Date.now() - state.lastHeartbeat;
		const timeout = config.heartbeatInterval * 2;

		if (state.lastHeartbeat > 0 && timeSinceLastBeat > timeout) {
			logger.warn('Heartbeat timeout, closing connection', { source: sourceName });
			ws.close(4000, 'Heartbeat timeout');
		}
	}, config.heartbeatInterval);
}
