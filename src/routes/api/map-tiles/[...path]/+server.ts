import type { RequestHandler } from '@sveltejs/kit';

/**
 * Server-side proxy for map tile requests.
 * Forwards requests to Stadia Maps with the API key injected server-side,
 * preventing exposure of the paid API key in client-side JavaScript.
 *
 * Standards: OWASP A05:2021 (Security Misconfiguration)
 * Phase 2.1.3 Subtask 2.1.3.2
 */
export const GET: RequestHandler = async ({ params }) => {
	const apiKey = process.env.STADIA_MAPS_API_KEY;
	if (!apiKey) {
		return new Response(JSON.stringify({ error: 'Map tile service not configured' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const path = params.path;
	if (!path) {
		return new Response('Not found', { status: 404 });
	}

	// Only allow requests to known Stadia Maps paths
	const allowedPrefixes = ['styles/', 'tiles/', 'data/', 'fonts/'];
	const isAllowed = allowedPrefixes.some((prefix) => path.startsWith(prefix));
	if (!isAllowed) {
		return new Response('Forbidden', { status: 403 });
	}

	try {
		const upstreamUrl = `https://tiles.stadiamaps.com/${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey}`;
		const response = await fetch(upstreamUrl);

		if (!response.ok) {
			return new Response(response.statusText, { status: response.status });
		}

		const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
		const body = await response.arrayBuffer();

		// If this is a style JSON, rewrite tile URLs to go through our proxy
		if (contentType.includes('json') && path.includes('style')) {
			const text = new TextDecoder().decode(body);
			const rewritten = text.replace(
				/https:\/\/tiles\.stadiamaps\.com\//g,
				'/api/map-tiles/'
			);
			return new Response(rewritten, {
				headers: {
					'Content-Type': contentType,
					'Cache-Control': 'public, max-age=3600'
				}
			});
		}

		return new Response(body, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=86400'
			}
		});
	} catch {
		return new Response('Upstream error', { status: 502 });
	}
};
