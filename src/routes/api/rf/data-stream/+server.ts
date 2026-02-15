import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';

import type { RequestHandler } from './$types';

// Event handler types for spectrum data streaming
interface SpectrumData {
	frequency?: number;
	power?: number;
	powerValues?: number[];
	startFreq?: number;
	endFreq?: number;
	timestamp?: number;
}

interface ErrorEvent {
	message: string;
	context?: string;
	timestamp?: Date;
	code?: number | null;
	signal?: NodeJS.Signals | null;
}

interface StatusEvent {
	state?: string;
	isRunning?: boolean;
	[key: string]: unknown;
}

export const GET: RequestHandler = async ({ request }) => {
	const origin = request.headers.get('origin');
	const corsHeaders = getCorsHeaders(origin);
	const headers = {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
		...corsHeaders
	};

	// Shared state between start() and cancel() — hoisted so cancel() can clean up
	let dataHandler: ((data: SpectrumData) => void) | null = null;
	let errorHandler: ((error: ErrorEvent) => void) | null = null;
	let statusHandler: ((status: StatusEvent) => void) | null = null;
	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			// Send initial connection message (HackRF only, USRP support removed)
			controller.enqueue(encoder.encode(`event: connected\ndata: {"device": "hackrf"}\n\n`));

			// HackRF data handler
			dataHandler = (data: SpectrumData) => {
				try {
					// Transform the data if needed
					const transformedData = {
						frequencies:
							data.powerValues &&
							data.startFreq !== undefined &&
							data.endFreq !== undefined &&
							data.powerValues !== undefined
								? (() => {
										const startFreq = data.startFreq;
										const endFreq = data.endFreq;
										const powerValues = data.powerValues;
										return powerValues.map((_: number, index: number) => {
											const freqStep =
												(endFreq - startFreq) / (powerValues.length - 1);
											return startFreq + index * freqStep;
										});
									})()
								: [],
						power: data.powerValues || [],
						power_levels: data.powerValues || [],
						start_freq: data.startFreq,
						stop_freq: data.endFreq,
						center_freq: data.frequency,
						peak_freq: data.frequency,
						peak_power: data.power,
						timestamp: data.timestamp,
						device: 'hackrf'
					};

					const message = `event: spectrumData\ndata: ${JSON.stringify(transformedData)}\n\n`;
					controller.enqueue(encoder.encode(message));
				} catch (error) {
					console.error('Error processing HackRF spectrum data:', error);
				}
			};

			// Error handler
			errorHandler = (error: ErrorEvent) => {
				const message = `event: error\ndata: ${JSON.stringify({
					message: error.message || 'Unknown error',
					device: 'hackrf'
				})}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			// Status handler
			statusHandler = (status: StatusEvent) => {
				const message = `event: status\ndata: ${JSON.stringify({
					...status,
					device: 'hackrf'
				})}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			// Subscribe to HackRF events
			sweepManager.on('spectrumData', dataHandler);
			sweepManager.on('error', errorHandler);
			sweepManager.on('status', statusHandler);

			// Send heartbeat every 30 seconds
			heartbeatInterval = setInterval(() => {
				const heartbeat = `event: heartbeat\ndata: {"time": "${new Date().toISOString()}", "device": "hackrf"}\n\n`;
				controller.enqueue(encoder.encode(heartbeat));
			}, 30000);
		},
		cancel() {
			// Called by Web Streams API when reader is cancelled (SvelteKit
			// cancels the reader on HTTP client disconnect via res.on('close')).
			// Previously this cleanup was in a return value from start() which
			// is ignored by the spec — this is the correct location.
			if (heartbeatInterval) {
				clearInterval(heartbeatInterval);
				heartbeatInterval = null;
			}

			// Cleanup HackRF event handlers
			if (dataHandler) sweepManager.off('spectrumData', dataHandler);
			if (errorHandler) sweepManager.off('error', errorHandler);
			if (statusHandler) sweepManager.off('status', statusHandler);

			dataHandler = null;
			errorHandler = null;
			statusHandler = null;
		}
	});

	return new Response(stream, { headers });
};

// Add CORS headers for OPTIONS
export const OPTIONS: RequestHandler = ({ request }) => {
	const origin = request.headers.get('origin');
	return new Response(null, {
		status: 204,
		headers: getCorsHeaders(origin)
	});
};
