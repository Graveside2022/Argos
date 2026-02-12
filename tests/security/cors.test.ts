/**
 * CORS Security Tests - Phase 2.2.6
 *
 * Validates Phase 2.2.2: CORS Restriction
 * Tests that unknown origins receive no CORS headers; known origins receive correct headers.
 *
 * Standards: OWASP A05:2021 (Security Misconfiguration), OWASP A07:2021 (SSRF),
 *            NIST SP 800-53 SC-7 (Boundary Protection)
 */

import { describe, expect,test } from 'vitest';

import { isServerAvailable, restoreRealFetch } from '../helpers/server-check';

restoreRealFetch();

const BASE_URL = 'http://localhost:5173';
const API_KEY = process.env.ARGOS_API_KEY || '';
const canRun = API_KEY.length >= 32 && (await isServerAvailable());

describe.runIf(canRun)('CORS Security', () => {
	describe('Known Origins - CORS Allowed', () => {
		const allowedOrigins = [
			'http://localhost:5173',
			'http://127.0.0.1:5173',
			'http://0.0.0.0:5173'
		];

		test.each(allowedOrigins)(
			'%s receives Access-Control-Allow-Origin header',
			async (origin) => {
				const response = await fetch(`${BASE_URL}/api/health`, {
					headers: {
						Origin: origin,
						'X-API-Key': API_KEY
					}
				});

				const corsHeader = response.headers.get('Access-Control-Allow-Origin');
				expect(corsHeader).toBeTruthy();
				expect(corsHeader).toBe(origin);
			}
		);

		test.each(allowedOrigins)(
			'%s receives Access-Control-Allow-Credentials: true',
			async (origin) => {
				const response = await fetch(`${BASE_URL}/api/health`, {
					headers: {
						Origin: origin,
						'X-API-Key': API_KEY
					}
				});

				const credentialsHeader = response.headers.get('Access-Control-Allow-Credentials');
				expect(credentialsHeader).toBe('true');
			}
		);
	});

	describe('Unknown Origins - CORS Blocked', () => {
		const maliciousOrigins = [
			'http://evil.com',
			'https://attacker.example.com',
			'http://localhost:3000', // Different port
			'http://127.0.0.1:8080', // Different port
			'https://localhost:5173', // Different scheme (https vs http)
			'null', // Browser sends this for file:// URLs
			'data:text/html,<script>alert(1)</script>'
		];

		test.each(maliciousOrigins)(
			'%s receives NO Access-Control-Allow-Origin header',
			async (origin) => {
				const response = await fetch(`${BASE_URL}/api/health`, {
					headers: {
						Origin: origin,
						'X-API-Key': API_KEY
					}
				});

				const corsHeader = response.headers.get('Access-Control-Allow-Origin');
				expect(corsHeader).toBeNull();
			}
		);

		test.each(maliciousOrigins)(
			'%s receives NO Access-Control-Allow-Credentials header',
			async (origin) => {
				const response = await fetch(`${BASE_URL}/api/health`, {
					headers: {
						Origin: origin,
						'X-API-Key': API_KEY
					}
				});

				const credentialsHeader = response.headers.get('Access-Control-Allow-Credentials');
				expect(credentialsHeader).toBeNull();
			}
		);
	});

	describe('No Origin Header - No CORS Headers', () => {
		test('Request without Origin header receives no CORS headers', async () => {
			const response = await fetch(`${BASE_URL}/api/health`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const corsHeader = response.headers.get('Access-Control-Allow-Origin');
			expect(corsHeader).toBeNull();
		});
	});

	describe('Wildcard CORS Prevention', () => {
		test('No endpoint returns Access-Control-Allow-Origin: *', async () => {
			const testEndpoints = ['/api/health', '/api/rf/status', '/api/devices'];

			for (const endpoint of testEndpoints) {
				const response = await fetch(`${BASE_URL}${endpoint}`, {
					headers: {
						Origin: 'http://evil.com',
						'X-API-Key': API_KEY
					}
				});

				const corsHeader = response.headers.get('Access-Control-Allow-Origin');
				expect(corsHeader).not.toBe('*');
			}
		});
	});

	describe('Preflight Requests (OPTIONS)', () => {
		test('Preflight request from allowed origin succeeds', async () => {
			const response = await fetch(`${BASE_URL}/api/rf/status`, {
				method: 'OPTIONS',
				headers: {
					Origin: 'http://localhost:5173',
					'Access-Control-Request-Method': 'GET',
					'Access-Control-Request-Headers': 'X-API-Key'
				}
			});

			expect([200, 204]).toContain(response.status);

			const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
			expect(allowOrigin).toBe('http://localhost:5173');

			const allowMethods = response.headers.get('Access-Control-Allow-Methods');
			expect(allowMethods).toBeTruthy();

			const allowHeaders = response.headers.get('Access-Control-Allow-Headers');
			expect(allowHeaders).toBeTruthy();
		});

		test('Preflight request from unknown origin is rejected', async () => {
			const response = await fetch(`${BASE_URL}/api/rf/status`, {
				method: 'OPTIONS',
				headers: {
					Origin: 'http://evil.com',
					'Access-Control-Request-Method': 'GET',
					'Access-Control-Request-Headers': 'X-API-Key'
				}
			});

			const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
			expect(allowOrigin).toBeNull();
		});
	});

	describe('CORS with Authentication', () => {
		test('Allowed origin + valid API key = success', async () => {
			const response = await fetch(`${BASE_URL}/api/rf/status`, {
				headers: {
					Origin: 'http://localhost:5173',
					'X-API-Key': API_KEY
				}
			});

			expect(response.status).not.toBe(401);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
		});

		test('Allowed origin + invalid API key = 401 but CORS headers still present', async () => {
			const response = await fetch(`${BASE_URL}/api/rf/status`, {
				headers: {
					Origin: 'http://localhost:5173',
					'X-API-Key': 'invalid-key'
				}
			});

			expect(response.status).toBe(401);
			// CORS headers should still be present for error responses
			const corsHeader = response.headers.get('Access-Control-Allow-Origin');
			expect(corsHeader).toBeTruthy();
		});

		test('Unknown origin + valid API key = no CORS headers', async () => {
			const response = await fetch(`${BASE_URL}/api/rf/status`, {
				headers: {
					Origin: 'http://evil.com',
					'X-API-Key': API_KEY
				}
			});

			const corsHeader = response.headers.get('Access-Control-Allow-Origin');
			expect(corsHeader).toBeNull();
		});
	});

	describe('CORS Header Injection Prevention', () => {
		test('Newline in Origin header does not inject additional headers', async () => {
			const maliciousOrigin = 'http://localhost:5173\r\nX-Injected: malicious';

			try {
				const response = await fetch(`${BASE_URL}/api/health`, {
					headers: {
						Origin: maliciousOrigin,
						'X-API-Key': API_KEY
					}
				});

				// Should not have injected header
				expect(response.headers.get('X-Injected')).toBeNull();
			} catch (error) {
				// Fetch may reject malformed headers (acceptable)
				expect(error).toBeTruthy();
			}
		});
	});
});
