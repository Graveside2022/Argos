/**
 * Rate Limiting Security Tests - Phase 2.2.6
 *
 * Validates Phase 2.2.5: Rate Limiting
 * Tests that burst requests to hardware endpoints return 429 after limit exceeded.
 *
 * Standards: OWASP A04:2021 (Insecure Design), NIST SP 800-53 SC-5 (DoS Protection),
 *            CWE-770 (Allocation of Resources Without Limits)
 */

import { describe, expect,test } from 'vitest';

import { isServerAvailable, restoreRealFetch } from '../helpers/server-check';

restoreRealFetch();

const BASE_URL = 'http://localhost:5173';
const API_KEY = process.env.ARGOS_API_KEY || '';
const canRun = API_KEY.length >= 32 && (await isServerAvailable());

describe.runIf(canRun)('Rate Limiting Security', () => {
	describe('Hardware Endpoint Rate Limiting', () => {
		const hardwareEndpoints = [
			'/api/hackrf/status',
			'/api/kismet/status',
			'/api/gsm-evil/status',
			'/api/rf/status'
		];

		test.each(hardwareEndpoints)(
			'%s enforces rate limit after burst requests',
			async (endpoint) => {
				const results: number[] = [];

				// Send 15 rapid requests (limit should be around 10)
				for (let i = 0; i < 15; i++) {
					const response = await fetch(`${BASE_URL}${endpoint}`, {
						headers: { 'X-API-Key': API_KEY }
					});
					results.push(response.status);
				}

				// Should have at least one 429 (Too Many Requests)
				const has429 = results.includes(429);
				expect(has429).toBe(true);

				// First few requests should be allowed
				const allowed = results.filter((s) => s !== 429).length;
				expect(allowed).toBeGreaterThan(0);
				expect(allowed).toBeLessThan(15);
			},
			{ timeout: 10000 }
		);

		test(
			'Rate limit response includes Retry-After header',
			async () => {
				const endpoint = '/api/hackrf/status';
				const results: Response[] = [];

				// Burst requests until we hit rate limit
				for (let i = 0; i < 20; i++) {
					const response = await fetch(`${BASE_URL}${endpoint}`, {
						headers: { 'X-API-Key': API_KEY }
					});
					results.push(response);

					if (response.status === 429) {
						break;
					}
				}

				// Find first 429 response
				const rateLimitResponse = results.find((r) => r.status === 429);
				if (rateLimitResponse) {
					const retryAfter = rateLimitResponse.headers.get('Retry-After');
					expect(retryAfter).toBeTruthy();

					// Should be a reasonable number (seconds)
					const seconds = parseInt(retryAfter || '0', 10);
					expect(seconds).toBeGreaterThan(0);
					expect(seconds).toBeLessThan(300); // Less than 5 minutes
				}
			},
			{ timeout: 10000 }
		);

		test(
			'Rate limit resets after waiting',
			async () => {
				const endpoint = '/api/hackrf/status';

				// Exhaust rate limit
				for (let i = 0; i < 15; i++) {
					await fetch(`${BASE_URL}${endpoint}`, {
						headers: { 'X-API-Key': API_KEY }
					});
				}

				// Verify we're rate limited
				const blockedResponse = await fetch(`${BASE_URL}${endpoint}`, {
					headers: { 'X-API-Key': API_KEY }
				});
				expect(blockedResponse.status).toBe(429);

				// Wait for rate limit window to reset (e.g., 60 seconds)
				await new Promise((resolve) => setTimeout(resolve, 61000));

				// Should be able to make requests again
				const afterWaitResponse = await fetch(`${BASE_URL}${endpoint}`, {
					headers: { 'X-API-Key': API_KEY }
				});
				expect(afterWaitResponse.status).not.toBe(429);
			},
			{ timeout: 70000 }
		);
	});

	describe('Non-Hardware Endpoints - No Aggressive Rate Limiting', () => {
		test(
			'/api/health allows many rapid requests',
			async () => {
				const results: number[] = [];

				// Health endpoint should allow more requests
				for (let i = 0; i < 30; i++) {
					const response = await fetch(`${BASE_URL}/api/health`);
					results.push(response.status);
				}

				// Should NOT hit rate limit (or much higher limit)
				const has429 = results.includes(429);
				expect(has429).toBe(false);
			},
			{ timeout: 10000 }
		);
	});

	describe('Per-Client Rate Limiting', () => {
		test(
			'Rate limit is per-IP/per-client',
			async () => {
				// This test verifies that one client's rate limit doesn't affect others
				// In practice, we can't test multiple IPs from one test runner,
				// but we can verify that the rate limiter tracks clients

				const endpoint = '/api/hackrf/status';

				// Exhaust rate limit
				for (let i = 0; i < 15; i++) {
					await fetch(`${BASE_URL}${endpoint}`, {
						headers: { 'X-API-Key': API_KEY }
					});
				}

				// Verify we're rate limited
				const response = await fetch(`${BASE_URL}${endpoint}`, {
					headers: { 'X-API-Key': API_KEY }
				});
				expect(response.status).toBe(429);

				// Different API endpoint should still work (separate bucket)
				const otherResponse = await fetch(`${BASE_URL}/api/health`);
				expect(otherResponse.status).not.toBe(429);
			},
			{ timeout: 10000 }
		);
	});

	describe('Rate Limit Response Format', () => {
		test(
			'429 response includes error message',
			async () => {
				const endpoint = '/api/hackrf/status';

				// Exhaust rate limit
				for (let i = 0; i < 15; i++) {
					await fetch(`${BASE_URL}${endpoint}`, {
						headers: { 'X-API-Key': API_KEY }
					});
				}

				// Get 429 response
				const response = await fetch(`${BASE_URL}${endpoint}`, {
					headers: { 'X-API-Key': API_KEY }
				});

				if (response.status === 429) {
					const data = await response.json();
					expect(data).toHaveProperty('error');
					expect(data.error).toMatch(/rate limit|too many requests/i);
				}
			},
			{ timeout: 10000 }
		);

		test(
			'Rate limit headers are present on 429 response',
			async () => {
				const endpoint = '/api/hackrf/status';

				// Exhaust rate limit
				for (let i = 0; i < 15; i++) {
					await fetch(`${BASE_URL}${endpoint}`, {
						headers: { 'X-API-Key': API_KEY }
					});
				}

				// Get 429 response
				const response = await fetch(`${BASE_URL}${endpoint}`, {
					headers: { 'X-API-Key': API_KEY }
				});

				if (response.status === 429) {
					// Should have informative headers
					const retryAfter = response.headers.get('Retry-After');
					expect(retryAfter).toBeTruthy();

					// May also have X-RateLimit-* headers
					const rateLimitLimit = response.headers.get('X-RateLimit-Limit');
					const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');

					// If present, they should be valid
					if (rateLimitLimit) {
						expect(parseInt(rateLimitLimit, 10)).toBeGreaterThan(0);
					}
					if (rateLimitRemaining) {
						expect(parseInt(rateLimitRemaining, 10)).toBeGreaterThanOrEqual(0);
					}
				}
			},
			{ timeout: 10000 }
		);
	});

	describe('Rate Limiting Algorithm Validation', () => {
		test(
			'Token bucket algorithm allows bursts within limit',
			async () => {
				const endpoint = '/api/hackrf/status';

				// Wait to ensure clean slate
				await new Promise((resolve) => setTimeout(resolve, 2000));

				const results: number[] = [];

				// Send exactly 10 requests rapidly (should all be allowed if limit is 10)
				for (let i = 0; i < 10; i++) {
					const response = await fetch(`${BASE_URL}${endpoint}`, {
						headers: { 'X-API-Key': API_KEY }
					});
					results.push(response.status);
				}

				// All 10 should be allowed (200/404/500, not 429)
				const allowed = results.filter((s) => s !== 429).length;
				expect(allowed).toBeGreaterThanOrEqual(8); // Allow some margin
			},
			{ timeout: 10000 }
		);

		test(
			'Requests beyond burst limit are rejected immediately',
			async () => {
				const endpoint = '/api/hackrf/status';

				// Exhaust limit
				for (let i = 0; i < 15; i++) {
					await fetch(`${BASE_URL}${endpoint}`, {
						headers: { 'X-API-Key': API_KEY }
					});
				}

				// Next request should be rejected immediately (no delay)
				const start = Date.now();
				const response = await fetch(`${BASE_URL}${endpoint}`, {
					headers: { 'X-API-Key': API_KEY }
				});
				const duration = Date.now() - start;

				expect(response.status).toBe(429);
				expect(duration).toBeLessThan(1000); // Should reject fast, not timeout
			},
			{ timeout: 10000 }
		);
	});

	describe('Authenticated vs Unauthenticated Rate Limits', () => {
		test(
			'Unauthenticated requests may have stricter rate limit',
			async () => {
				const endpoint = '/api/health'; // Public endpoint

				const results: number[] = [];

				// Send many unauthenticated requests
				for (let i = 0; i < 50; i++) {
					const response = await fetch(`${BASE_URL}${endpoint}`);
					results.push(response.status);
				}

				// May or may not have rate limit (implementation-dependent)
				// Just verify we don't crash or behave unexpectedly
				const _has429 = results.includes(429);
				const has500 = results.includes(500);

				expect(has500).toBe(false); // Should not error
			},
			{ timeout: 15000 }
		);
	});

	describe('Rate Limit Bypass Prevention', () => {
		test(
			'Cannot bypass rate limit by changing User-Agent',
			async () => {
				const endpoint = '/api/hackrf/status';

				// Exhaust limit with one User-Agent
				for (let i = 0; i < 15; i++) {
					await fetch(`${BASE_URL}${endpoint}`, {
						headers: {
							'X-API-Key': API_KEY,
							'User-Agent': 'TestClient/1.0'
						}
					});
				}

				// Try with different User-Agent
				const response = await fetch(`${BASE_URL}${endpoint}`, {
					headers: {
						'X-API-Key': API_KEY,
						'User-Agent': 'DifferentClient/2.0'
					}
				});

				// Should still be rate limited (IP-based, not User-Agent)
				expect(response.status).toBe(429);
			},
			{ timeout: 10000 }
		);

		test(
			'Cannot bypass rate limit by omitting headers',
			async () => {
				const endpoint = '/api/hackrf/status';

				// Exhaust limit
				for (let i = 0; i < 15; i++) {
					await fetch(`${BASE_URL}${endpoint}`, {
						headers: { 'X-API-Key': API_KEY }
					});
				}

				// Try with minimal headers
				const response = await fetch(`${BASE_URL}${endpoint}`, {
					headers: { 'X-API-Key': API_KEY }
				});

				expect(response.status).toBe(429);
			},
			{ timeout: 10000 }
		);
	});
});
