import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Proxy selected HackRF API requests to the control backend.
// SECURITY: Only explicitly listed paths are forwarded (SSRF mitigation).
// To add a new endpoint, append it to ALLOWED_PATHS with a justification comment.
const HACKRF_SERVICE_URL = 'http://localhost:3002';

const ALLOWED_PATHS = [
	'status', // Device status polling (hackrf/api.ts, MCP server)
	'health', // Health check endpoint (API index, diagnostics)
	'start-sweep', // Begin RF sweep (hackrf/api.ts, usrp-api.ts)
	'stop-sweep', // Stop RF sweep (hackrf/api.ts, usrp-api.ts, tactical-map)
	'data-stream', // SSE spectrum data stream (hackrf/api.ts, usrp/api.ts)
	'cycle-status', // Sweep cycle status (API index)
	'emergency-stop', // Emergency halt (hackrf-service.ts, error-recovery.ts)
	'force-cleanup', // Force resource cleanup (error-recovery.ts)
	'device-info', // Device hardware info
	'cycle-frequency', // Frequency cycling control
	'export' // Data export (hackrf-service.ts, AnalysisTools.svelte)
] as const;

function isAllowedPath(path: string): boolean {
	return ALLOWED_PATHS.includes(path as (typeof ALLOWED_PATHS)[number]);
}

export const GET: RequestHandler = async ({ params, url, request }) => {
	const path = params.path || '';

	if (!isAllowedPath(path)) {
		return json({ error: 'Endpoint not allowed' }, { status: 404 });
	}

	const queryString = url.search;
	const targetUrl = `${HACKRF_SERVICE_URL}/${path}${queryString}`;

	try {
		// Handle SSE endpoints specially
		if (path === 'data-stream') {
			const response = await fetch(targetUrl, {
				headers: {
					Accept: 'text/event-stream'
				}
			});

			// Return the response with proper SSE headers
			return new Response(response.body, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		// Regular GET request
		const response = await fetch(targetUrl, {
			method: 'GET',
			headers: Object.fromEntries(request.headers)
		});

		const data = await response.text();

		return new Response(data, {
			status: response.status,
			headers: {
				'Content-Type': response.headers.get('Content-Type') || 'application/json',
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (error) {
		console.error('Proxy error:', error);
		return new Response(JSON.stringify({ error: 'Proxy error' }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*'
			}
		});
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	const path = params.path || '';

	if (!isAllowedPath(path)) {
		return json({ error: 'Endpoint not allowed' }, { status: 404 });
	}

	const targetUrl = `${HACKRF_SERVICE_URL}/${path}`;

	try {
		const body = await request.text();

		const response = await fetch(targetUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...Object.fromEntries(request.headers)
			},
			body: body
		});

		const data = await response.text();

		return new Response(data, {
			status: response.status,
			headers: {
				'Content-Type': response.headers.get('Content-Type') || 'application/json',
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (error) {
		console.error('Proxy error:', error);
		return new Response(JSON.stringify({ error: 'Proxy error' }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*'
			}
		});
	}
};

export const OPTIONS: RequestHandler = () => {
	return new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
};
