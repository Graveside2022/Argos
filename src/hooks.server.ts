import '$lib/server/env';

import type { Handle, HandleServerError } from '@sveltejs/kit';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

import { dev } from '$app/environment';
import {
	getSessionCookieHeader,
	validateApiKey,
	validateSecurityConfig
} from '$lib/server/auth/auth-middleware';
import {
	globalHardwareMonitor,
	scanAllHardware
} from '$lib/server/hardware/detection/hardware-detector';
import { WebSocketManager } from '$lib/server/kismet/web-socket-manager';
import { checkRateLimit, getSafeClientAddress } from '$lib/server/middleware/rate-limit-middleware';
import { applySecurityHeaders } from '$lib/server/middleware/security-headers';
import { handleWsConnection } from '$lib/server/middleware/ws-connection-handler';
import { logAuthEvent } from '$lib/server/security/auth-audit';
import { logger } from '$lib/utils/logger';

// Request body size limits -- prevents DoS via oversized POST/PUT bodies (Phase 2.1.7)
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB general limit
const HARDWARE_BODY_LIMIT = 64 * 1024; // 64KB for hardware control endpoints

// Hardware endpoint path pattern -- these control physical RF hardware
const HARDWARE_PATH_PATTERN =
	/^\/api\/(hackrf|kismet|gsm-evil|rf|droneid|openwebrx|bettercap|wifite)\//;

// FAIL-CLOSED: Halt startup if ARGOS_API_KEY is not configured or too short.
validateSecurityConfig();

// Create WebSocket server with payload limit (Phase 2.1.6).
// noServer mode does not support verifyClient -- authentication is enforced
// in the connection handler and in the SvelteKit handle() hook before upgrade.
const wss = new WebSocketServer({ noServer: true, maxPayload: 262144 }); // 256KB

// Initialize WebSocket manager
const wsManager = WebSocketManager.getInstance();

// Initialize hardware detection system (auto-detect connected hardware)
scanAllHardware()
	.then((result) => {
		logger.info('Hardware detection complete', {
			total: result.stats.total,
			connected: result.stats.connected,
			sdrs: result.stats.byCategory.sdr || 0,
			wifi: result.stats.byCategory.wifi || 0,
			bluetooth: result.stats.byCategory.bluetooth || 0
		});
		globalHardwareMonitor.start(30000);
		logger.info('Hardware monitoring started');
	})
	.catch((error) => {
		logger.error('Failed to scan hardware', { error });
	});

// Initialize TakService (Phase 5)
import { TakService } from '$lib/server/tak/tak-service';
TakService.getInstance()
	.initialize()
	.catch((err) => {
		logger.error('Failed to initialize TakService', { error: err });
	});

// Handle WebSocket connections -- delegates to ws-connection-handler module
wss.on('connection', (ws: WebSocket, request) => {
	handleWsConnection(ws, request, wsManager);
});

