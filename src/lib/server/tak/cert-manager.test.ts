/**
 * Unit tests for CertManager
 * Tasks: T019 (truststore validation) + T023 (enrollment/PEM storage)
 *
 * Uses real test fixture P12 files for openssl-dependent methods.
 * Pure logic methods (savePemCerts, validateConfigId, etc.) use mocks.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

// Mock input-sanitizer
vi.mock('$lib/server/security/input-sanitizer', () => ({
	InputValidationError: class InputValidationError extends Error {
		constructor(msg: string) {
			super(msg);
			this.name = 'InputValidationError';
		}
	},
	validatePathWithinDir: (value: string, allowedDir: string) => {
		const resolved = path.resolve(allowedDir, value);
		if (!resolved.startsWith(path.resolve(allowedDir))) {
			throw new Error('Path traversal detected');
		}
		return resolved;
	}
}));

import { CertManager } from '$lib/server/tak/cert-manager';

// --- Helpers ---

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const CONFIG_DIR = path.resolve('data/certs', VALID_UUID);
const FIXTURES = path.resolve('tests/fixtures/tak');

// --- Tests ---

describe('CertManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		if (fs.existsSync(CONFIG_DIR)) {
			fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
		}
	});

	describe('validateConfigId()', () => {
		it('accepts a valid UUID', () => {
			const result = CertManager.validateConfigId(VALID_UUID);
			expect(result).toBe(CONFIG_DIR);
		});

		it('rejects non-UUID strings', () => {
			expect(() => CertManager.validateConfigId('not-a-uuid')).toThrow('Invalid config ID');
		});

		it('rejects empty string', () => {
			expect(() => CertManager.validateConfigId('')).toThrow('Invalid config ID');
		});

		it('rejects path traversal attempt', () => {
			expect(() => CertManager.validateConfigId('../../../etc/passwd')).toThrow(
				'Invalid config ID'
			);
		});
	});

	describe('init()', () => {
		it('creates base directory if missing', () => {
			const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
			const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

			CertManager.init();

			expect(mkdirSpy).toHaveBeenCalledWith('data/certs', {
				recursive: true,
				mode: 0o700
			});

			existsSpy.mockRestore();
			mkdirSpy.mockRestore();
		});

		it('skips creation if already exists', () => {
			const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
			const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

			CertManager.init();
			expect(mkdirSpy).not.toHaveBeenCalled();

			existsSpy.mockRestore();
			mkdirSpy.mockRestore();
		});
	});

	describe('validateTruststore()', () => {
		it('returns valid: true for a good truststore with correct password', async () => {
			const result = await CertManager.validateTruststore(
				path.join(FIXTURES, 'test-truststore.p12'),
				'atakatak'
			);
			expect(result).toEqual({ valid: true });
		});

		it('returns invalid on wrong password', async () => {
			const result = await CertManager.validateTruststore(
				path.join(FIXTURES, 'test-truststore.p12'),
				'wrongpassword'
			);
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Invalid truststore or password');
		});

		it('returns invalid for non-existent file', async () => {
			const result = await CertManager.validateTruststore('/tmp/nonexistent.p12', 'pass');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid truststore file');
		});

		it('returns invalid for corrupt file', async () => {
			const corruptPath = path.join(FIXTURES, 'corrupt.p12');
			fs.writeFileSync(corruptPath, 'not-a-pkcs12-file');
			try {
				const result = await CertManager.validateTruststore(corruptPath, 'pass');
				expect(result.valid).toBe(false);
				expect(result.error).toContain('Invalid truststore file');
			} finally {
				fs.unlinkSync(corruptPath);
			}
		});
	});

	describe('savePemCerts()', () => {
		// Safe: Test: vi.spyOn overload types don't unify cleanly; use generic MockInstance
		let mkdirSpy: MockInstance;
		let writeSpy: MockInstance;
		let existsSpy: MockInstance;
		let rmSpy: MockInstance;

		beforeEach(() => {
			existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
			mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
			writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
			rmSpy = vi.spyOn(fs, 'rmSync').mockReturnValue(undefined);
		});

		afterEach(() => {
			existsSpy.mockRestore();
			mkdirSpy.mockRestore();
			writeSpy.mockRestore();
			rmSpy.mockRestore();
		});

		it('writes cert and key with 0o600 permissions', () => {
			const result = CertManager.savePemCerts(
				VALID_UUID,
				'-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----',
				'-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
				[]
			);

			expect(result.certPath).toContain('client.crt');
			expect(result.keyPath).toContain('client.key');
			expect(result.caPath).toBeUndefined();

			const certWrite = writeSpy.mock.calls.find(
				(c) => typeof c[0] === 'string' && (c[0] as string).includes('client.crt')
			);
			expect(certWrite?.[2]).toEqual({ mode: 0o600 });
		});

		it('writes CA file when CA array is non-empty', () => {
			const result = CertManager.savePemCerts(VALID_UUID, 'cert', 'key', [
				'ca1-pem',
				'ca2-pem'
			]);

			expect(result.caPath).toContain('ca.crt');
			const caWrite = writeSpy.mock.calls.find(
				(c) => typeof c[0] === 'string' && (c[0] as string).includes('ca.crt')
			);
			// savePemCerts wraps bare strings in PEM headers
			expect(caWrite?.[1]).toContain('ca1-pem');
			expect(caWrite?.[1]).toContain('ca2-pem');
			expect(caWrite?.[1]).toContain('-----BEGIN CERTIFICATE-----');
		});

		it('removes existing dir before writing', () => {
			existsSpy.mockReturnValue(true);
			CertManager.savePemCerts(VALID_UUID, 'cert', 'key', []);
			expect(rmSpy).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true, force: true });
		});

		it('creates dir with 0o700 permissions', () => {
			CertManager.savePemCerts(VALID_UUID, 'cert', 'key', []);
			expect(mkdirSpy).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true, mode: 0o700 });
		});

		it('rejects invalid config ID', () => {
			existsSpy.mockRestore();
			mkdirSpy.mockRestore();
			writeSpy.mockRestore();
			rmSpy.mockRestore();

			expect(() => CertManager.savePemCerts('not-a-uuid', 'cert', 'key', [])).toThrow(
				'Invalid config ID'
			);
		});
	});

	describe('saveCA()', () => {
		it('writes CA buffer with 0o600 permissions', () => {
			const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
			const writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);

			const caBuffer = Buffer.from('ca-cert-data');
			const result = CertManager.saveCA(VALID_UUID, caBuffer);

			expect(result).toContain('ca.crt');
			expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('ca.crt'), caBuffer, {
				mode: 0o600
			});

			existsSpy.mockRestore();
			writeSpy.mockRestore();
		});

		it('creates directory if missing', () => {
			const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
			const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
			const writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);

			CertManager.saveCA(VALID_UUID, Buffer.from('ca'));

			expect(mkdirSpy).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true, mode: 0o700 });

			existsSpy.mockRestore();
			mkdirSpy.mockRestore();
			writeSpy.mockRestore();
		});
	});

	describe('deleteCerts()', () => {
		it('removes directory if exists', () => {
			const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
			const rmSpy = vi.spyOn(fs, 'rmSync').mockReturnValue(undefined);

			CertManager.deleteCerts(VALID_UUID);

			expect(rmSpy).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true, force: true });

			existsSpy.mockRestore();
			rmSpy.mockRestore();
		});

		it('does nothing if not exists', () => {
			const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
			const rmSpy = vi.spyOn(fs, 'rmSync').mockReturnValue(undefined);

			CertManager.deleteCerts(VALID_UUID);
			expect(rmSpy).not.toHaveBeenCalled();

			existsSpy.mockRestore();
			rmSpy.mockRestore();
		});

		it('rejects invalid config ID', () => {
			expect(() => CertManager.deleteCerts('../../../etc')).toThrow('Invalid config ID');
		});
	});

	describe('saveAndExtract()', () => {
		it('extracts cert, key, and CA from real P12 file', async () => {
			CertManager.init();
			const p12Buffer = fs.readFileSync(path.join(FIXTURES, 'test.p12'));

			const result = await CertManager.saveAndExtract(VALID_UUID, p12Buffer, 'testpass');

			expect(result.certPath).toContain('client.crt');
			expect(result.keyPath).toContain('client.key');
			expect(fs.existsSync(result.certPath)).toBe(true);
			expect(fs.existsSync(result.keyPath)).toBe(true);

			// Verify extracted files contain PEM data
			const certContent = fs.readFileSync(result.certPath, 'utf-8');
			expect(certContent).toContain('-----BEGIN CERTIFICATE-----');
			const keyContent = fs.readFileSync(result.keyPath, 'utf-8');
			expect(keyContent).toContain('-----BEGIN PRIVATE KEY-----');
		});

		it('fails with wrong password and cleans up', async () => {
			CertManager.init();
			const p12Buffer = fs.readFileSync(path.join(FIXTURES, 'test.p12'));

			await expect(
				CertManager.saveAndExtract(VALID_UUID, p12Buffer, 'wrongpassword')
			).rejects.toThrow('Failed to extract certificates');

			// Config dir should be cleaned up
			expect(fs.existsSync(CONFIG_DIR)).toBe(false);
		});
	});
});
