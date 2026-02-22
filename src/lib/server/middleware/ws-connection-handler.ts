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
	// Safe: Header value is string | string[] | undefined, narrowing to string for auth
	const apiKey = url.searchParams.get('token') || (request.headers['x-api-key'] as string);

	// Build mock Request with API key header AND cookies (for browser session auth).
	const mockHeaders: Record<string, string> = {};
	if (apiKey) mockHeaders['X-API-Key'] = apiKey;
	const cookieHeader = request.headers.cookie;
	if (cookieHeader) mockHeaders['cookie'] = cookieHeader;
	const mockRequest = new Request('http://localhost', { headers: mockHeaders });

	let authenticated = false;
	try {
		authenticated = validateApiKey(mockRequest);
	} catch {
		// validateApiKey throws if ARGOS_API_KEY is not configured -- fail closed
	}

	if (!authenticated) {
		logAuthEvent({
			eventType: 'WS_AUTH_FAILURE',
			ip: request.socket.remoteAddress || 'unknown',
			method: 'WS',
			path: url.pathname,
			reason: 'Invalid or missing API key on WebSocket connection'
		});
		ws.close(1008, 'Unauthorized'); // 1008 = Policy Violation
		return;
	}

	logAuthEvent({
		eventType: 'WS_AUTH_SUCCESS',
		ip: request.socket.remoteAddress || 'unknown',
		method: 'WS',
		path: url.pathname
	});

	// Parse URL for subscription preferences
	const types: string[] | undefined = url.searchParams.get('types')?.split(',') || undefined;
	const minSignal: string | null = url.searchParams.get('minSignal');
	const deviceTypes: string[] | undefined = url.searchParams.get('deviceTypes')?.split(',');

	wsManager.addClient(ws, {
		types: types ? new Set(types) : undefined,
		filters: {
			minSignal: minSignal ? parseInt(minSignal, 10) : undefined,
			deviceTypes
		}
	});
}
