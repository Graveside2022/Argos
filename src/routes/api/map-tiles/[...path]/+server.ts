import type { RequestHandler } from '@sveltejs/kit';

/**
 * Server-side proxy for map tile requests.
 * Forwards requests to Stadia Maps with the API key injected server-side,
 * preventing exposure of the paid API key in client-side JavaScript.
 *
 * Standards: OWASP A05:2021 (Security Misconfiguration)
 * Phase 2.1.3 Subtask 2.1.3.2
 */
const ALLOWED_PREFIXES = ['styles/', 'tiles/', 'data/', 'fonts/'];

/** Validate request params, returning error Response or validated { apiKey, path }. */
function validateTileRequest(params: { path?: string }): {
	error?: Response;
	apiKey?: string;
	path?: string;
} {
	const apiKey = process.env.STADIA_MAPS_API_KEY;
	if (!apiKey) {
		return {
			error: new Response(JSON.stringify({ error: 'Map tile service not configured' }), {
				status: 503,
				headers: { 'Content-Type': 'application/json' }
			})
		};
	}
	const path = params.path;
	if (!path) return { error: new Response('Not found', { status: 404 }) };
	const isAllowed = ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
	if (!isAllowed) return { error: new Response('Forbidden', { status: 403 }) };
	return { apiKey, path };
}

/** Rewrite Stadia Maps URLs to route through our proxy and strip leaked API keys. */
function rewriteJsonBody(text: string, baseUrl: string): string {
	const proxied = text.replace(
		/https:\/\/tiles\.stadiamaps\.com\//g,
		`${baseUrl}/api/map-tiles/`
	);
	return proxied.replace(/([?&])api_key=[^"&\s]+/g, () => '');
}

/** Build a tile response, rewriting JSON bodies to proxy through our server. */
function buildTileResponse(contentType: string, body: ArrayBuffer, baseUrl: string): Response {
	if (contentType.includes('json')) {
		const rewritten = rewriteJsonBody(new TextDecoder().decode(body), baseUrl);
		return new Response(rewritten, {
			headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' }
		});
	}
	return new Response(body, {
		headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' }
	});
}

/** Fetch a tile from Stadia Maps upstream and build the proxied response. */
async function fetchAndProxy(path: string, apiKey: string, baseUrl: string): Promise<Response> {
	const sep = path.includes('?') ? '&' : '?';
	const response = await fetch(`https://tiles.stadiamaps.com/${path}${sep}api_key=${apiKey}`);
	if (!response.ok) return new Response(response.statusText, { status: response.status });
	const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
	return buildTileResponse(contentType, await response.arrayBuffer(), baseUrl);
}

export const GET: RequestHandler = async ({ params, url }) => {
	const validated = validateTileRequest(params);
	if (validated.error) return validated.error;

	try {
		return await fetchAndProxy(
			validated.path!,
			validated.apiKey!,
			`${url.protocol}//${url.host}`
		);
	} catch {
		return new Response('Upstream error', { status: 502 });
	}
};
