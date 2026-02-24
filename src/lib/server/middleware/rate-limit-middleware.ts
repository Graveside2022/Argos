/**
 * Rate limiting middleware helpers
 * Extracted from hooks.server.ts to keep the main hooks file under 300 lines.
 */

import type { Handle } from '@sveltejs/kit';

import { logAuthEvent } from '$lib/server/security/auth-audit';
import { RateLimiter } from '$lib/server/security/rate-limiter';

// Singleton rate limiter (globalThis for HMR persistence) - Phase 2.2.5
// globalThis.__rateLimiter and __rateLimiterCleanup are typed in src/app.d.ts.
export const rateLimiter =
	globalThis.__rateLimiter ?? (globalThis.__rateLimiter = new RateLimiter());

// Cleanup interval (globalThis guard for HMR) - Phase 2.2.5
if (!globalThis.__rateLimiterCleanup) {
	globalThis.__rateLimiterCleanup = setInterval(
		() => rateLimiter.cleanup(),
		300_000 // 5 minutes
	);
}

/** Stop the rate-limiter cleanup interval and remove the globalThis reference. */
export function disposeRateLimiter(): void {
	if (globalThis.__rateLimiterCleanup !== undefined) {
		clearInterval(globalThis.__rateLimiterCleanup);
		globalThis.__rateLimiterCleanup = undefined;
	}
}

/**
 * Safe client address getter - handles VPN/Tailscale networking issues.
 * Returns 'unknown' when client address cannot be determined.
 */
export function getSafeClientAddress(event: Parameters<Handle>[0]['event']): string {
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown';
	}
}

/** Extract session identifier from cookie header, or null if unavailable. */
function extractSessionId(cookieHeader: string | null): string | null {
	if (!cookieHeader) return null;
	const sessionMatch = cookieHeader.match(/__argos_session=([^;]+)/);
	return sessionMatch ? sessionMatch[1].slice(0, 16) : null;
}

/**
 * Get rate limit identifier - uses session cookie when IP unavailable.
 * This prevents all Tailscale clients from sharing the same rate limit bucket.
 */
export function getRateLimitKey(event: Parameters<Handle>[0]['event'], prefix: string): string {
	try {
		return `${prefix}:${event.getClientAddress()}`;
	} catch {
		const sessionId = extractSessionId(event.request.headers.get('cookie'));
		return sessionId ? `${prefix}:session:${sessionId}` : `${prefix}:unknown`;
	}
}

/**
 * Check if a path is a hardware control endpoint.
 * Hardware control endpoints have stricter rate limits.
 */
export function isHardwareControlPath(path: string): boolean {
	const hwPatterns = [
		'/api/hackrf/',
		'/api/kismet/control/',
		'/api/gsm-evil/control',
		'/api/droneid/',
		'/api/rf/',
		'/api/openwebrx/control/'
	];
	return hwPatterns.some((p) => path.startsWith(p));
}

/** Check if this path should skip rate limiting (streaming/SSE endpoints and map tiles). */
function isStreamingPath(path: string): boolean {
	return (
		path.includes('data-stream') ||
		path.endsWith('/stream') ||
		path.endsWith('/sse') ||
		path.startsWith('/api/map-tiles/')
	);
}

/** Build a 429 rate-limit response and log the audit event. */
function buildRateLimitResponse(
	ip: string,
	method: string,
	path: string,
	reason: string,
	retryAfter: string
): Response {
	logAuthEvent({ eventType: 'RATE_LIMIT_EXCEEDED', ip, method, path, reason });
	return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
		status: 429,
		headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter }
	});
}

/** Check hardware control rate limit. Returns 429 Response or null. */
function checkHardwareRateLimit(event: Parameters<Handle>[0]['event']): Response | null {
	const hwKey = getRateLimitKey(event, 'hw');
	const hwLimit = hwKey.includes('unknown') ? 60 : 30;
	if (rateLimiter.check(hwKey, hwLimit, hwLimit / 60)) return null;
	return buildRateLimitResponse(
		getSafeClientAddress(event),
		event.request.method,
		event.url.pathname,
		`Hardware control rate limit exceeded (${hwLimit} req/min)`,
		'60'
	);
}

/** Check API rate limit. Returns 429 Response or null. */
function checkApiRateLimit(event: Parameters<Handle>[0]['event']): Response | null {
	const apiKey = getRateLimitKey(event, 'api');
	if (rateLimiter.check(apiKey, 200, 200 / 60)) return null;
	return buildRateLimitResponse(
		getSafeClientAddress(event),
		event.request.method,
		event.url.pathname,
		'API rate limit exceeded (200 req/min)',
		'10'
	);
}

/**
 * Apply rate limiting to a request. Returns a 429 Response if rate limit
 * is exceeded, or null if the request should proceed.
 */
export function checkRateLimit(event: Parameters<Handle>[0]['event']): Response | null {
	const path = event.url.pathname;
	if (isStreamingPath(path)) return null;
	if (isHardwareControlPath(path)) return checkHardwareRateLimit(event);
	if (path.startsWith('/api/')) return checkApiRateLimit(event);
	return null;
}
