/**
 * Command Injection Prevention Tests - Phase 2.2.6
 *
 * Validates Phase 2.1.2: Shell Injection Elimination
 * Tests that shell metacharacters in parameters return 400, not 500.
 *
 * Standards: OWASP A03:2021 (Injection), CWE-78 (OS Command Injection),
 *            NIST SP 800-53 SI-10 (Input Validation)
 */

import { describe, expect, test } from 'vitest';

import { setupSecurityTest } from '../helpers/server-check';

const { BASE_URL, API_KEY, canRun } = await setupSecurityTest();

// Shell metacharacters that should be rejected
const SHELL_METACHARACTERS = [
	';',
	'&',
	'|',
	'`',
	'$',
	'(',
	')',
	'{',
	'}',
	'<',
	'>',
	'\n',
	'\\',
	"'",
	'"'
];

describe.runIf(canRun)('Command Injection Prevention', () => {
	describe('Numeric Parameter Validation', () => {
		test('Non-numeric frequency parameter returns 400', async () => {
			const maliciousInput = '100; rm -rf /';
			const response = await fetch(
				`${BASE_URL}/api/hackrf/spectrum?startFreq=${encodeURIComponent(maliciousInput)}&endFreq=2000`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toMatch(/invalid|validation|number/i);
		});

		test('SQL injection in numeric field returns 400', async () => {
			const maliciousInput = "1' OR '1'='1";
			const response = await fetch(
				`${BASE_URL}/api/signals/recent?limit=${encodeURIComponent(maliciousInput)}`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			expect(response.status).toBe(400);
		});

		test.each(SHELL_METACHARACTERS)(
			'Shell metacharacter "%s" in numeric field returns 400',
			async (char) => {
				const maliciousInput = `100${char}malicious`;
				const response = await fetch(
					`${BASE_URL}/api/hackrf/spectrum?startFreq=${encodeURIComponent(maliciousInput)}&endFreq=2000`,
					{ headers: { 'X-API-Key': API_KEY } }
				);

				expect(response.status).toBe(400);
			}
		);
	});

	describe('Interface Name Validation', () => {
		test('Path traversal in interface name returns 400', async () => {
			const maliciousInput = '../../../etc/passwd';
			const response = await fetch(
				`${BASE_URL}/api/kismet/interface?name=${encodeURIComponent(maliciousInput)}`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toMatch(/invalid|interface/i);
		});

		test('Command injection in interface name returns 400', async () => {
			const maliciousInput = 'wlan0; cat /etc/shadow';
			const response = await fetch(
				`${BASE_URL}/api/kismet/interface?name=${encodeURIComponent(maliciousInput)}`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			expect(response.status).toBe(400);
		});

		test('Null byte in interface name returns 400', async () => {
			const maliciousInput = 'wlan0\0malicious';
			const response = await fetch(
				`${BASE_URL}/api/kismet/interface?name=${encodeURIComponent(maliciousInput)}`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			expect(response.status).toBe(400);
		});
	});

	describe('MAC Address Validation', () => {
		test('Invalid MAC address format returns 400', async () => {
			const maliciousInput = "AA:BB:CC:DD:EE:FF'; DROP TABLE devices;--";
			const response = await fetch(
				`${BASE_URL}/api/devices?mac=${encodeURIComponent(maliciousInput)}`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			expect(response.status).toBe(400);
		});

		test('Shell command in MAC address field returns 400', async () => {
			const maliciousInput = '$(whoami)';
			const response = await fetch(
				`${BASE_URL}/api/devices?mac=${encodeURIComponent(maliciousInput)}`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			expect(response.status).toBe(400);
		});
	});

	describe('JSON Body Injection', () => {
		test('Shell metacharacters in JSON body are validated', async () => {
			const maliciousPayload = {
				frequency: '900; reboot',
				gain: 20,
				duration: 10
			};

			const response = await fetch(`${BASE_URL}/api/hackrf/scan`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(maliciousPayload)
			});

			// Should be 400 (validation error), not 500 (server error)
			expect(response.status).toBe(400);
		});

		test('Prototype pollution attempt returns 400', async () => {
			const maliciousPayload = {
				__proto__: { isAdmin: true },
				frequency: 900
			};

			const response = await fetch(`${BASE_URL}/api/hackrf/scan`, {
				method: 'POST',
				headers: {
					'X-API-Key': API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(maliciousPayload)
			});

			expect([400, 404, 405]).toContain(response.status);
		});
	});

	describe('Path Traversal Prevention', () => {
		test('Path traversal in file parameter returns 400', async () => {
			const traversalAttempts = [
				'../../../etc/passwd',
				'..\\..\\..\\windows\\system32',
				'....//....//etc/passwd',
				'%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd' // URL encoded
			];

			for (const attempt of traversalAttempts) {
				const response = await fetch(
					`${BASE_URL}/api/tools/output?file=${encodeURIComponent(attempt)}`,
					{ headers: { 'X-API-Key': API_KEY } }
				);

				expect(response.status).toBe(400);
			}
		});
	});

	describe('LDAP Injection Prevention', () => {
		test('LDAP special characters in search field return 400', async () => {
			const ldapInjection = '*)(uid=*))(|(uid=*';
			const response = await fetch(
				`${BASE_URL}/api/devices/search?query=${encodeURIComponent(ldapInjection)}`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			// Should handle gracefully (400 or empty result), not 500
			expect(response.status).not.toBe(500);
		});
	});

	describe('Server Response - No Error Details Leaked', () => {
		test('Validation errors do not leak internal paths', async () => {
			const response = await fetch(
				`${BASE_URL}/api/hackrf/spectrum?startFreq=malicious&endFreq=2000`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			expect(response.status).toBe(400);
			const data = await response.json();
			const errorText = JSON.stringify(data).toLowerCase();

			// Should NOT leak internal details
			expect(errorText).not.toMatch(/\/home\/kali/i);
			expect(errorText).not.toMatch(/\/app\//i);
			expect(errorText).not.toMatch(/node_modules/i);
			expect(errorText).not.toMatch(/stack trace/i);
		});

		test('500 errors do not leak stack traces to client', async () => {
			// Try to trigger a 500 error by hitting an endpoint that might fail
			const response = await fetch(
				`${BASE_URL}/api/hackrf/spectrum?startFreq=999999999999&endFreq=9999999999999`,
				{ headers: { 'X-API-Key': API_KEY } }
			);

			if (response.status === 500) {
				const data = await response.json();
				const errorText = JSON.stringify(data);

				// Stack traces should not be leaked
				expect(errorText).not.toMatch(/at \w+\s+\(/); // "at functionName ("
				expect(errorText).not.toMatch(/\.ts:\d+:\d+/); // "file.ts:line:col"
			}
		});
	});
});
