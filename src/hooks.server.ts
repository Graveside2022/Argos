import '$lib/server/env';

import type { Handle, HandleServerError } from '@sveltejs/kit';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

import { dev } from '$app/environment';
import {
	getSessionCookieHeader,
	validateApiKey,
	validateSecurityConfig,
	validateSessionToken
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

/**
 * Authenticate a WebSocket upgrade via session token, header, or cookie.
 *
 * The ?token= param accepts the HMAC-derived session token (NOT the raw API key)
 * to prevent key exposure in URLs/logs per OWASP A07:2021.
 */
function authenticateWsRequest(event: Parameters<Handle>[0]['event']): boolean {
	// 1. Check ?token= query param as session token (non-browser clients)
	const wsToken = event.url.searchParams.get('token');
	if (wsToken) return validateSessionToken(wsToken);

	// 2. Check X-API-Key header (programmatic clients that can set headers)
	// 3. Check session cookie (browser clients)
	return safeValidateApiKey(event.request);
}

/** Check if a request is a WebSocket upgrade for the Kismet WS endpoint. */
function isKismetWsUpgrade(event: Parameters<Handle>[0]['event']): boolean {
	return (
		event.url.pathname === '/api/kismet/ws' &&
		event.request.headers.get('upgrade') === 'websocket'
	);
}

/** Validate API key, returning false on any exception (fail-closed). */
function safeValidateApiKey(request: Request): boolean {
	try {
		return validateApiKey(request);
	} catch {
		return false;
	}
}

/** Build an unauthorized JSON response. */
function unauthorizedResponse(): Response {
	return new Response(JSON.stringify({ error: 'Unauthorized' }), {
		status: 401,
		headers: { 'Content-Type': 'application/json' }
	});
}

/** Authenticate WebSocket upgrade requests. Returns 401 Response or null to continue. */
function handleWsAuth(event: Parameters<Handle>[0]['event']): Response | null {
	if (!isKismetWsUpgrade(event)) return null;

	if (!authenticateWsRequest(event)) {
		logAuthEvent({
			eventType: 'WS_AUTH_FAILURE',
			ip: getSafeClientAddress(event),
			method: event.request.method,
			path: event.url.pathname,
			userAgent: event.request.headers.get('user-agent') || undefined,
			reason: 'WebSocket upgrade rejected: invalid or missing credentials'
		});
		return unauthorizedResponse();
	}

	logger.warn('WebSocket upgrade requested but platform context not available', {
		path: event.url.pathname,
		headers: { upgrade: event.request.headers.get('upgrade') }
	});
	return null;
}

/** Determine auth event type from request headers. */
function resolveAuthEventType(request: Request): 'AUTH_FAILURE' | 'AUTH_MISSING' {
	const hasApiKeyHeader = !!request.headers.get('X-API-Key');
	const hasCookie = !!request.headers.get('cookie');
	return hasApiKeyHeader || hasCookie ? 'AUTH_FAILURE' : 'AUTH_MISSING';
}

/** Map auth event type to human-readable reason. */
const AUTH_REASONS: Record<string, string> = {
	AUTH_MISSING: 'No credentials provided',
	AUTH_FAILURE: 'Invalid API key or session cookie'
};

/** Whether the path requires API authentication. */
function requiresApiAuth(pathname: string): boolean {
	return pathname.startsWith('/api/') && pathname !== '/api/health';
}

/** Build common auth log fields from a request event. */
function authLogFields(event: Parameters<Handle>[0]['event']) {
	return {
		ip: getSafeClientAddress(event),
		method: event.request.method,
		path: event.url.pathname,
		userAgent: event.request.headers.get('user-agent') || undefined
	};
}

/** Authenticate API requests. Returns 401 Response or null to continue. */
function handleApiAuth(event: Parameters<Handle>[0]['event']): Response | null {
	if (!requiresApiAuth(event.url.pathname)) return null;

	if (!validateApiKey(event.request)) {
		const eventType = resolveAuthEventType(event.request);
		logAuthEvent({ eventType, ...authLogFields(event), reason: AUTH_REASONS[eventType] });
		return unauthorizedResponse();
	}

	logAuthEvent({ eventType: 'AUTH_SUCCESS', ...authLogFields(event) });
	return null;
}

/** Whether the request method has a body that needs size checking. */
const BODY_METHODS = new Set(['POST', 'PUT']);

/** Determine the body size limit for a given path. */
function getBodyLimit(pathname: string): number {
	return HARDWARE_PATH_PATTERN.test(pathname) ? HARDWARE_BODY_LIMIT : MAX_BODY_SIZE;
}

/** Check body size limits for POST/PUT. Returns 413 Response or null to continue. */
function checkBodySize(event: Parameters<Handle>[0]['event']): Response | null {
	if (!BODY_METHODS.has(event.request.method)) return null;
	const contentLength = parseInt(event.request.headers.get('content-length') || '0');
	if (contentLength <= getBodyLimit(event.url.pathname)) return null;
	return new Response(JSON.stringify({ error: 'Payload too large' }), {
		status: 413,
		headers: { 'Content-Type': 'application/json' }
	});
}

/** Attach session cookie and log session creation for browser page requests. */
function attachSessionCookie(event: Parameters<Handle>[0]['event'], response: Response) {
	if (event.url.pathname.startsWith('/api/')) return;
	response.headers.append('Set-Cookie', getSessionCookieHeader());
	logAuthEvent({
		eventType: 'SESSION_CREATED',
		ip: getSafeClientAddress(event),
		method: event.request.method,
		path: event.url.pathname,
		userAgent: event.request.headers.get('user-agent') || undefined
	});
}

export const handle: Handle = async ({ event, resolve }) => {
	// Security middleware pipeline — each returns Response to short-circuit or null to continue
	const wsAuthResponse = handleWsAuth(event);
	if (wsAuthResponse) return wsAuthResponse;

	const apiAuthResponse = handleApiAuth(event);
	if (apiAuthResponse) return apiAuthResponse;

	const rateLimitResponse = checkRateLimit(event);
	if (rateLimitResponse) return rateLimitResponse;

	const bodySizeResponse = checkBodySize(event);
	if (bodySizeResponse) return bodySizeResponse;

	const response = await resolve(event);

	attachSessionCookie(event, response);
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
// globalThis.__argos_hooks_shutdown_registered is typed in src/app.d.ts.
if (dev) {
	if (typeof process !== 'undefined' && !globalThis.__argos_hooks_shutdown_registered) {
		globalThis.__argos_hooks_shutdown_registered = true;
		process.on('SIGINT', () => {
			logger.info('Shutting down WebSocket server...');
			wsManager.destroy();
			wss.close(() => {
				logger.info('WebSocket server closed');
			});
		});
	}
}
