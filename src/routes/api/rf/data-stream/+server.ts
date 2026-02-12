import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';
import { UsrpSweepManager } from '$lib/server/usrp/sweep-manager';

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

export const GET: RequestHandler = async ({ url, request }) => {
	const origin = request.headers.get('origin');
	const corsHeaders = getCorsHeaders(origin);
	const headers = {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
		...corsHeaders
	};

	const deviceType = url.searchParams.get('device') || 'auto';

	// Shared state between start() and cancel() — hoisted so cancel() can clean up
	let activeDevice: string = deviceType;
	let dataHandler: ((data: SpectrumData) => void) | null = null;
	let errorHandler: ((error: ErrorEvent) => void) | null = null;
	let statusHandler: ((status: StatusEvent) => void) | null = null;
	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			// Send initial connection message
			controller.enqueue(
				encoder.encode(`event: connected\ndata: {"device": "${deviceType}"}\n\n`)
			);

			if (deviceType === 'auto') {
				// Auto-detect which device is active
				const usrpManager = UsrpSweepManager.getInstance();
				const usrpStatus = usrpManager.getStatus() as StatusEvent;
				const hackrfStatus = sweepManager.getStatus();

				if (usrpStatus.isRunning) {
					activeDevice = 'usrp';
				} else if (hackrfStatus.state === 'running' || hackrfStatus.state === 'sweeping') {
					activeDevice = 'hackrf';
				}
			}

			if (activeDevice === 'usrp') {
				const usrpManager = UsrpSweepManager.getInstance();

				// USRP data handler
				dataHandler = (data: SpectrumData) => {
					try {
						// Transform USRP data to frontend format
						const transformedData = {
							frequencies: data.frequency ? [data.frequency] : [],
							power: data.power ? [data.power] : [],
							power_levels: data.powerValues || [data.power],
							start_freq: data.startFreq || data.frequency,
							stop_freq: data.endFreq || data.frequency,
							center_freq: data.frequency,
							peak_freq: data.frequency,
							peak_power: data.power,
							timestamp: data.timestamp,
							device: 'usrp'
						};

						const message = `event: spectrumData\ndata: ${JSON.stringify(transformedData)}\n\n`;
						controller.enqueue(encoder.encode(message));
					} catch (error) {
						console.error('Error processing USRP spectrum data:', error);
					}
				};

				// Error handler
				errorHandler = (error: ErrorEvent) => {
					const message = `event: error\ndata: ${JSON.stringify({
						message: error.message || 'Unknown error',
						device: 'usrp'
					})}\n\n`;
					controller.enqueue(encoder.encode(message));
				};

				// Status handler
				statusHandler = (status: StatusEvent) => {
					const message = `event: status\ndata: ${JSON.stringify({
						...status,
						device: 'usrp'
					})}\n\n`;
					controller.enqueue(encoder.encode(message));
				};

				// Subscribe to USRP events
				usrpManager.on('spectrumData', dataHandler);
				usrpManager.on('error', errorHandler);
				usrpManager.on('status', statusHandler);
			} else {
				// HackRF data handler (default)
				dataHandler = (data: SpectrumData) => {
					try {
						// Transform the data if needed
						const transformedData = {
							frequencies: data.powerValues
								? data.powerValues.map((_: number, index: number) => {
										const freqStep =
											(data.endFreq! - data.startFreq!) /
											(data.powerValues!.length - 1);
										return data.startFreq! + index * freqStep;
									})
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
			}

			// Send heartbeat every 30 seconds
			heartbeatInterval = setInterval(() => {
				const heartbeat = `event: heartbeat\ndata: {"time": "${new Date().toISOString()}", "device": "${activeDevice}"}\n\n`;
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

			if (activeDevice === 'usrp') {
				const usrpManager = UsrpSweepManager.getInstance();
				if (dataHandler) usrpManager.off('spectrumData', dataHandler);
				if (errorHandler) usrpManager.off('error', errorHandler);
				if (statusHandler) usrpManager.off('status', statusHandler);
			} else {
				if (dataHandler) sweepManager.off('spectrumData', dataHandler);
				if (errorHandler) sweepManager.off('error', errorHandler);
				if (statusHandler) sweepManager.off('status', statusHandler);
			}
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
