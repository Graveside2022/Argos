/**
 * Rate limiting middleware helpers
 * Extracted from hooks.server.ts to keep the main hooks file under 300 lines.
 */

import type { Handle } from '@sveltejs/kit';

import { logAuthEvent } from '$lib/server/security/auth-audit';
import { RateLimiter } from '$lib/server/security/rate-limiter';

// Singleton rate limiter (globalThis for HMR persistence) - Phase 2.2.5
// Safe: globalThis typed as Record for dynamic property access
export const rateLimiter =
	((globalThis as Record<string, unknown>).__rateLimiter as RateLimiter) ?? new RateLimiter();
// Safe: globalThis typed as Record for dynamic property assignment
(globalThis as Record<string, unknown>).__rateLimiter = rateLimiter;

// Cleanup interval (globalThis guard for HMR) - Phase 2.2.5
if (!(globalThis as Record<string, unknown>).__rateLimiterCleanup) {
	(globalThis as Record<string, unknown>).__rateLimiterCleanup = setInterval(
		() => rateLimiter.cleanup(),
		300_000 // 5 minutes
	);
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

/**
 * Get rate limit identifier - uses session cookie when IP unavailable.
 * This prevents all Tailscale clients from sharing the same rate limit bucket.
 */
export function getRateLimitKey(event: Parameters<Handle>[0]['event'], prefix: string): string {
	try {
		const ip = event.getClientAddress();
		return `${prefix}:${ip}`;
	} catch {
		const cookieHeader = event.request.headers.get('cookie');
		if (cookieHeader) {
			const sessionMatch = cookieHeader.match(/__argos_session=([^;]+)/);
			if (sessionMatch) {
				return `${prefix}:session:${sessionMatch[1].slice(0, 16)}`;
			}
		}
		return `${prefix}:unknown`;
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

/**
 * Apply rate limiting to a request. Returns a 429 Response if rate limit
 * is exceeded, or null if the request should proceed.
 */
export function checkRateLimit(event: Parameters<Handle>[0]['event']): Response | null {
	const path = event.url.pathname;
	const clientIp = getSafeClientAddress(event);

	// Skip rate limiting for streaming/SSE endpoints and map tiles
	if (
		path.includes('data-stream') ||
		path.includes('/stream') ||
		path.endsWith('/sse') ||
		path.startsWith('/api/map-tiles/')
	) {
		return null;
	}

	if (isHardwareControlPath(path)) {
		const hwKey = getRateLimitKey(event, 'hw');
		const hwLimit = hwKey.includes('unknown') ? 60 : 30;
		if (!rateLimiter.check(hwKey, hwLimit, hwLimit / 60)) {
			logAuthEvent({
				eventType: 'RATE_LIMIT_EXCEEDED',
				ip: clientIp,
				method: event.request.method,
				path,
				reason: `Hardware control rate limit exceeded (${hwLimit} req/min)`
			});
			return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
			});
		}
	} else if (path.startsWith('/api/')) {
		const apiKey = getRateLimitKey(event, 'api');
		if (!rateLimiter.check(apiKey, 200, 200 / 60)) {
			logAuthEvent({
				eventType: 'RATE_LIMIT_EXCEEDED',
				ip: clientIp,
				method: event.request.method,
				path,
				reason: 'API rate limit exceeded (200 req/min)'
			});
			return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json', 'Retry-After': '10' }
			});
		}
	}

	return null;
}
