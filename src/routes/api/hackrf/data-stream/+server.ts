import type { RequestHandler } from './$types';
import type { SpectrumData } from '$lib/server/hackrf/types';
import { sweepManager } from '$lib/server/hackrf/sweepManager';
import { logInfo, logDebug } from '$lib/utils/logger';

// Track active SSE connections with metadata
interface ConnectionInfo {
	id: string;
	sendEvent: (event: string, data: unknown) => void;
	connectedAt: Date;
	lastActivity: Date;
}

const activeConnections = new Map<string, ConnectionInfo>();

// Generate unique connection ID
let connectionCounter = 0;
const getConnectionId = () => `sse-${Date.now()}-${++connectionCounter}`;

// Periodic cleanup of stale connections
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
const startCleanupInterval = () => {
	if (cleanupInterval) return;

	cleanupInterval = setInterval(() => {
		const now = Date.now();
		const staleTimeout = 60000; // 1 minute of inactivity

		activeConnections.forEach((conn, id) => {
			if (now - conn.lastActivity.getTime() > staleTimeout) {
				logDebug(`Removing stale SSE connection: ${id}`);
				activeConnections.delete(id);
			}
		});

		if (activeConnections.size === 0 && cleanupInterval) {
			clearInterval(cleanupInterval);
			cleanupInterval = null;
		}
	}, 30000); // Check every 30 seconds
};

