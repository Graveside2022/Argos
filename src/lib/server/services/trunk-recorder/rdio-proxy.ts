import type { Handle } from '@sveltejs/kit';

import { env } from '$lib/server/env';

/**
 * Reverse-proxy rule for /rdio/* → rdio-scanner container on localhost:3000.
 *
 * The Svelte page for trunk-recorder embeds rdio-scanner's UI in an iframe
 * sourced from /rdio/. Reverse-proxying via Argos keeps the iframe same-origin
 * (avoids CSP frame-src exception + cookie domain issues) and inherits the
 * Argos auth gate — /rdio/* traffic only reaches the container after the
 * operator has a valid ARGOS_API_KEY or session cookie.
 *
 * WebSocket upgrades: rdio-scanner uses WS for live call push. Our WebSocket
 * server in hooks.server.ts only handles /api/kismet/ws; other upgrade paths
 * fall through — fetch() against localhost:3000 doesn't tunnel WS. The iframe
 * page inside rdio-scanner's UI also talks to its server via HTTP polling for
 * the call list when WS isn't available, so the HTTP proxy covers the
 * primary operator experience. (Full WS proxying is a Phase 4 polish item.)
 */

const PROXY_PREFIX = '/rdio';
const HOP_BY_HOP_HEADERS = new Set([
	'connection',
	'keep-alive',
	'proxy-authenticate',
	'proxy-authorization',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'host',
	'content-length'
]);

function copyRequestHeaders(src: Headers): Headers {
	const out = new Headers();
	for (const [name, value] of src.entries()) {
		if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) out.append(name, value);
	}
	return out;
}

function copyResponseHeaders(src: Headers): Headers {
	const out = new Headers();
	for (const [name, value] of src.entries()) {
		if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) out.append(name, value);
	}
	return out;
}

function rewriteTargetUrl(pathname: string, search: string): string {
	const rewritten = pathname.slice(PROXY_PREFIX.length) || '/';
	return `${env.RDIO_SCANNER_URL}${rewritten}${search}`;
}

/**
 * Called from the main `handle` hook in hooks.server.ts before `resolve(event)`.
 * Returns a Response when the request should be proxied, or null to fall through.
 */
export const handleRdioProxy: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;
	if (!pathname.startsWith(PROXY_PREFIX)) return resolve(event);

	const target = rewriteTargetUrl(pathname, search);
	const method = event.request.method;
	const headers = copyRequestHeaders(event.request.headers);
	const body = ['GET', 'HEAD'].includes(method) ? undefined : await event.request.arrayBuffer();

	const upstream = await fetch(target, { method, headers, body, redirect: 'manual' });
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: copyResponseHeaders(upstream.headers)
	});
};
