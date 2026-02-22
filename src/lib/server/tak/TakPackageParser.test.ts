/**
 * Unit tests for TakPackageParser
 * Task: T027
 *
 * Uses real test fixture ZIP for parse() integration tests.
 * Tests private methods directly for parsePreferencePref/parseConnectString.
 */
import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TakPackageParser } from '$lib/server/tak/TakPackageParser';

// Safe: Test: Accessing private static methods for focused unit testing
// Use a standalone interface (not intersection) to avoid TS collapsing to `never`
// when private properties conflict with the redeclared public signatures.
interface ParserPrivate {
	parse: typeof TakPackageParser.parse;
	parsePreferencePref: (xml: string) => {
		hostname: string;
		port: number;
		description?: string;
	};
	parseConnectString: (cs: string) => { hostname: string; port: number };
	extractCertFiles: (dir: string) => { name: string; data: Buffer }[];
}

const parser = TakPackageParser as unknown as ParserPrivate;
const FIXTURES = path.resolve('tests/fixtures/tak');

// --- Test Data ---

const SAMPLE_PREF_XML = `<?xml version='1.0' encoding='ASCII' standalone='yes'?>
<preferences>
  <preference version="1" name="cot_streams">
    <entry key="count" class="class java.lang.Integer">1</entry>
    <entry key="description0" class="class java.lang.String">Unit TAK Server</entry>
    <entry key="connectString0" class="class java.lang.String">192.168.1.100:8089:ssl</entry>
  </preference>
</preferences>`;

const PREF_NO_CONNECT = `<?xml version='1.0' encoding='ASCII' standalone='yes'?>
<preferences>
  <preference version="1" name="cot_streams">
    <entry key="count" class="class java.lang.Integer">0</entry>
  </preference>
</preferences>`;

const PREF_WITH_DESC = `<?xml version='1.0' encoding='ASCII' standalone='yes'?>
<preferences>
  <preference version="1" name="cot_streams">
    <entry key="connectString0">10.0.0.5:4443:ssl</entry>
    <entry key="description">My TAK Server</entry>
  </preference>
</preferences>`;

// --- Tests ---

