/**
 * Security headers middleware
 * Extracted from hooks.server.ts to keep the main hooks file under 300 lines.
 * Applies CSP, X-Content-Type-Options, X-Frame-Options, etc.
 */

import { dev } from '$app/environment';

/**
 * Apply Content Security Policy and other security headers to a response.
 * MapLibre GL JS creates Web Workers from blob: URLs (non-CSP build inlines worker code
 * as a Blob and calls new Worker(URL.createObjectURL(blob))). Without worker-src blob:,
 * the browser blocks Worker creation and the map renders an empty canvas.
 */
export function applySecurityHeaders(response: Response): void {
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline'",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https://*.tile.openstreetmap.org https://mt0.google.com https://mt1.google.com https://mt2.google.com https://mt3.google.com https://server.arcgisonline.com https://services.arcgisonline.com",
			"connect-src 'self' ws: wss: https://mt0.google.com https://mt1.google.com https://mt2.google.com https://mt3.google.com https://server.arcgisonline.com https://services.arcgisonline.com https://demotiles.maplibre.org",
			"worker-src 'self' blob:",
			"child-src 'self' blob:",
			"frame-src 'self' http://*:2501 http://*:8073 http://*:80",
			"font-src 'self'",
			"object-src 'none'",
			"frame-ancestors 'self'",
			"base-uri 'self'",
			"form-action 'self'"
		].join('; ')
	);

	// Additional security headers (Phase 2.2.3)
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('X-XSS-Protection', '0'); // Disabled per OWASP recommendation
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'geolocation=(self), microphone=(), camera=(), payment=(), usb=()'
	);

	// Force cache refresh in development to prevent stale error messages
	if (dev) {
		response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
		response.headers.set('Pragma', 'no-cache');
		response.headers.set('Expires', '0');
	}
}
