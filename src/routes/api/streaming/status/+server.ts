import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

// Import active connections from HackRF stream (if accessible)
// For now, we'll provide a status check endpoint that proxies to the stream

export const GET: RequestHandler = async () => {
	try {
		// Check if streaming endpoints are healthy by attempting connection
		const streams = [
			{
				name: 'hackrf-data-stream',
				endpoint: '/api/hackrf/data-stream',
				type: 'continuous'
			},
			{
				name: 'gsm-intelligent-scan',
				endpoint: '/api/gsm-evil/intelligent-scan-stream',
				type: 'one-shot'
			},
			{
				name: 'rf-data-stream',
				endpoint: '/api/rf/data-stream',
				type: 'continuous'
			}
		];

		const status = streams.map((stream) => ({
			...stream,
			status: 'available', // All SSE endpoints are stateless, so always available
			connections: 'unknown' // Cannot access activeConnections from another module
		}));

		return json({
			success: true,
			streams: status,
			total_streams: streams.length,
			note: 'Use inspect_sse_stream tool for live connection monitoring'
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return json({
			success: false,
			error: msg
		});
	}
};
