import '$lib/server/env';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { WebSocketManager } from '$lib/server/kismet';
import { dev } from '$app/environment';
import type { IncomingMessage } from 'http';
import { logger } from '$lib/utils/logger';
import { initializeToolExecutionFramework } from '$lib/server/agent/tool-execution/init';
import { scanAllHardware, globalHardwareMonitor } from '$lib/server/hardware';
import {
	validateApiKey,
	validateSecurityConfig,
	getSessionCookieHeader
} from '$lib/server/auth/auth-middleware';

// Request body size limits -- prevents DoS via oversized POST/PUT bodies (Phase 2.1.7)
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB general limit
const HARDWARE_BODY_LIMIT = 64 * 1024; // 64KB for hardware control endpoints

// Hardware endpoint path pattern -- these control physical RF hardware
const HARDWARE_PATH_PATTERN =
	/^\/api\/(hackrf|kismet|gsm-evil|rf|droneid|openwebrx|bettercap|wifite)\//;

// FAIL-CLOSED: Halt startup if ARGOS_API_KEY is not configured or too short.
// This runs at module load time, before the server accepts any connections.
// If the key is missing, the process exits with a FATAL error. (Phase 2.1.1)
validateSecurityConfig();

// Create WebSocket server with payload limit (Phase 2.1.6).
// noServer mode does not support verifyClient -- authentication is enforced
// in the connection handler and in the SvelteKit handle() hook before upgrade.
const wss = new WebSocketServer({ noServer: true, maxPayload: 262144 }); // 256KB

// Initialize WebSocket manager
const wsManager = WebSocketManager.getInstance();

// Initialize tool execution framework (auto-detect and register installed tools)
initializeToolExecutionFramework().catch((error) => {
	logger.error('Failed to initialize tool execution framework', { error });
});

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

		// Start continuous hardware monitoring (scan every 30 seconds)
		globalHardwareMonitor.start(30000);
		logger.info('Hardware monitoring started');
	})
	.catch((error) => {
		logger.error('Failed to scan hardware', { error });
	});

// Handle WebSocket connections (Phase 2.1.6: authentication enforced here
// because noServer mode does not support the verifyClient callback).
wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
	// --- Authentication (Phase 2.1.6) ---
	// Extract API key from token query param or X-API-Key header.
	// Token in query string is acceptable for WebSocket because the WS upgrade
	// request is not logged like HTTP requests, and there is no Referer header
	// leak. This is standard practice (Socket.IO, Phoenix Channels, Action Cable).
	const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
	const apiKey = url.searchParams.get('token') || (request.headers['x-api-key'] as string);

	// Build mock Request with API key header AND cookies (for browser session auth).
	// validateApiKey checks X-API-Key header first, then falls back to session cookie.
	const mockHeaders: Record<string, string> = {};
	if (apiKey) {
		mockHeaders['X-API-Key'] = apiKey;
	}
	const cookieHeader = request.headers.cookie;
	if (cookieHeader) {
		mockHeaders['cookie'] = cookieHeader;
	}
	const mockRequest = new Request('http://localhost', { headers: mockHeaders });

	let authenticated = false;
	try {
		authenticated = validateApiKey(mockRequest);
	} catch {
		// validateApiKey throws if ARGOS_API_KEY is not configured -- fail closed
	}

	if (!authenticated) {
		logger.warn('WebSocket connection rejected: invalid API key', {
			ip: request.socket.remoteAddress
		});
		ws.close(1008, 'Unauthorized'); // 1008 = Policy Violation
		return;
	}

	logger.info('New WebSocket connection (authenticated)', { from: request.socket.remoteAddress });

	// Parse URL for subscription preferences
	const types: string[] | undefined = url.searchParams.get('types')?.split(',') || undefined;
	const minSignal: string | null = url.searchParams.get('minSignal');
	const deviceTypes: string[] | undefined = url.searchParams.get('deviceTypes')?.split(',');

	// Add client with optional subscription preferences
	wsManager.addClient(ws, {
		types: types ? new Set(types) : undefined,
		filters: {
			minSignal: minSignal ? parseInt(minSignal, 10) : undefined,
			deviceTypes
		}
	});
});

