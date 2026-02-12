/**
 * Request Body Size Limit Tests - Phase 2.2.6
 *
 * Validates Phase 2.1.7: Request Body Size Limits
 * Tests that oversized request payloads return 413 Payload Too Large.
 *
 * Standards: OWASP A04:2021 (Insecure Design), NIST SP 800-53 SC-5 (DoS Protection),
 *            CWE-400 (Uncontrolled Resource Consumption)
 */

import { describe, expect,test } from 'vitest';

import { isServerAvailable, restoreRealFetch } from '../helpers/server-check';

restoreRealFetch();

const BASE_URL = 'http://localhost:5173';
const API_KEY = process.env.ARGOS_API_KEY || '';
const canRun = API_KEY.length >= 32 && (await isServerAvailable());

// Body size limits per Phase 2.1.7
const _MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB general limit
const _HARDWARE_BODY_LIMIT = 64 * 1024; // 64KB for hardware endpoints

describe.runIf(canRun)('Request Body Size Security', () => {
	describe('General API Endpoints - 10MB Limit', () => {
		test('Request under 10MB is accepted', async () => {
			const smallPayload = 'x'.repeat(1024); // 1KB
			const response = await fetch(`${BASE_URL}/api/signals/batch`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ data: smallPayload })
			});

			// Should process (may be 200, 400, or 404 depending on endpoint logic)
			expect([200, 400, 404, 405]).toContain(response.status);
			expect(response.status).not.toBe(413);
		});

		test(
			'Request at exactly 10MB is accepted',
			async () => {
				// Create a payload close to 10MB
				const size = 10 * 1024 * 1024 - 1000; // Slightly under to account for JSON overhead
				const largePayload = 'x'.repeat(size);

				const response = await fetch(`${BASE_URL}/api/signals/batch`, {
					method: 'POST',
					headers: {
						'X-API-Key': API_KEY,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ data: largePayload })
				});

				// Should NOT be 413
				expect(response.status).not.toBe(413);
			},
			{ timeout: 30000 }
		);

		test(
			'Request over 10MB is rejected with 413',
			async () => {
				// Create a payload larger than 10MB
				const size = 11 * 1024 * 1024;
				const oversizedPayload = 'x'.repeat(size);

				const response = await fetch(`${BASE_URL}/api/signals/batch`, {
					method: 'POST',
					headers: {
						'X-API-Key': API_KEY,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ data: oversizedPayload })
				});

				expect(response.status).toBe(413);

				const data = await response.json();
				expect(data.error).toMatch(/payload|body|size|large/i);
			},
			{ timeout: 30000 }
		);
	});

	describe('Hardware Control Endpoints - 64KB Limit', () => {
		const hardwareEndpoints = [
			'/api/hackrf/scan',
			'/api/kismet/scan',
			'/api/gsm-evil/control',
			'/api/rf/scan'
		];

		test.each(hardwareEndpoints)('%s accepts requests under 64KB', async (endpoint) => {
			const smallPayload = 'x'.repeat(1024); // 1KB
			const response = await fetch(`${BASE_URL}${endpoint}`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ data: smallPayload })
			});

			// Should process (not 413)
			expect(response.status).not.toBe(413);
		});

		test.each(hardwareEndpoints)('%s rejects requests over 64KB with 413', async (endpoint) => {
			const oversizedPayload = 'x'.repeat(70 * 1024); // 70KB
			const response = await fetch(`${BASE_URL}${endpoint}`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ data: oversizedPayload })
			});

			expect(response.status).toBe(413);
		});

		test('Hardware endpoint at exactly 64KB is accepted', async () => {
			// Create payload close to 64KB
			const size = 64 * 1024 - 500; // Account for JSON overhead
			const payloadAtLimit = 'x'.repeat(size);

			const response = await fetch(`${BASE_URL}/api/hackrf/scan`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ data: payloadAtLimit })
			});

			// Should NOT be 413
			expect(response.status).not.toBe(413);
		});
	});

	describe('Content-Length Header Validation', () => {
		test('Accurate Content-Length is respected', async () => {
			const payload = JSON.stringify({ data: 'test' });
			const response = await fetch(`${BASE_URL}/api/signals/batch`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json',
					'Content-Length': String(payload.length)
				},
				body: payload
			});

			// Should process normally
			expect([200, 400, 404, 405]).toContain(response.status);
		});

		test('Oversized Content-Length is rejected before reading body', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/batch`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json',
					'Content-Length': String(20 * 1024 * 1024) // 20MB (over limit)
				},
				body: 'x'.repeat(1000) // Actual body is small
			});

			// Should reject based on Content-Length header alone
			expect(response.status).toBe(413);
		});
	});

	describe('Chunked Transfer Encoding', () => {
		test(
			'Chunked requests respect size limit',
			async () => {
				// Most fetch implementations handle chunking automatically
				// This test verifies that chunked requests are still limited

				const payload = 'x'.repeat(11 * 1024 * 1024); // 11MB
				const response = await fetch(`${BASE_URL}/api/signals/batch`, {
					method: 'POST',
					headers: {
						'X-API-Key': API_KEY,
						'Content-Type': 'application/json'
						// No Content-Length = may use chunked encoding
					},
					body: JSON.stringify({ data: payload })
				});

				expect(response.status).toBe(413);
			},
			{ timeout: 30000 }
		);
	});

	describe('Different Content Types', () => {
		test(
			'JSON payload over limit is rejected',
			async () => {
				const largePayload = 'x'.repeat(11 * 1024 * 1024);
				const response = await fetch(`${BASE_URL}/api/signals/batch`, {
					method: 'POST',
					headers: {
						'X-API-Key': API_KEY,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ data: largePayload })
				});

				expect(response.status).toBe(413);
			},
			{ timeout: 30000 }
		);

		test(
			'Form data over limit is rejected',
			async () => {
				const largeData = 'x'.repeat(11 * 1024 * 1024);
				const formData = new URLSearchParams();
				formData.append('data', largeData);

				const response = await fetch(`${BASE_URL}/api/signals/batch`, {
					method: 'POST',
					headers: {
						'X-API-Key': API_KEY,
						'Content-Type': 'application/x-www-form-urlencoded'
					},
					body: formData.toString()
				});

				expect(response.status).toBe(413);
			},
			{ timeout: 30000 }
		);

		test(
			'Binary data over limit is rejected',
			async () => {
				const largeBinary = new Uint8Array(11 * 1024 * 1024);
				const response = await fetch(`${BASE_URL}/api/signals/batch`, {
					method: 'POST',
					headers: {
						'X-API-Key': API_KEY,
						'Content-Type': 'application/octet-stream'
					},
					body: largeBinary
				});

				expect(response.status).toBe(413);
			},
			{ timeout: 30000 }
		);
	});

	describe('Error Response Format', () => {
		test(
			'413 response includes error message',
			async () => {
				const oversizedPayload = 'x'.repeat(11 * 1024 * 1024);
				const response = await fetch(`${BASE_URL}/api/signals/batch`, {
					method: 'POST',
					headers: {
						'X-API-Key': API_KEY,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ data: oversizedPayload })
				});

				expect(response.status).toBe(413);

				const data = await response.json();
				expect(data).toHaveProperty('error');
				expect(data.error).toMatch(/payload|body|size|large|limit/i);
			},
			{ timeout: 30000 }
		);

		test(
			'413 response includes Content-Type: application/json',
			async () => {
				const oversizedPayload = 'x'.repeat(11 * 1024 * 1024);
				const response = await fetch(`${BASE_URL}/api/signals/batch`, {
					method: 'POST',
					headers: {
						'X-API-Key': API_KEY,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ data: oversizedPayload })
				});

				expect(response.status).toBe(413);

				const contentType = response.headers.get('Content-Type');
				expect(contentType).toContain('application/json');
			},
			{ timeout: 30000 }
		);
	});

	describe('DoS Prevention', () => {
		test(
			'Multiple oversized requests do not cause memory exhaustion',
			async () => {
				const results: number[] = [];

				// Send 5 oversized requests rapidly
				for (let i = 0; i < 5; i++) {
					const oversizedPayload = 'x'.repeat(11 * 1024 * 1024);
					const response = await fetch(`${BASE_URL}/api/signals/batch`, {
						method: 'POST',
						headers: {
							'X-API-Key': API_KEY,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ data: oversizedPayload })
					});
					results.push(response.status);
				}

				// All should be rejected with 413 (not 500 or timeout)
				results.forEach((status) => {
					expect(status).toBe(413);
				});
			},
			{ timeout: 60000 }
		);

		test(
			'Server continues processing normal requests after oversized request',
			async () => {
				// Send oversized request
				const oversizedPayload = 'x'.repeat(11 * 1024 * 1024);
				await fetch(`${BASE_URL}/api/signals/batch`, {
					method: 'POST',
					headers: {
						'X-API-Key': API_KEY,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ data: oversizedPayload })
				});

				// Immediately send normal request
				const normalResponse = await fetch(`${BASE_URL}/api/health`, {
					headers: { 'X-API-Key': API_KEY }
				});

				// Should process normally (server not crashed or stuck)
				expect(normalResponse.status).toBe(200);
			},
			{ timeout: 30000 }
		);
	});

	describe('GET Requests (Should Not Have Body Limits)', () => {
		test('GET request with no body succeeds', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect([200, 404]).toContain(response.status);
			expect(response.status).not.toBe(413);
		});

		test('GET request with body is handled correctly', async () => {
			// Some clients send GET with body (non-standard but possible)
			const response = await fetch(`${BASE_URL}/api/signals/recent`, {
				method: 'GET',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ filter: 'test' })
			});

			// Should either ignore body or reject (not crash)
			expect([200, 400, 404, 405]).toContain(response.status);
		});
	});
});