describe('TakPackageParser', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('parsePreferencePref()', () => {
		it('extracts hostname and port from valid preference XML', () => {
			const result = parser.parsePreferencePref(SAMPLE_PREF_XML);
			expect(result.hostname).toBe('192.168.1.100');
			expect(result.port).toBe(8089);
		});

		it('extracts description when present', () => {
			const result = parser.parsePreferencePref(PREF_WITH_DESC);
			expect(result.hostname).toBe('10.0.0.5');
			expect(result.port).toBe(4443);
			expect(result.description).toBe('My TAK Server');
		});

		it('throws when connectString is missing', () => {
			expect(() => parser.parsePreferencePref(PREF_NO_CONNECT)).toThrow(
				'no connectString found'
			);
		});

		it('extracts description from "description0" key', () => {
			const result = parser.parsePreferencePref(SAMPLE_PREF_XML);
			expect(result.description).toBe('Unit TAK Server');
		});
	});

	describe('parseConnectString()', () => {
		it('parses host:port:protocol format', () => {
			expect(parser.parseConnectString('192.168.1.100:8089:ssl')).toEqual({
				hostname: '192.168.1.100',
				port: 8089
			});
		});

		it('parses host:port without protocol', () => {
			expect(parser.parseConnectString('10.0.0.1:4443')).toEqual({
				hostname: '10.0.0.1',
				port: 4443
			});
		});

		it('throws on single-part string', () => {
			expect(() => parser.parseConnectString('just-a-host')).toThrow(
				'Invalid connectString format'
			);
		});

		it('throws on empty hostname', () => {
			expect(() => parser.parseConnectString(':8089:ssl')).toThrow(
				'Invalid connectString values'
			);
		});

		it('throws on non-numeric port', () => {
			expect(() => parser.parseConnectString('host:abc:ssl')).toThrow(
				'Invalid connectString values'
			);
		});

		it('throws on port > 65535', () => {
			expect(() => parser.parseConnectString('host:99999:ssl')).toThrow(
				'Invalid connectString values'
			);
		});

		it('throws on port = 0', () => {
			expect(() => parser.parseConnectString('host:0:ssl')).toThrow(
				'Invalid connectString values'
			);
		});
	});

	describe('extractCertFiles()', () => {
		it('finds .p12, .pem, .crt, .key files', () => {
			const tmpDir = path.join('data', 'tmp', `cert-test-${Date.now()}`);
			fs.mkdirSync(tmpDir, { recursive: true });
			try {
				fs.writeFileSync(path.join(tmpDir, 'truststore.p12'), 'p12-data');
				fs.writeFileSync(path.join(tmpDir, 'client.crt'), 'cert-data');
				fs.writeFileSync(path.join(tmpDir, 'client.key'), 'key-data');
				fs.writeFileSync(path.join(tmpDir, 'ca.pem'), 'ca-data');
				fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'ignored');

				const files = parser.extractCertFiles(tmpDir);

				expect(files.length).toBe(4);
				const names = files.map((f) => f.name);
				expect(names).toContain('truststore.p12');
				expect(names).toContain('client.crt');
				expect(names).toContain('client.key');
				expect(names).toContain('ca.pem');
				expect(names).not.toContain('readme.txt');
			} finally {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			}
		});

		it('finds cert files in nested directories', () => {
			const tmpDir = path.join('data', 'tmp', `cert-nested-${Date.now()}`);
			fs.mkdirSync(path.join(tmpDir, 'certs'), { recursive: true });
			try {
				fs.writeFileSync(path.join(tmpDir, 'certs', 'deep.p12'), 'p12');

				const files = parser.extractCertFiles(tmpDir);
				expect(files.length).toBe(1);
				expect(files[0].name).toBe('deep.p12');
			} finally {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			}
		});

		it('returns empty array when no cert files', () => {
			const tmpDir = path.join('data', 'tmp', `cert-empty-${Date.now()}`);
			fs.mkdirSync(tmpDir, { recursive: true });
			try {
				fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'nope');
				expect(parser.extractCertFiles(tmpDir)).toEqual([]);
			} finally {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			}
		});
	});

	describe('parse()', () => {
		it('throws when zip file does not exist', async () => {
			await expect(TakPackageParser.parse('/nonexistent/test.zip')).rejects.toThrow(
				'File not found at /nonexistent/test.zip'
			);
		});

		it('parses a real TAK data package', async () => {
			const zipPath = path.join(FIXTURES, 'test-package.zip');
			const result = await TakPackageParser.parse(zipPath);

			expect(result.hostname).toBe('192.168.1.100');
			expect(result.port).toBe(8089);
			expect(result.protocol).toBe('tls');
			expect(result.description).toBe('Test TAK Server');
			expect(result.certFiles.length).toBeGreaterThanOrEqual(2);

			const certNames = result.certFiles.map((f) => f.name);
			expect(certNames).toContain('client.p12');
			expect(certNames).toContain('truststore-itak-v4.p12');
		});

		it('cleans up temp directory after parsing', async () => {
			const zipPath = path.join(FIXTURES, 'test-package.zip');
			await TakPackageParser.parse(zipPath);

			// Verify all tak-pkg temp dirs are cleaned up
			const tmpDirs = fs.existsSync('data/tmp')
				? fs.readdirSync('data/tmp').filter((d) => d.startsWith('tak-pkg-'))
				: [];
			expect(tmpDirs.length).toBe(0);
		});

		it('throws on invalid zip file', async () => {
			const badZip = path.join('data', 'tmp', 'bad.zip');
			fs.mkdirSync(path.dirname(badZip), { recursive: true });
			fs.writeFileSync(badZip, 'not-a-real-zip');
			try {
				await expect(TakPackageParser.parse(badZip)).rejects.toThrow();
			} finally {
				if (fs.existsSync(badZip)) fs.unlinkSync(badZip);
			}
		});
	});
});
