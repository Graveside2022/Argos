import type { RequestHandler } from '@sveltejs/kit';

const SPIDERFOOT_BASE = 'http://127.0.0.1:5002';
const PROXY_PREFIX = '/api/spiderfoot/proxy';

/** Headers to strip from SpiderFoot responses to allow iframe embedding */
const STRIPPED_HEADERS = new Set(['x-frame-options', 'content-security-policy']);

/**
 * Rewrite absolute paths in SpiderFoot HTML so assets route through the proxy.
 * Also sets the JS `docroot` variable so jQuery AJAX calls route correctly.
 */
function rewriteHtml(html: string): string {
	return html
		.replace(/(href|src|action)="\/(?!api\/)/g, `$1="${PROXY_PREFIX}/`)
		.replace(/(href|src|action)='\/(?!api\/)/g, `$1='${PROXY_PREFIX}/`)
		.replace(/var docroot = '';/, `var docroot = '${PROXY_PREFIX}';`)
		.replace(/url: "\/(?!api\/)/g, `url: "${PROXY_PREFIX}/`)
		.replace(/url: '\/(?!api\/)/g, `url: '${PROXY_PREFIX}/`)
		.replace(/\.href = "\/(?!api\/)/g, `.href = "${PROXY_PREFIX}/`)
		.replace(/\.href = '\/(?!api\/)/g, `.href = '${PROXY_PREFIX}/`)
		.replace(/\.src = "\/(?!api\/)/g, `.src = "${PROXY_PREFIX}/`)
		.replace(/\.src = '\/(?!api\/)/g, `.src = '${PROXY_PREFIX}/`);
}

/** Rewrite hardcoded absolute URLs in SpiderFoot JavaScript files. */
function rewriteJs(js: string): string {
	return js
		.replace(/url: "\/(?!api\/)/g, `url: "${PROXY_PREFIX}/`)
		.replace(/url: '\/(?!api\/)/g, `url: '${PROXY_PREFIX}/`)
		.replace(/"\/search"/g, `"${PROXY_PREFIX}/search"`);
}

/** Extract relevant headers from the client request for upstream forwarding. */
function buildUpstreamHeaders(request: Request): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: request.headers.get('accept') || '*/*'
	};
	const encoding = request.headers.get('accept-encoding');
	if (encoding) headers['Accept-Encoding'] = encoding;
	const contentType = request.headers.get('content-type');
	if (contentType) headers['Content-Type'] = contentType;
	return headers;
}

/** Copy upstream response headers, stripping those that block iframe embedding. */
function stripBlockingHeaders(upstream: Response): Headers {
	const headers = new Headers();
	for (const [key, value] of upstream.headers.entries()) {
		if (!STRIPPED_HEADERS.has(key.toLowerCase())) {
			headers.set(key, value);
		}
	}
	return headers;
}

/** Build a text response with rewritten content and corrected content-length. */
function buildTextResponse(body: string, upstream: Response, headers: Headers): Response {
	headers.set('content-length', String(Buffer.byteLength(body)));
	return new Response(body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers
	});
}

/** Rewrite response body if HTML or JS, otherwise pass through unchanged. */
async function buildRewrittenResponse(upstream: Response, headers: Headers): Promise<Response> {
	const contentType = upstream.headers.get('content-type') || '';
	if (contentType.includes('text/html')) {
		return buildTextResponse(rewriteHtml(await upstream.text()), upstream, headers);
	}
	if (contentType.includes('javascript')) {
		return buildTextResponse(rewriteJs(await upstream.text()), upstream, headers);
	}
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers
	});
}

/**
 * Reverse proxy for SpiderFoot web UI.
 * Protected by Argos's auth middleware in hooks.server.ts.
 */
async function proxyToSpiderfoot(request: Request, path: string): Promise<Response> {
	const upstream = await fetch(new URL(`${SPIDERFOOT_BASE}/${path}`).toString(), {
		method: request.method,
		headers: buildUpstreamHeaders(request),
		body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
		// @ts-expect-error duplex needed for streaming body
		duplex: request.body ? 'half' : undefined
	});
	return buildRewrittenResponse(upstream, stripBlockingHeaders(upstream));
}

export const GET: RequestHandler = async ({ request, params }) => {
	try {
		return await proxyToSpiderfoot(request, params.path || '');
	} catch {
		return new Response('SpiderFoot is not running', { status: 502 });
	}
};

export const POST: RequestHandler = async ({ request, params }) => {
	try {
		return await proxyToSpiderfoot(request, params.path || '');
	} catch {
		return new Response('SpiderFoot is not running', { status: 502 });
	}
};
