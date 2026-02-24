/**
 * WebSocket connection handler for Kismet
 * Extracted from hooks.server.ts to keep the main hooks file under 300 lines.
 * Handles WS authentication and client registration on the noServer WSS.
 */

import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';

import { validateApiKey, validateSessionToken } from '$lib/server/auth/auth-middleware';
import { WebSocketManager } from '$lib/server/kismet/web-socket-manager';
import { logAuthEvent } from '$lib/server/security/auth-audit';

/**
 * Authenticate a WebSocket connection via session token, header, or cookie.
 *
 * The ?token= param accepts the HMAC-derived session token (NOT the raw API key)
 * to prevent key exposure in URLs/logs per OWASP A07:2021.
 */
function tryAuthenticate(url: URL, request: IncomingMessage): boolean {
	try {
		// 1. Check ?token= as session token (non-browser clients)
		const wsToken = url.searchParams.get('token');
		if (wsToken) return validateSessionToken(wsToken);

		// 2. Check X-API-Key header or cookie via standard validateApiKey
		const mockHeaders: Record<string, string> = {};
		const apiKey = request.headers['x-api-key'] as string;
		if (apiKey) mockHeaders['X-API-Key'] = apiKey;
		const cookieHeader = request.headers.cookie;
		if (cookieHeader) mockHeaders['cookie'] = cookieHeader;
		return validateApiKey(new Request('http://localhost', { headers: mockHeaders }));
	} catch {
		return false; // fail closed
	}
}

/** Split a comma-separated query param into a string array, or undefined. */
function splitParam(url: URL, name: string): string[] | undefined {
	return url.searchParams.get(name)?.split(',') ?? undefined;
}

/** Parse an optional integer query param. */
function intParam(url: URL, name: string): number | undefined {
	const v = url.searchParams.get(name);
	return v ? parseInt(v, 10) : undefined;
}

/** Parse subscription preferences from URL query params. */
function parseSubscriptionPreferences(url: URL) {
	const types = splitParam(url, 'types');
	return {
		types: types ? new Set(types) : undefined,
		filters: {
			minSignal: intParam(url, 'minSignal'),
			deviceTypes: splitParam(url, 'deviceTypes')
		}
	};
}

/**
 * Handle a new WebSocket connection: authenticate, log audit events,
 * parse subscription preferences, and register with WebSocketManager.
 *
 * Phase 2.1.6: authentication enforced here because noServer mode does not
 * support the verifyClient callback.
 */
export function handleWsConnection(
	ws: WebSocket,
	request: IncomingMessage,
	wsManager: WebSocketManager
): void {
	const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
	const ip = request.socket.remoteAddress || 'unknown';

	if (!tryAuthenticate(url, request)) {
		logAuthEvent({
			eventType: 'WS_AUTH_FAILURE',
			ip,
			method: 'WS',
			path: url.pathname,
			reason: 'Invalid or missing API key on WebSocket connection'
		});
		ws.close(1008, 'Unauthorized'); // 1008 = Policy Violation
		return;
	}

	logAuthEvent({ eventType: 'WS_AUTH_SUCCESS', ip, method: 'WS', path: url.pathname });
	wsManager.addClient(ws, parseSubscriptionPreferences(url));
}