export const GET: RequestHandler = () => {
	// Shared state between start() and cancel() — hoisted so cancel() can
	// properly clean up EventEmitter listeners and intervals on disconnect.
	// ReadableStream.start() return value is ignored by the Web Streams spec;
	// cancel() is the correct cleanup hook.
	let isConnectionClosed = false;
	let connectionId = '';
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	let onSpectrum: ((data: SpectrumData) => void) | null = null;
	let onSpectrumData: ((data: unknown) => void) | null = null;
	let onStatus: ((status: unknown) => void) | null = null;
	let onError: ((error: unknown) => void) | null = null;
	let onCycleConfig: ((config: unknown) => void) | null = null;
	let onStatusChange: ((change: unknown) => void) | null = null;

	// Create a readable stream for Server-Sent Events
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			connectionId = getConnectionId();

			// Helper function to send SSE messages
			const sendEvent = (event: string, data: unknown) => {
				if (isConnectionClosed) return;

				try {
					const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
					controller.enqueue(encoder.encode(sseMessage));

					// Update last activity
					const conn = activeConnections.get(connectionId);
					if (conn) {
						conn.lastActivity = new Date();
					}
				} catch (error: unknown) {
					// Connection is closed, mark it and clean up
					isConnectionClosed = true;
					activeConnections.delete(connectionId);

					// Only log if it's not a normal close
					if (
						error instanceof Error &&
						!error.message.includes('Controller is already closed')
					) {
						logDebug(`SSE connection ${connectionId} closed with error`, {
							message: error.message,
							stack: error.stack,
							name: error.name
						});
					}
				}
			};

			// Add to active connections
			const connectionInfo: ConnectionInfo = {
				id: connectionId,
				sendEvent,
				connectedAt: new Date(),
				lastActivity: new Date()
			};
			activeConnections.set(connectionId, connectionInfo);
			logInfo(`SSE connection established: ${connectionId}`, {
				totalConnections: activeConnections.size
			});

			// Start cleanup interval if needed
			startCleanupInterval();

			// Set SSE emitter for sweepManager
			if (activeConnections.size === 1) {
				// First connection, set up the emitter
				sweepManager.setSseEmitter((event: string, data: unknown) => {
					// Send to all active connections
					activeConnections.forEach((conn) => conn.sendEvent(event, data));
				});
			}

			// Send initial connection message
			sendEvent('connected', {
				message: 'Connected to HackRF data stream',
				timestamp: new Date().toISOString()
			});

			// Send current status
			const status = sweepManager.getStatus();
			sendEvent('status', status);

			// Throttle spectrum data to prevent overwhelming frontend
			let lastSpectrumTime = 0;
			const SPECTRUM_THROTTLE = 50; // Min 50ms between updates (20Hz max)

			// Subscribe to sweep manager events — assigned to hoisted variables
			// so cancel() can unsubscribe using the exact same function references
			onSpectrum = (data: SpectrumData) => {
				const now = Date.now();
				if (now - lastSpectrumTime >= SPECTRUM_THROTTLE) {
					// Transform data to frontend format
					const transformedData = {
						frequencies:
							data.powerValues && data.startFreq && data.endFreq
								? data.powerValues.map((_, index) => {
										const freqStep =
											(data.endFreq - data.startFreq) /
											(data.powerValues.length - 1);
										return data.startFreq + index * freqStep;
									})
								: [],
						power: data.powerValues || [],
						power_levels: data.powerValues || [],
						start_freq: data.startFreq,
						stop_freq: data.endFreq,
						center_freq: data.frequency,
						peak_freq: data.frequency,
						peak_power: data.power,
						timestamp: data.timestamp
					};
					sendEvent('sweep_data', transformedData);
					lastSpectrumTime = now;
				}
			};
			onStatus = (s: unknown) => sendEvent('status', s);
			onError = (e: unknown) => sendEvent('error', e);
			onCycleConfig = (config: unknown) => sendEvent('cycle_config', config);
			onStatusChange = (change: unknown) => sendEvent('status_change', change);

			// Wrapper for spectrum_data events that extracts nested data.
			// Assigned to a named reference so it can be properly unregistered
			// on connection close in cancel().
			onSpectrumData = (data: unknown) => {
				if (data && typeof data === 'object' && 'data' in data) {
					onSpectrum!((data as { data: unknown }).data);
				} else {
					onSpectrum!(data);
				}
			};

			// Listen for both event names for compatibility
			sweepManager.on('spectrum', onSpectrum);
			sweepManager.on('spectrum_data', onSpectrumData);
			sweepManager.on('status', onStatus);
			sweepManager.on('error', onError);
			sweepManager.on('cycle_config', onCycleConfig);
			sweepManager.on('status_change', onStatusChange);

			// Keep-alive heartbeat - more frequent to prevent timeouts
			heartbeatTimer = setInterval(() => {
				sendEvent('heartbeat', {
					timestamp: new Date().toISOString(),
					connectionId,
					uptime: Date.now() - connectionInfo.connectedAt.getTime()
				});
			}, 10000); // Every 10 seconds (very frequent to ensure stable connection)
		},
		cancel() {
			// Called by Web Streams API when reader is cancelled (SvelteKit
			// cancels the reader on HTTP client disconnect via res.on('close')).
			// Previously this cleanup was in a return value from start() which
			// is ignored by the spec — this is the correct location.
			isConnectionClosed = true;

			// Remove from active connections
			activeConnections.delete(connectionId);
			logInfo(`SSE connection closed: ${connectionId}`, {
				remainingConnections: activeConnections.size
			});

			// If last connection, clear SSE emitter
			if (activeConnections.size === 0) {
				sweepManager.setSseEmitter(null);
				logDebug('All SSE connections closed, clearing emitter');
			}

			// Unsubscribe from events (must use the exact same function references)
			if (onSpectrum) sweepManager.off('spectrum', onSpectrum);
			if (onSpectrumData) sweepManager.off('spectrum_data', onSpectrumData);
			if (onStatus) sweepManager.off('status', onStatus);
			if (onError) sweepManager.off('error', onError);
			if (onCycleConfig) sweepManager.off('cycle_config', onCycleConfig);
			if (onStatusChange) sweepManager.off('status_change', onStatusChange);

			// Clear heartbeat
			if (heartbeatTimer) {
				clearInterval(heartbeatTimer);
				heartbeatTimer = null;
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no' // Disable proxy buffering
		}
	});
};
