/**
 * API Authentication Middleware — Fail-Closed Design
 *
 * Phase 2.1.1: All API endpoints require authentication via X-API-Key header.
 * Browser clients receive a secure session cookie set on page load.
 *
 * Design rationale:
 *   - API key-based: Appropriate for single-operator tactical device
 *   - Fail-closed (Regrade A3): System refuses to start without ARGOS_API_KEY
 *   - Header-only for programmatic access (Regrade A4): No query string credentials
 *   - Session cookie for browser clients: HttpOnly, SameSite=Strict, Path=/api/
 *   - Timing-safe comparison via HMAC normalization prevents side-channel attacks
 *
 * Standards: OWASP A01:2021, OWASP A07:2021, NIST SP 800-53 AC-3/IA-5,
 *            NASA/JPL Power of Ten Rule 1
 */

import { createHmac,timingSafeEqual } from 'crypto';

import { logger } from '$lib/utils/logger';

const SESSION_COOKIE_NAME = '__argos_session';
const HMAC_SECRET = 'argos-session-v1';

/**
 * Validate an incoming request against the configured API key.
 *
 * Accepts authentication via two mechanisms:
 *   1. X-API-Key header (programmatic access: curl, MCP server, scripts)
 *   2. Session cookie (browser clients, set automatically on page load)
 *
 * Query string credentials are explicitly rejected per OWASP A07:2021.
 *
 * @returns true if the request is authenticated, false otherwise
 * @throws Error if ARGOS_API_KEY is not configured (should never happen
 *         if validateSecurityConfig() ran at startup)
 */
export function validateApiKey(request: Request): boolean {
	const expectedKey = process.env.ARGOS_API_KEY;

	if (!expectedKey) {
		// FAIL-CLOSED: No API key configured = cannot validate.
		// This path should be unreachable if validateSecurityConfig() ran at startup.
		throw new Error('ARGOS_API_KEY not configured. Refusing to validate requests.');
	}

	// Check X-API-Key header first (primary mechanism for programmatic access)
	const headerKey = request.headers.get('X-API-Key');
	if (headerKey) {
		return safeCompare(headerKey, expectedKey);
	}

	// Check session cookie (browser client mechanism)
	const cookieHeader = request.headers.get('cookie');
	if (cookieHeader) {
		const sessionToken = parseCookieValue(cookieHeader, SESSION_COOKIE_NAME);
		if (sessionToken) {
			const expectedToken = deriveSessionToken(expectedKey);
			return safeCompare(sessionToken, expectedToken);
		}
	}

	return false;
}

/**
 * Timing-safe string comparison using HMAC normalization.
 *
 * Raw timingSafeEqual throws on mismatched buffer lengths, which leaks
 * length information. HMAC normalization produces fixed-length (32-byte)
 * digests regardless of input, ensuring constant-time comparison for
 * all inputs.
 */
function safeCompare(a: string, b: string): boolean {
	const hmacA = createHmac('sha256', HMAC_SECRET).update(a).digest();
	const hmacB = createHmac('sha256', HMAC_SECRET).update(b).digest();
	return timingSafeEqual(hmacA, hmacB);
}

/**
 * Derive an HMAC-SHA256 session token from the API key.
 *
 * The session cookie contains this derived token, NOT the raw API key.
 * Benefits:
 *   - API key is never stored in a cookie
 *   - If the session cookie leaks, it cannot be used as an X-API-Key header value
 *   - Token is deterministic: same API key always produces the same token
 */
export function deriveSessionToken(apiKey: string): string {
	return createHmac('sha256', HMAC_SECRET).update(apiKey).digest('hex');
}

/**
 * Generate the Set-Cookie header value for browser session authentication.
 *
 * Cookie attributes:
 *   - HttpOnly: Not accessible to client-side JavaScript (XSS protection)
 *   - SameSite=Strict: Only sent for same-origin requests (CSRF protection)
 *   - Path=/api/: Only sent for API requests (minimizes exposure)
 *   - Max-Age=86400: 24-hour expiry, re-set on each page load
 */
export function getSessionCookieHeader(): string {
	const apiKey = process.env.ARGOS_API_KEY;
	if (!apiKey) {
		throw new Error('ARGOS_API_KEY not configured.');
	}
	const token = deriveSessionToken(apiKey);
	return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/api/; Max-Age=86400`;
}

/**
 * Startup validation — call during server initialization.
 *
 * FAIL-CLOSED: If ARGOS_API_KEY is not set or is too short, the process
 * exits immediately with a fatal error. This runs at module load time
 * in hooks.server.ts, before the server accepts any connections.
 *
 * Minimum key length: 32 characters (256 bits of entropy when hex-encoded)
 * Generate with: openssl rand -hex 32
 */
export function validateSecurityConfig(): void {
	const apiKey = process.env.ARGOS_API_KEY;

	if (!apiKey) {
		logger.error('FATAL: ARGOS_API_KEY environment variable is not set.');
		logger.error('The system cannot start without an API key configured.');
		logger.error('Set ARGOS_API_KEY in .env or environment before starting.');
		logger.error('Generate with: openssl rand -hex 32');
		process.exit(1);
	}

	if (apiKey.length < 32) {
		logger.error('FATAL: ARGOS_API_KEY must be at least 32 characters.');
		logger.error(`Current length: ${apiKey.length}. Minimum required: 32.`);
		logger.error('Generate with: openssl rand -hex 32');
		process.exit(1);
	}
}

/**
 * Parse a specific cookie value from a Cookie header string.
 *
 * Implements RFC 6265 cookie parsing: semicolon-separated name=value pairs.
 * Returns null if the cookie is not found.
 */
function parseCookieValue(cookieHeader: string, name: string): string | null {
	const cookies = cookieHeader.split(';');
	for (const cookie of cookies) {
		const [cookieName, ...rest] = cookie.trim().split('=');
		if (cookieName === name) {
			return rest.join('=');
		}
	}
	return null;
}
