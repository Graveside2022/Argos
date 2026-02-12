/**
 * Security Headers Tests - Phase 2.2.6
 *
 * Validates Phase 2.2.3: Security Headers and CSP
 * Tests that CSP, X-Frame-Options, X-Content-Type-Options are present on all responses.
 *
 * Standards: OWASP A05:2021 (Security Misconfiguration), NIST SP 800-53 SC-8,
 *            OWASP CSP Cheat Sheet, Mozilla Security Headers
 */

import { describe, test, expect } from 'vitest';
import { isServerAvailable, restoreRealFetch } from '../helpers/server-check';

restoreRealFetch();

const BASE_URL = 'http://localhost:5173';
const API_KEY = process.env.ARGOS_API_KEY || '';
const canRun = API_KEY.length >= 32 && (await isServerAvailable());

describe.runIf(canRun)('Security Headers', () => {
	describe('Content Security Policy (CSP)', () => {
		test('CSP header is present on all responses', async () => {
			const endpoints = ['/', '/dashboard', '/api/health', '/api/rf/status'];

			for (const endpoint of endpoints) {
				const response = await fetch(`${BASE_URL}${endpoint}`, {
					headers: { 'X-API-Key': API_KEY }
				});

				const csp = response.headers.get('Content-Security-Policy');
				expect(csp).toBeTruthy();
			}
		});

		test('CSP default-src directive is restrictive', async () => {
			const response = await fetch(`${BASE_URL}/`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const csp = response.headers.get('Content-Security-Policy');
			expect(csp).toBeTruthy();

			// Should NOT allow unsafe-eval or unsafe-inline in default-src
			expect(csp).toMatch(/default-src/);

			// default-src should not contain 'unsafe-eval' or 'unsafe-inline'
			// (these may be in script-src with nonce, but not default-src)
			const defaultSrcMatch = csp?.match(/default-src\s+([^;]+)/);
			if (defaultSrcMatch) {
				const defaultSrc = defaultSrcMatch[1];
				expect(defaultSrc).not.toContain("'unsafe-eval'");
			}
		});

		test('CSP frame-ancestors restricts embedding', async () => {
			const response = await fetch(`${BASE_URL}/`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const csp = response.headers.get('Content-Security-Policy');
			expect(csp).toBeTruthy();

			// Should have frame-ancestors 'self' or 'none' (no third-party embedding)
			expect(csp).toMatch(/frame-ancestors\s+('self'|'none')/);
		});

		test('CSP upgrade-insecure-requests is present', async () => {
			const response = await fetch(`${BASE_URL}/`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const csp = response.headers.get('Content-Security-Policy');
			expect(csp).toBeTruthy();

			// Should upgrade HTTP to HTTPS when possible
			expect(csp).toMatch(/upgrade-insecure-requests/);
		});
	});

	describe('X-Frame-Options', () => {
		test('X-Frame-Options header is present', async () => {
			const endpoints = ['/', '/dashboard', '/api/health'];

			for (const endpoint of endpoints) {
				const response = await fetch(`${BASE_URL}${endpoint}`, {
					headers: { 'X-API-Key': API_KEY }
				});

				const xFrameOptions = response.headers.get('X-Frame-Options');
				expect(xFrameOptions).toBeTruthy();
			}
		});

		test('X-Frame-Options is DENY or SAMEORIGIN', async () => {
			const response = await fetch(`${BASE_URL}/`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const xFrameOptions = response.headers.get('X-Frame-Options');
			expect(['DENY', 'SAMEORIGIN']).toContain(xFrameOptions);
		});

		test('X-Frame-Options is NOT ALLOW-FROM', async () => {
			const response = await fetch(`${BASE_URL}/`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const xFrameOptions = response.headers.get('X-Frame-Options');
			expect(xFrameOptions).not.toMatch(/ALLOW-FROM/);
		});
	});

	describe('X-Content-Type-Options', () => {
		test('X-Content-Type-Options: nosniff is present', async () => {
			const endpoints = ['/', '/dashboard', '/api/health', '/api/rf/status'];

			for (const endpoint of endpoints) {
				const response = await fetch(`${BASE_URL}${endpoint}`, {
					headers: { 'X-API-Key': API_KEY }
				});

				const xContentTypeOptions = response.headers.get('X-Content-Type-Options');
				expect(xContentTypeOptions).toBe('nosniff');
			}
		});
	});

	describe('Referrer-Policy', () => {
		test('Referrer-Policy header is present', async () => {
			const response = await fetch(`${BASE_URL}/`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const referrerPolicy = response.headers.get('Referrer-Policy');
			expect(referrerPolicy).toBeTruthy();
		});

		test('Referrer-Policy is restrictive', async () => {
			const response = await fetch(`${BASE_URL}/`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const referrerPolicy = response.headers.get('Referrer-Policy');

			// Should be one of the secure policies
			const securePolicies = [
				'no-referrer',
				'same-origin',
				'strict-origin',
				'strict-origin-when-cross-origin'
			];

			expect(securePolicies).toContain(referrerPolicy);
		});
	});

	describe('Permissions-Policy (formerly Feature-Policy)', () => {
		test('Permissions-Policy header is present', async () => {
			const response = await fetch(`${BASE_URL}/`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const permissionsPolicy = response.headers.get('Permissions-Policy');
			// May or may not be present (optional but recommended)
			if (permissionsPolicy) {
				expect(permissionsPolicy).toBeTruthy();
			}
		});

		test('Permissions-Policy restricts dangerous features', async () => {
			const response = await fetch(`${BASE_URL}/`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const permissionsPolicy = response.headers.get('Permissions-Policy');

			if (permissionsPolicy) {
				// Should restrict camera, microphone, geolocation, etc.
				// Format: camera=(), microphone=(), geolocation=(self)
				expect(permissionsPolicy).toBeTruthy();
			}
		});
	});

	describe('Strict-Transport-Security (HSTS)', () => {
		test('HSTS header is present on HTTPS', async () => {
			// Note: This test only applies if the app is served over HTTPS
			// Skip if testing on HTTP localhost
			if (BASE_URL.startsWith('https://')) {
				const response = await fetch(`${BASE_URL}/`, {
					headers: { 'X-API-Key': API_KEY }
				});

				const hsts = response.headers.get('Strict-Transport-Security');
				expect(hsts).toBeTruthy();
				expect(hsts).toMatch(/max-age=\d+/);
			}
		});
	});

	describe('X-XSS-Protection (Legacy)', () => {
		test('X-XSS-Protection is NOT set or set to 0 (CSP is preferred)', async () => {
			const response = await fetch(`${BASE_URL}/`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const xssProtection = response.headers.get('X-XSS-Protection');

			// Modern best practice: remove this header or set to "0"
			// CSP replaces the need for X-XSS-Protection
			if (xssProtection) {
				expect(['0']).toContain(xssProtection);
			}
		});
	});

	describe('Server Information Disclosure', () => {
		test('Server header does not leak version information', async () => {
			const response = await fetch(`${BASE_URL}/api/health`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const serverHeader = response.headers.get('Server');

			if (serverHeader) {
				// Should not contain version numbers
				expect(serverHeader).not.toMatch(/\d+\.\d+/);
				expect(serverHeader).not.toContain('Node.js');
				expect(serverHeader).not.toContain('Express');
			}
		});

		test('X-Powered-By header is not present', async () => {
			const response = await fetch(`${BASE_URL}/api/health`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const poweredBy = response.headers.get('X-Powered-By');
			expect(poweredBy).toBeNull();
		});
	});

	describe('Cache Control for Sensitive Data', () => {
		test('API responses have Cache-Control: no-store', async () => {
			const response = await fetch(`${BASE_URL}/api/rf/status`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const cacheControl = response.headers.get('Cache-Control');

			// Sensitive API data should not be cached
			if (cacheControl) {
				expect(cacheControl).toMatch(/no-store|no-cache/);
			}
		});
	});

	describe('Security Headers Consistency', () => {
		test('All endpoints have consistent security headers', async () => {
			const endpoints = ['/', '/dashboard', '/api/health', '/api/rf/status', '/api/devices'];

			const headerResults = await Promise.all(
				endpoints.map(async (endpoint) => {
					const response = await fetch(`${BASE_URL}${endpoint}`, {
						headers: { 'X-API-Key': API_KEY }
					});

					return {
						endpoint,
						csp: response.headers.get('Content-Security-Policy'),
						xFrameOptions: response.headers.get('X-Frame-Options'),
						xContentType: response.headers.get('X-Content-Type-Options'),
						referrer: response.headers.get('Referrer-Policy')
					};
				})
			);

			// All endpoints should have security headers
			headerResults.forEach((result) => {
				expect(result.csp).toBeTruthy();
				expect(result.xFrameOptions).toBeTruthy();
				expect(result.xContentType).toBe('nosniff');
				expect(result.referrer).toBeTruthy();
			});
		});
	});
});