export const handle: Handle = async ({ event, resolve }) => {
	// Handle WebSocket upgrade requests (Phase 2.1.6: authenticate before upgrade)
	if (
		event.url.pathname === '/api/kismet/ws' &&
		event.request.headers.get('upgrade') === 'websocket'
	) {
		// Validate API key before allowing WebSocket upgrade.
		// Accept token via query param (standard for WS), X-API-Key header, or session cookie.
		const wsApiKey =
			event.url.searchParams.get('token') || event.request.headers.get('X-API-Key');
		const wsMockHeaders: Record<string, string> = {};
		if (wsApiKey) {
			wsMockHeaders['X-API-Key'] = wsApiKey;
		}
		const wsCookie = event.request.headers.get('cookie');
		if (wsCookie) {
			wsMockHeaders['cookie'] = wsCookie;
		}
		const wsMockRequest = new Request('http://localhost', { headers: wsMockHeaders });

		let wsAuthenticated = false;
		try {
			wsAuthenticated = validateApiKey(wsMockRequest);
		} catch {
			// fail closed
		}

		if (!wsAuthenticated) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// WebSocket upgrade handling requires platform-specific implementation
		// In production, this would be handled by the deployment platform (e.g., Node.js adapter)
		logger.warn('WebSocket upgrade requested but platform context not available', {
			path: event.url.pathname,
			headers: { upgrade: event.request.headers.get('upgrade') }
		});
	}

	// API Authentication gate — all /api/ routes except /api/health (Phase 2.1.1)
	// /api/health is exempt to support monitoring infrastructure without credentials.
	// All other API routes require a valid X-API-Key header or session cookie.
	if (event.url.pathname.startsWith('/api/') && event.url.pathname !== '/api/health') {
		if (!validateApiKey(event.request)) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	// Body size limit check -- runs after auth, before route processing (Phase 2.1.7)
	// Two-tier limits: 64KB for hardware control endpoints, 10MB for general endpoints.
	// Content-Length is checked before body buffering to prevent memory allocation.
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

	// For non-WebSocket requests, continue with normal handling
	const response = await resolve(event);

	// Set session cookie for browser clients on page requests.
	// The cookie contains an HMAC-derived token (not the raw API key).
	// HttpOnly prevents XSS access; SameSite=Strict prevents CSRF;
	// Path=/api/ limits the cookie to API requests only.
	if (!event.url.pathname.startsWith('/api/')) {
		response.headers.append('Set-Cookie', getSessionCookieHeader());
	}

	// Add security headers with cache busting for development
	response.headers.set(
		'Permissions-Policy',
		'geolocation=(self), microphone=(), camera=(), payment=(), usb=()'
	);

	// Force cache refresh in development to prevent stale error messages
	if (dev) {
		response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
		response.headers.set('Pragma', 'no-cache');
		response.headers.set('Expires', '0');
	}

	return response;
};

/**
 * Global error handler for unhandled server-side errors
 *
 * This hook catches all unhandled errors that occur during request processing,
 * logs them with full context for debugging, and returns a safe, standardized
 * response to the client without leaking sensitive information.
 *
 * @param error - The error that was thrown
 * @param event - The request event that caused the error
 * @returns A safe error response with a unique ID for tracking
 */
export const handleError: HandleServerError = ({ error, event }) => {
	// Generate a unique error ID for tracking and correlation
	const errorId = crypto.randomUUID();

	// Extract error details safely
	const errorDetails = {
		errorId,
		url: event.url.pathname,
		method: event.request.method,
		userAgent: event.request.headers.get('user-agent'),
		timestamp: new Date().toISOString(),
		// Include error details based on type
		...(error instanceof Error
			? {
					name: error.name,
					message: error.message,
					stack: error.stack,
					// Include any custom properties that might be on the error
					...Object.getOwnPropertyNames(error).reduce(
						(acc, prop) => {
							if (!['name', 'message', 'stack'].includes(prop)) {
								acc[prop] = (error as unknown as Record<string, unknown>)[prop];
							}
							return acc;
						},
						{} as Record<string, unknown>
					)
				}
			: {
					// Handle non-Error objects
					error: String(error),
					type: typeof error
				})
	};

	// Log the full error for debugging with all available context
	logger.error('Unhandled server error occurred', errorDetails);

	// Return a generic, safe response to the client
	// Only include sensitive information in development mode
	return {
		message: 'An internal server error occurred. We have been notified.',
		errorId,
		// Only include stack trace in development for debugging
		// This prevents sensitive information leakage in production
		stack: dev && error instanceof Error ? error.stack : undefined
	};
};

// Graceful shutdown — guarded via globalThis to prevent listener accumulation
// on Vite HMR reloads. A module-level boolean would be reset on each reload,
// so we use globalThis which persists across module re-evaluations.
// Docker logs confirmed 11+ SIGINT listeners without this guard.
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
