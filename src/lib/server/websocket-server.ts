import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

import { validateApiKey, validateSessionToken } from '$lib/server/auth/auth-middleware';
import { logger } from '$lib/utils/logger';

import type { WebSocketMessage } from './websocket-handlers';
import { activeIntervals, registerMessageHandlers } from './websocket-handlers';

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

// Store for active connections
const connections = new Map<string, Set<WebSocket>>();

// Message handlers for different endpoints
const messageHandlers = new Map<string, (ws: WebSocket, message: WebSocketMessage) => void>();

// Register HackRF and Kismet handlers from extracted module
registerMessageHandlers(messageHandlers);

/** Parse the upgrade request URL. */
function parseUpgradeUrl(req: IncomingMessage): URL {
	return new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
}

/**
 * Authenticate a WebSocket upgrade via session token, header, or cookie.
 *
 * The ?token= param accepts the HMAC-derived session token (NOT the raw API key)
 * to prevent key exposure in URLs/logs per OWASP A07:2021.
 */
function tryValidateApiKey(req: IncomingMessage): boolean {
	try {
		const url = parseUpgradeUrl(req);

		// 1. Check ?token= as session token (non-browser clients)
		const wsToken = url.searchParams.get('token');
		if (wsToken) return validateSessionToken(wsToken);

		// 2. Check X-API-Key header or cookie via standard validateApiKey
		const headers: Record<string, string> = {};
		const apiKey = req.headers['x-api-key'] as string;
		if (apiKey) headers['X-API-Key'] = apiKey;
		if (req.headers.cookie) headers['cookie'] = req.headers.cookie;
		return validateApiKey(new Request('http://localhost', { headers }));
	} catch {
		return false;
	}
}

/**
 * Authenticate a WebSocket upgrade request via API key or session cookie.
 */
function authenticateUpgrade(info: VerifyClientInfo, callback: VerifyClientCallback): boolean {
	if (tryValidateApiKey(info.req)) return true;

	logger.warn('WebSocket connection rejected: invalid API key', {
		ip: info.req.socket.remoteAddress
	});
	callback(false, 401, 'Unauthorized');
	return false;
}

/**
 * Build the verifyClient callback that enforces authentication and origin
 * checking on every WebSocket upgrade handshake.
 */
function buildVerifyClient(): (info: VerifyClientInfo, callback: VerifyClientCallback) => void {
	return (info: VerifyClientInfo, callback: VerifyClientCallback) => {
		if (!authenticateUpgrade(info, callback)) return;

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
		zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
		zlibInflateOptions: { chunkSize: 10 * 1024 },
		clientNoContextTakeover: true,
		serverNoContextTakeover: true,
		serverMaxWindowBits: 10,
		concurrencyLimit: 10,
		threshold: 1024
	};
}

/** Track a new WebSocket connection under its endpoint path */
function trackConnection(endpoint: string, ws: WebSocket): void {
	if (!connections.has(endpoint)) connections.set(endpoint, new Set());
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

/** Type guard: ensure parsed JSON has a string `type` field (minimum WebSocketMessage shape). */
function isWebSocketMessage(value: unknown): value is WebSocketMessage {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as Record<string, unknown>).type === 'string'
	);
}

/**
 * Route an incoming WebSocket message buffer to the appropriate endpoint
 * handler. Handles ping/pong heartbeats and JSON parse errors.
 */
function handleIncomingMessage(endpoint: string, ws: WebSocket, data: Buffer): void {
	try {
		const parsed: unknown = JSON.parse(data.toString());
		if (!isWebSocketMessage(parsed)) {
			ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
			return;
		}
		const message = parsed;

		if (message.type === 'ping') {
			ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
			return;
		}

		const handler = messageHandlers.get(endpoint);
		if (handler) {
			handler(ws, message);
		} else {
			ws.send(
				JSON.stringify({ type: 'error', message: `No handler for endpoint ${endpoint}` })
			);
		}
	} catch (error) {
		logger.error('[WebSocket] Message error', { error: String(error) }, 'ws-msg-error');
		ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
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

	ws.send(JSON.stringify({ type: 'connected', endpoint, timestamp: Date.now() }));

	ws.on('message', (data: Buffer) => handleIncomingMessage(endpoint, ws, data));

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
 *   - verifyClient: validates session token query param, X-API-Key header, or cookie
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

/** Broadcast message to all connections on an endpoint */
export function broadcast(endpoint: string, message: unknown) {
	const conns = connections.get(endpoint);
	if (conns) {
		const data = JSON.stringify(message);
		conns.forEach((ws) => {
			if (ws.readyState === 1) ws.send(data);
		});
	}
}

/** Get connection count for an endpoint */
export function getConnectionCount(endpoint: string): number {
	return connections.get(endpoint)?.size || 0;
}
