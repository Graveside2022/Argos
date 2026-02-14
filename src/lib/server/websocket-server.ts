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
		maxPayload: 1048576, // 1MB -- RF data messages should not exceed this
		verifyClient: (info, callback) => {
			// --- Authentication ---
			// Extract API key from query string token param or X-API-Key header.
			// Token in query string is acceptable for WebSocket because the WS
			// upgrade request is not logged like HTTP requests, and there is no
			// Referer header leak. This is standard practice (Socket.IO, Phoenix
			// Channels, Action Cable). See RFC 6455 Section 10.1.
			const url = new URL(
				info.req.url || '',
				`http://${info.req.headers.host || 'localhost'}`
			);
			const apiKey =
				url.searchParams.get('token') || (info.req.headers['x-api-key'] as string);

			// Build mock Request with API key AND cookies for browser session auth.
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
					return;
				}
			} catch {
				// validateApiKey throws if ARGOS_API_KEY is not configured -- fail closed
				logger.error('WebSocket connection rejected: ARGOS_API_KEY not configured');
				callback(false, 401, 'Unauthorized');
				return;
			}

			// --- Origin checking ---
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
		},
		perMessageDeflate: {
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
		}
	});

	console.warn(`WebSocket server listening on port ${port}`);

	wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
		const url = req.url || '/';
		const endpoint = url.split('?')[0];

		console.warn(`New WebSocket connection to ${endpoint}`);

		// Add to connections
		if (!connections.has(endpoint)) {
			connections.set(endpoint, new Set());
		}
		connections.get(endpoint)?.add(ws);

		// Send initial connection success
		ws.send(
			JSON.stringify({
				type: 'connected',
				endpoint,
				timestamp: Date.now()
			})
		);

		// Setup message handling
		ws.on('message', (data: Buffer) => {
			try {
	// Safe: WebSocket connection type assertion
				const message = JSON.parse(data.toString()) as WebSocketMessage;

				// Handle ping/pong
				if (message.type === 'ping') {
					ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
					return;
				}

				// Route to appropriate handler
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
				console.error('WebSocket message error:', error);
				ws.send(
					JSON.stringify({
						type: 'error',
						message: 'Invalid message format'
					})
				);
			}
		});

		ws.on('close', () => {
			console.warn(`WebSocket connection closed for ${endpoint}`);
			connections.get(endpoint)?.delete(ws);

			// Clean up any active intervals for this connection (prevents memory leak)
			const interval = activeIntervals.get(ws);
			if (interval) {
				clearInterval(interval);
				activeIntervals.delete(ws);
			}
		});

		ws.on('error', (error: Error) => {
			console.error(`WebSocket error for ${endpoint}:`, error);

			// Clean up intervals on error as well
			const interval = activeIntervals.get(ws);
			if (interval) {
				clearInterval(interval);
				activeIntervals.delete(ws);
			}
		});
	});

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
						active: false,
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
						active: true,
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
							data: { active: false, progress: 100 }
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
					data: { active: false }
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
