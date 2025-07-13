import '$lib/server/env';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { WebSocketManager } from '$lib/server/kismet';
import { dev } from '$app/environment';
import type { IncomingMessage } from 'http';
import { logger } from '$lib/utils/logger';

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Initialize WebSocket manager
const wsManager = WebSocketManager.getInstance();

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
	logger.info('New WebSocket connection', { from: request.socket.remoteAddress });

	// Parse URL for subscription preferences
	const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
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
	// Handle WebSocket upgrade requests
	if (
		event.url.pathname === '/api/kismet/ws' &&
		event.request.headers.get('upgrade') === 'websocket'
	) {
		// WebSocket upgrade handling requires platform-specific implementation
		// This is a placeholder for the actual WebSocket upgrade logic
		// In production, this would be handled by the deployment platform (e.g., Node.js adapter)
		logger.warn('WebSocket upgrade requested but platform context not available', {
			path: event.url.pathname,
			headers: { upgrade: event.request.headers.get('upgrade') }
		});
	}

	// For non-WebSocket requests, continue with normal handling
	return resolve(event);
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

// Graceful shutdown
if (dev) {
	if (typeof process !== 'undefined') {
		process.on('SIGINT', () => {
			logger.info('Shutting down WebSocket server...');
			wsManager.destroy();
			wss.close(() => {
				logger.info('WebSocket server closed');
			});
		});
	}
}
