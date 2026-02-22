import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { z } from 'zod';

import { validateApiKey } from '$lib/server/auth/auth-middleware';
import { logger } from '$lib/utils/logger';

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

// WebSocket message interface (legacy - for backward compatibility)
interface WebSocketMessage {
	type: string;
	config?: {
		startFreq?: number;
		endFreq?: number;
	};
	streams?: string[];
}

// Store for active connections
const connections = new Map<string, Set<WebSocket>>();

// Store for active intervals (prevents memory leaks)
const activeIntervals = new Map<WebSocket, NodeJS.Timeout>();

// Message handlers for different endpoints
const messageHandlers = new Map<string, (ws: WebSocket, message: WebSocketMessage) => void>();

/**
 * Allowed origins for WebSocket connections.
 * In tactical deployment, this is the RPi's own IP/hostname.
 * Connections without an Origin header are allowed (non-browser clients like wscat).
 */
const ALLOWED_ORIGINS: string[] = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	`http://${process.env.HOSTNAME || 'localhost'}:5173`
];

/** Info object passed to verifyClient by the ws library */
interface VerifyClientInfo {
	origin: string;
	secure: boolean;
	req: IncomingMessage;
}

/** Callback signature for async client verification */
type VerifyClientCallback = (result: boolean, code?: number, message?: string) => void;

/**
 * Authenticate a WebSocket upgrade request via API key or session cookie.
 *
 * Extracts API key from query string `token` param or `X-API-Key` header.
 * Token in query string is acceptable for WebSocket because the WS upgrade
 * request is not logged like HTTP requests, and there is no Referer header
 * leak. This is standard practice (Socket.IO, Phoenix Channels, Action Cable).
 * See RFC 6455 Section 10.1.
 */
function authenticateUpgrade(info: VerifyClientInfo, callback: VerifyClientCallback): boolean {
	const url = new URL(info.req.url || '', `http://${info.req.headers.host || 'localhost'}`);
	const apiKey = url.searchParams.get('token') || (info.req.headers['x-api-key'] as string);

	const mockHeaders: Record<string, string> = {};
	if (apiKey) {
		mockHeaders['X-API-Key'] = apiKey;
	}
	const cookieHeader = info.req.headers.cookie;
	if (cookieHeader) {
		mockHeaders['cookie'] = cookieHeader;
	}
	const mockRequest = new Request('http://localhost', { headers: mockHeaders });

	try {
		if (!validateApiKey(mockRequest)) {
			logger.warn('WebSocket connection rejected: invalid API key', {
				ip: info.req.socket.remoteAddress
			});
			callback(false, 401, 'Unauthorized');
			return false;
		}
	} catch {
		logger.error('WebSocket connection rejected: ARGOS_API_KEY not configured');
		callback(false, 401, 'Unauthorized');
		return false;
	}
	return true;
}

/**
 * Build the verifyClient callback that enforces authentication and origin
 * checking on every WebSocket upgrade handshake.
 */
function buildVerifyClient(): (info: VerifyClientInfo, callback: VerifyClientCallback) => void {
	return (info: VerifyClientInfo, callback: VerifyClientCallback) => {
		if (!authenticateUpgrade(info, callback)) {
			return;
		}

		// Prevent cross-origin WebSocket hijacking from malicious pages.
		// Non-browser clients (curl, wscat, scripts) typically omit the Origin
		// header, so we only reject when Origin IS present and NOT in the allowlist.
		const origin = info.origin || info.req.headers.origin;
		if (origin && !ALLOWED_ORIGINS.includes(origin)) {
			logger.warn('WebSocket connection rejected: forbidden origin', { origin });
			callback(false, 403, 'Forbidden origin');
			return;
		}

		callback(true);
	};
}

/** Per-message deflate options tuned for RF data throughput on RPi 5 */
function buildDeflateOptions() {
	return {
		zlibDeflateOptions: {
			chunkSize: 1024,
			memLevel: 7,
			level: 3
		},
		zlibInflateOptions: {
			chunkSize: 10 * 1024
		},
		clientNoContextTakeover: true,
		serverNoContextTakeover: true,
		serverMaxWindowBits: 10,
		concurrencyLimit: 10,
		threshold: 1024
	};
}

/** Track a new WebSocket connection under its endpoint path */
function trackConnection(endpoint: string, ws: WebSocket): void {
	if (!connections.has(endpoint)) {
		connections.set(endpoint, new Set());
	}
	connections.get(endpoint)?.add(ws);
}

/** Remove a WebSocket from its endpoint set and clear any active intervals */
function cleanupConnection(endpoint: string, ws: WebSocket): void {
	connections.get(endpoint)?.delete(ws);

	const interval = activeIntervals.get(ws);
	if (interval) {
		clearInterval(interval);
		activeIntervals.delete(ws);
	}
}

