/**
 * WebSocket message handlers for HackRF and Kismet endpoints
 * Extracted from websocket-server.ts to keep the main file under 300 lines.
 */

import type { WebSocket } from 'ws';
import { z } from 'zod';

// WebSocket message interface (legacy -- for backward compatibility)
export interface WebSocketMessage {
	type: string;
	config?: {
		startFreq?: number;
		endFreq?: number;
	};
	streams?: string[];
}

/**
 * Zod schema for HackRF WebSocket messages
 * Task: T031 - Constitutional Audit Remediation (P1)
 */
const HackRFMessageSchema = z.union([
	z.object({ type: z.literal('request_status') }),
	z.object({ type: z.literal('request_sweep_status') }),
	z.object({
		type: z.literal('start_sweep'),
		config: z
			.object({
				startFreq: z.number().min(1).max(6000000000).describe('Start frequency in Hz'),
				endFreq: z.number().min(1).max(6000000000).describe('End frequency in Hz')
			})
			.optional()
	}),
	z.object({ type: z.literal('stop_sweep') }),
	z.object({
		type: z.literal('subscribe'),
		streams: z.array(z.string()).optional()
	})
]);

/**
 * Zod schema for Kismet WebSocket messages
 * Task: T032 - Constitutional Audit Remediation (P1)
 */
const KismetMessageSchema = z.union([
	z.object({ type: z.literal('request_status') }),
	z.object({ type: z.literal('request_devices') }),
	z.object({ type: z.literal('refresh') })
]);

/** Store for active intervals (prevents memory leaks on sweep simulation) */
export const activeIntervals = new Map<WebSocket, NodeJS.Timeout>();

/** Register all endpoint message handlers on the provided handler map */
export function registerMessageHandlers(
	messageHandlers: Map<string, (ws: WebSocket, message: WebSocketMessage) => void>
): void {
	messageHandlers.set('/hackrf', handleHackRFMessage);
	messageHandlers.set('/kismet', handleKismetMessage);
}

/** HackRF WebSocket message handler */
function handleHackRFMessage(ws: WebSocket, rawMessage: WebSocketMessage): void {
	const validationResult = HackRFMessageSchema.safeParse(rawMessage);

	if (!validationResult.success) {
		ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Invalid message format',
				errors: validationResult.error.format()
			})
		);
		return;
	}

	const message = validationResult.data;

	switch (message.type) {
		case 'request_status':
			ws.send(
				JSON.stringify({
					type: 'status',
					data: {
						connected: true,
						sweeping: false,
						frequency: 100000000,
						sampleRate: 20000000,
						gain: 40
					}
				})
			);
			break;

		case 'request_sweep_status':
			ws.send(
				JSON.stringify({
					type: 'sweep_status',
					data: {
						isActive: false,
						startFreq: 88000000,
						endFreq: 108000000,
						currentFreq: 0,
						progress: 0
					}
				})
			);
			break;

		case 'start_sweep':
			handleStartSweep(ws, message);
			break;

		case 'stop_sweep':
			ws.send(JSON.stringify({ type: 'sweep_status', data: { isActive: false } }));
			break;

		case 'subscribe':
			ws.send(JSON.stringify({ type: 'subscribed', streams: message.streams }));
			break;
	}
}

/** Handle HackRF sweep start (with simulated progress) */
function handleStartSweep(
	ws: WebSocket,
	message: { type: 'start_sweep'; config?: { startFreq: number; endFreq: number } }
): void {
	ws.send(
		JSON.stringify({
			type: 'sweep_status',
			data: {
				isActive: true,
				startFreq: message.config?.startFreq || 88000000,
				endFreq: message.config?.endFreq || 108000000,
				currentFreq: message.config?.startFreq || 88000000,
				progress: 0
			}
		})
	);

	let progress = 0;
	const interval = setInterval(() => {
		progress += 10;
		if (progress > 100) {
			clearInterval(interval);
			activeIntervals.delete(ws);
			ws.send(
				JSON.stringify({ type: 'sweep_status', data: { isActive: false, progress: 100 } })
			);
		} else {
			ws.send(
				JSON.stringify({
					type: 'spectrum_data',
					data: {
						frequencies: Array.from({ length: 100 }, (_, i) => 88000000 + i * 200000),
						power: Array.from({ length: 100 }, () => -80 + Math.random() * 40),
						timestamp: Date.now()
					}
				})
			);
		}
	}, 1000);

	activeIntervals.set(ws, interval);
}

/** Kismet WebSocket message handler */
function handleKismetMessage(ws: WebSocket, rawMessage: WebSocketMessage): void {
	const validationResult = KismetMessageSchema.safeParse(rawMessage);

	if (!validationResult.success) {
		ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Invalid message format',
				errors: validationResult.error.format()
			})
		);
		return;
	}

	const message = validationResult.data;

	switch (message.type) {
		case 'request_status':
			ws.send(
				JSON.stringify({
					type: 'status',
					data: {
						running: true,
						connected: true,
						devices: 42,
						uptime: 3600,
						packetsPerSecond: 150
					}
				})
			);
			break;

		case 'request_devices':
			ws.send(
				JSON.stringify({
					type: 'devices_list',
					data: [
						{
							mac: '00:11:22:33:44:55',
							ssid: 'TestNetwork',
							manufacturer: 'Example Corp',
							signalStrength: -45,
							channel: 6,
							firstSeen: new Date(Date.now() - 3600000).toISOString(),
							lastSeen: new Date().toISOString(),
							packets: 1234
						},
						{
							mac: 'AA:BB:CC:DD:EE:FF',
							ssid: 'AnotherNetwork',
							manufacturer: 'Device Inc',
							signalStrength: -72,
							channel: 11,
							firstSeen: new Date(Date.now() - 1800000).toISOString(),
							lastSeen: new Date().toISOString(),
							packets: 567
						}
					]
				})
			);
			break;

		case 'refresh':
			ws.send(
				JSON.stringify({
					type: 'status',
					data: {
						running: true,
						connected: true,
						devices: 45,
						uptime: 3700,
						packetsPerSecond: 175
					}
				})
			);
			break;
	}
}