export const handle: Handle = async ({ event, resolve }) => {
	// Handle WebSocket upgrade requests (Phase 2.1.6: authenticate before upgrade)
	if (
		event.url.pathname === '/api/kismet/ws' &&
		event.request.headers.get('upgrade') === 'websocket'
	) {
		const wsApiKey =
			event.url.searchParams.get('token') || event.request.headers.get('X-API-Key');
		const wsMockHeaders: Record<string, string> = {};
		if (wsApiKey) wsMockHeaders['X-API-Key'] = wsApiKey;
		const wsCookie = event.request.headers.get('cookie');
		if (wsCookie) wsMockHeaders['cookie'] = wsCookie;
		const wsMockRequest = new Request('http://localhost', { headers: wsMockHeaders });

		let wsAuthenticated = false;
		try {
			wsAuthenticated = validateApiKey(wsMockRequest);
		} catch {
			// fail closed
		}

		if (!wsAuthenticated) {
			logAuthEvent({
				eventType: 'WS_AUTH_FAILURE',
				ip: getSafeClientAddress(event),
				method: event.request.method,
				path: event.url.pathname,
				userAgent: event.request.headers.get('user-agent') || undefined,
				reason: 'WebSocket upgrade rejected: invalid or missing credentials'
			});
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		logger.warn('WebSocket upgrade requested but platform context not available', {
			path: event.url.pathname,
			headers: { upgrade: event.request.headers.get('upgrade') }
		});
	}

	// API Authentication gate -- all /api/ routes except /api/health (Phase 2.1.1)
	if (event.url.pathname.startsWith('/api/') && event.url.pathname !== '/api/health') {
		if (!validateApiKey(event.request)) {
			const hasApiKeyHeader = !!event.request.headers.get('X-API-Key');
			const hasCookie = !!event.request.headers.get('cookie');
			const eventType = hasApiKeyHeader || hasCookie ? 'AUTH_FAILURE' : 'AUTH_MISSING';

			logAuthEvent({
				eventType,
				ip: getSafeClientAddress(event),
				method: event.request.method,
				path: event.url.pathname,
				userAgent: event.request.headers.get('user-agent') || undefined,
				reason:
					eventType === 'AUTH_MISSING'
						? 'No credentials provided'
						: 'Invalid API key or session cookie'
			});
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		logAuthEvent({
			eventType: 'AUTH_SUCCESS',
			ip: getSafeClientAddress(event),
			method: event.request.method,
			path: event.url.pathname,
			userAgent: event.request.headers.get('user-agent') || undefined
		});
	}

	// Rate limiting -- delegates to rate-limit-middleware
	const rateLimitResponse = checkRateLimit(event);
	if (rateLimitResponse) return rateLimitResponse;

	// Body size limit check (Phase 2.1.7)
	if (event.request.method === 'POST' || event.request.method === 'PUT') {
		const contentLength = parseInt(event.request.headers.get('content-length') || '0');
		const isHardwareEndpoint = HARDWARE_PATH_PATTERN.test(event.url.pathname);
		const limit = isHardwareEndpoint ? HARDWARE_BODY_LIMIT : MAX_BODY_SIZE;

		if (contentLength > limit) {
			return new Response(JSON.stringify({ error: 'Payload too large' }), {
				status: 413,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	const response = await resolve(event);

	// Set session cookie for browser clients on page requests
	if (!event.url.pathname.startsWith('/api/')) {
		response.headers.append('Set-Cookie', getSessionCookieHeader());
		logAuthEvent({
			eventType: 'SESSION_CREATED',
			ip: getSafeClientAddress(event),
			method: event.request.method,
			path: event.url.pathname,
			userAgent: event.request.headers.get('user-agent') || undefined
		});
	}

	// Apply security headers (CSP, HSTS, etc.) -- delegates to security-headers
	applySecurityHeaders(response);

	return response;
};

/**
 * Global error handler for unhandled server-side errors
 */
export const handleError: HandleServerError = ({ error, event }) => {
	const errorId = crypto.randomUUID();

	const errorDetails = {
		errorId,
		url: event.url.pathname,
		method: event.request.method,
		userAgent: event.request.headers.get('user-agent'),
		timestamp: new Date().toISOString(),
		...(error instanceof Error
			? {
					name: error.name,
					message: error.message,
					stack: error.stack,
					...Object.getOwnPropertyNames(error).reduce(
						(acc, prop) => {
							if (!['name', 'message', 'stack'].includes(prop)) {
								// Safe: Error object cast to Record to access dynamic properties
								acc[prop] = (error as unknown as Record<string, unknown>)[prop];
							}
							return acc;
						},
						{} as Record<string, unknown>
					)
				}
			: { error: String(error), type: typeof error })
	};

	logger.error('Unhandled server error occurred', errorDetails);

	return {
		message: 'An internal server error occurred. We have been notified.',
		errorId,
		stack: dev && error instanceof Error ? error.stack : undefined
	};
};

// Graceful shutdown -- guarded via globalThis to prevent listener accumulation on HMR
const SHUTDOWN_KEY = '__argos_hooks_shutdown_registered';
if (dev) {
	if (typeof process !== 'undefined' && !(globalThis as Record<string, unknown>)[SHUTDOWN_KEY]) {
		(globalThis as Record<string, unknown>)[SHUTDOWN_KEY] = true;
		process.on('SIGINT', () => {
			logger.info('Shutting down WebSocket server...');
			wsManager.destroy();
			wss.close(() => {
				logger.info('WebSocket server closed');
			});
		});
	}
}