/**
 * Route an incoming WebSocket message buffer to the appropriate endpoint
 * handler. Handles ping/pong heartbeats and JSON parse errors.
 */
function handleIncomingMessage(endpoint: string, ws: WebSocket, data: Buffer): void {
	try {
		const message = JSON.parse(data.toString()) as WebSocketMessage;

		if (message.type === 'ping') {
			ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
			return;
		}

		const handler = messageHandlers.get(endpoint);
		if (handler) {
			handler(ws, message);
		} else {
			ws.send(
				JSON.stringify({
					type: 'error',
					message: `No handler for endpoint ${endpoint}`
				})
			);
		}
	} catch (error) {
		logger.error('[WebSocket] Message error', { error: String(error) }, 'ws-msg-error');
		ws.send(
			JSON.stringify({
				type: 'error',
				message: 'Invalid message format'
			})
		);
	}
}

/**
 * Handle a newly established WebSocket connection: register it, send the
 * connection acknowledgement, and wire up message/close/error listeners.
 */
function handleConnection(ws: WebSocket, req: IncomingMessage): void {
	const url = req.url || '/';
	const endpoint = url.split('?')[0];

	logger.info('[WebSocket] New connection', { endpoint });
	trackConnection(endpoint, ws);

	ws.send(
		JSON.stringify({
			type: 'connected',
			endpoint,
			timestamp: Date.now()
		})
	);

	ws.on('message', (data: Buffer) => {
		handleIncomingMessage(endpoint, ws, data);
	});

	ws.on('close', () => {
		logger.debug('[WebSocket] Connection closed', { endpoint }, 'ws-close');
		cleanupConnection(endpoint, ws);
	});

	ws.on('error', (error: Error) => {
		logger.error(
			'[WebSocket] Connection error',
			{ endpoint, error: error.message },
			'ws-error'
		);
		cleanupConnection(endpoint, ws);
	});
}

/**
 * Initialize WebSocket server
 *
 * Security (Phase 2.1.6):
 *   - verifyClient: validates API key via token query param or X-API-Key header
 *   - Origin checking: rejects cross-origin browser connections
 *   - maxPayload: 1MB limit prevents memory exhaustion
 */
export function initializeWebSocketServer(server: unknown, port: number = 5173) {
	const wss = new WebSocketServer({
		port,
		maxPayload: 1048576,
		verifyClient: buildVerifyClient(),
		perMessageDeflate: buildDeflateOptions()
	});

	logger.info('[WebSocket] Server listening', { port });
	wss.on('connection', handleConnection);

	return wss;
}

/**
 * Register HackRF WebSocket handler
 * Task: T031 - Constitutional Audit Remediation (P1)
 */
messageHandlers.set('/hackrf', (ws, rawMessage) => {
	// Validate message with Zod (T031)
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

		case 'start_sweep': {
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

			// Simulate sweep progress
			let progress = 0;
			const interval = setInterval(() => {
				progress += 10;
				if (progress > 100) {
					clearInterval(interval);
					activeIntervals.delete(ws);
					ws.send(
						JSON.stringify({
							type: 'sweep_status',
							data: { isActive: false, progress: 100 }
						})
					);
				} else {
					ws.send(
						JSON.stringify({
							type: 'spectrum_data',
							data: {
								frequencies: Array.from(
									{ length: 100 },
									(_, i) => 88000000 + i * 200000
								),
								power: Array.from({ length: 100 }, () => -80 + Math.random() * 40),
								timestamp: Date.now()
							}
						})
					);
				}
			}, 1000);

			// Store interval reference for cleanup
			activeIntervals.set(ws, interval);
			break;
		}

		case 'stop_sweep':
			ws.send(
				JSON.stringify({
					type: 'sweep_status',
					data: { isActive: false }
				})
			);
			break;

		case 'subscribe':
			ws.send(
				JSON.stringify({
					type: 'subscribed',
					streams: message.streams
				})
			);
			break;

		// No default case - Zod validation ensures message.type is valid
	}
});

/**
 * Register Kismet WebSocket handler
 * Task: T032 - Constitutional Audit Remediation (P1)
 */
messageHandlers.set('/kismet', (ws, rawMessage) => {
	// Validate message with Zod (T032)
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

		// No default case - Zod validation ensures message.type is valid
	}
});

/**
 * Broadcast message to all connections on an endpoint
 */
export function broadcast(endpoint: string, message: unknown) {
	const conns = connections.get(endpoint);
	if (conns) {
		const data = JSON.stringify(message);
		conns.forEach((ws) => {
			if (ws.readyState === 1) {
				// WebSocket.OPEN
				ws.send(data);
			}
		});
	}
}

/**
 * Get connection count for an endpoint
 */
export function getConnectionCount(endpoint: string): number {
	return connections.get(endpoint)?.size || 0;
}
