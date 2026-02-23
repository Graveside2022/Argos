/**
 * WebSocket connection handler for Kismet
 * Extracted from hooks.server.ts to keep the main hooks file under 300 lines.
 * Handles WS authentication and client registration on the noServer WSS.
 */

import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';

import { validateApiKey } from '$lib/server/auth/auth-middleware';
import { WebSocketManager } from '$lib/server/kismet/web-socket-manager';
import { logAuthEvent } from '$lib/server/security/auth-audit';

/** Build a mock Request with API key header and cookies for auth validation. */
function buildMockRequest(url: URL, request: IncomingMessage): Request {
	const apiKey = url.searchParams.get('token') || (request.headers['x-api-key'] as string);
	const mockHeaders: Record<string, string> = {};
	if (apiKey) mockHeaders['X-API-Key'] = apiKey;
	const cookieHeader = request.headers.cookie;
	if (cookieHeader) mockHeaders['cookie'] = cookieHeader;
	return new Request('http://localhost', { headers: mockHeaders });
}

/** Try to authenticate a mock request; returns false on failure or thrown errors. */
function tryAuthenticate(mockRequest: Request): boolean {
	try {
		return validateApiKey(mockRequest);
	} catch {
		return false; // validateApiKey throws if ARGOS_API_KEY is not configured -- fail closed
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

	if (!tryAuthenticate(buildMockRequest(url, request))) {
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
