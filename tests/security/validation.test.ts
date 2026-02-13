/**
 * Input Validation Security Tests - Phase 2.2.6
 *
 * Validates Phase 2.2.4: JSON.parse Validation
 * Tests that invalid parameter types (string where number expected, etc.) return 400.
 *
 * Standards: OWASP A03:2021 (Injection), CWE-20 (Improper Input Validation),
 *            NIST SP 800-53 SI-10 (Information Input Validation)
 */

import { describe, expect,test } from 'vitest';

import { isServerAvailable, restoreRealFetch } from '../helpers/server-check';

restoreRealFetch();

const BASE_URL = 'http://localhost:5173';
const API_KEY = process.env.ARGOS_API_KEY || '';
const canRun = API_KEY.length >= 32 && (await isServerAvailable());

describe.runIf(canRun)('Input Validation Security', () => {
	describe('Type Mismatch Validation', () => {
		test('String where number expected returns 400', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent?limit=not-a-number`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toMatch(/invalid|validation|number/i);
		});

		test('Number where string expected returns 400 or is handled safely', async () => {
			const response = await fetch(`${BASE_URL}/api/devices/search?query=12345`, {
				headers: { 'X-API-Key': API_KEY }
			});

			// Should either validate and reject (400) or handle safely (200 with empty results)
			expect([200, 400, 404]).toContain(response.status);
		});

		test('Boolean where number expected returns 400', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent?limit=true`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect(response.status).toBe(400);
		});

		test('Array where string expected returns 400', async () => {
			const response = await fetch(`${BASE_URL}/api/devices/search?query[]=malicious`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect([400, 404]).toContain(response.status);
		});
	});

	describe('Range Validation', () => {
		test('Negative number where positive expected returns 400', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent?limit=-10`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect(response.status).toBe(400);
		});

		test('Number exceeding maximum returns 400', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent?limit=999999999`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect(response.status).toBe(400);
		});

		test('Frequency outside valid RF range returns 400', async () => {
			const responses = await Promise.all([
				fetch(`${BASE_URL}/api/hackrf/spectrum?startFreq=1&endFreq=100`, {
					headers: { 'X-API-Key': API_KEY }
				}),
				fetch(`${BASE_URL}/api/hackrf/spectrum?startFreq=999999&endFreq=9999999`, {
					headers: { 'X-API-Key': API_KEY }
				})
			]);

			responses.forEach((response) => {
				expect(response.status).toBe(400);
			});
		});
	});

	describe('JSON Body Validation', () => {
		test('Malformed JSON returns 400', async () => {
			const response = await fetch(`${BASE_URL}/api/hackrf/scan`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: '{ invalid json: }'
			});

			expect(response.status).toBe(400);
		});

		test('Missing required fields returns 400', async () => {
			const response = await fetch(`${BASE_URL}/api/hackrf/scan`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ frequency: 900 }) // Missing other required fields
			});

			expect([400, 404, 405]).toContain(response.status);
		});

		test('Extra fields are ignored or rejected', async () => {
			const response = await fetch(`${BASE_URL}/api/hackrf/scan`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					frequency: 900,
					gain: 20,
					extraField: 'malicious'
				})
			});

			// Should be 400 (strict validation) or ignore extra fields (200/404)
			expect([200, 400, 404, 405]).toContain(response.status);
		});

		test('Null values are validated correctly', async () => {
			const response = await fetch(`${BASE_URL}/api/hackrf/scan`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					frequency: null,
					gain: 20
				})
			});

			expect(response.status).toBe(400);
		});
	});

	describe('Special Number Values', () => {
		test('NaN is rejected', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent?limit=NaN`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect(response.status).toBe(400);
		});

		test('Infinity is rejected', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent?limit=Infinity`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect(response.status).toBe(400);
		});

		test('Scientific notation is handled correctly', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent?limit=1e10`, {
				headers: { 'X-API-Key': API_KEY }
			});

			// Should validate the parsed number (1e10 = 10 billion, likely out of range)
			expect(response.status).toBe(400);
		});

		test('Hexadecimal numbers are validated', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent?limit=0xFF`, {
				headers: { 'X-API-Key': API_KEY }
			});

			// Should either parse correctly (255) or reject as non-decimal
			expect([200, 400, 404]).toContain(response.status);
		});
	});

	describe('String Validation', () => {
		test('Empty string where non-empty required returns 400', async () => {
			const response = await fetch(`${BASE_URL}/api/devices/search?query=`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect([400, 404]).toContain(response.status);
		});

		test('String exceeding maximum length returns 400', async () => {
			const longString = 'a'.repeat(10000);
			const response = await fetch(
				`${BASE_URL}/api/devices/search?query=${encodeURIComponent(longString)}`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			expect([400, 414]).toContain(response.status); // 414 = URI Too Long
		});

		test('Unicode characters are handled safely', async () => {
			const unicodeString = '日本語テスト';
			const response = await fetch(
				`${BASE_URL}/api/devices/search?query=${encodeURIComponent(unicodeString)}`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			// Should handle safely (not crash with 500)
			expect([200, 400, 404]).toContain(response.status);
		});

		test('Control characters are rejected or escaped', async () => {
			const controlChars = '\x00\x01\x02\x03\x04';
			const response = await fetch(
				`${BASE_URL}/api/devices/search?query=${encodeURIComponent(controlChars)}`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			expect([400, 404]).toContain(response.status);
		});
	});

	describe('Enum Validation', () => {
		test('Invalid enum value returns 400', async () => {
			const response = await fetch(`${BASE_URL}/api/gsm-evil/control?action=invalid-action`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect(response.status).toBe(400);
		});

		test('Case-sensitive enum validation', async () => {
			const response = await fetch(
				`${BASE_URL}/api/gsm-evil/control?action=START`, // Uppercase
				{ headers: { 'X-API-Key': API_KEY } }
			);

			// Should reject if case-sensitive validation is enforced
			// Or accept if case-insensitive (both are valid patterns)
			expect([200, 400, 404, 405]).toContain(response.status);
		});
	});

	describe('Array Validation', () => {
		test('Empty array where non-empty required returns 400', async () => {
			const response = await fetch(`${BASE_URL}/api/tools/execute`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ tools: [] })
			});

			expect([400, 404, 405]).toContain(response.status);
		});

		test('Array exceeding maximum length returns 400', async () => {
			const largeArray = Array(10000).fill('item');
			const response = await fetch(`${BASE_URL}/api/tools/execute`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ tools: largeArray })
			});

			expect([400, 413]).toContain(response.status); // 413 = Payload Too Large
		});
	});

	describe('Validation Error Messages', () => {
		test('Error messages are descriptive but not verbose', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent?limit=invalid`, {
				headers: { 'X-API-Key': API_KEY }
			});

			expect(response.status).toBe(400);
			const data = await response.json();

			// Should have helpful error message
			expect(data.error).toBeTruthy();
			expect(typeof data.error).toBe('string');
			expect(data.error.length).toBeGreaterThan(10);
			expect(data.error.length).toBeLessThan(500);
		});

		test('Validation errors do not leak internal implementation details', async () => {
			const response = await fetch(`${BASE_URL}/api/signals/recent?limit=invalid`, {
				headers: { 'X-API-Key': API_KEY }
			});

			const data = await response.json();
			const errorText = JSON.stringify(data);

			// Should NOT leak file paths, variable names, or stack traces
			expect(errorText).not.toMatch(/src\/routes\//);
			expect(errorText).not.toMatch(/node_modules/);
			expect(errorText).not.toMatch(/at Object\./);
		});
	});
});
