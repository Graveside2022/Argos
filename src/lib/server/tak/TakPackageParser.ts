import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { DOMParser } from '@xmldom/xmldom';

const execFileAsync = promisify(execFile);

export interface ParsedTakPackage {
	hostname: string;
	port: number;
	protocol: 'tls';
	certFiles: { name: string; data: Buffer }[];
	description?: string;
}

/**
 * Parses TAK Server Data Packages (.zip files containing manifest.xml,
 * preference.pref, and certificate files).
 *
 * Strategy: native `unzip` for extraction, @xmldom/xmldom for XML parsing.
 */
export class TakPackageParser {
	/**
	 * Extracts and parses a TAK data package ZIP file.
	 * @param zipPath Absolute path to the .zip file on disk
	 * @returns Parsed connection config and extracted certificate buffers
	 */
	static async parse(zipPath: string): Promise<ParsedTakPackage> {
		if (!fs.existsSync(zipPath)) {
			throw new Error(`File not found at ${zipPath}`);
		}

		const tmpDir = path.join('data', 'tmp', `tak-pkg-${Date.now()}`);
		fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });

		try {
			await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', tmpDir]);

			const manifestPath = this.findFile(tmpDir, 'manifest.xml');
			if (!manifestPath) {
				throw new Error('Invalid data package — no manifest.xml found');
			}

			const prefPath = this.findFile(tmpDir, 'preference.pref');
			if (!prefPath) {
				throw new Error('Invalid data package — no preference.pref found');
			}

			const prefXml = fs.readFileSync(prefPath, 'utf-8');
			const { hostname, port, description } = this.parsePreferencePref(prefXml);

			const certFiles = this.extractCertFiles(tmpDir);
			if (certFiles.length === 0) {
				throw new Error('No certificates found in data package');
			}

			return { hostname, port, protocol: 'tls', certFiles, description };
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	}

	/**
	 * Parses preference.pref XML to extract connection parameters.
	 * TAK preference files use <preference> elements with <entry> children.
	 * The connectString entry format is: <host>:<port>:<protocol>
	 */
	private static parsePreferencePref(xml: string): {
		hostname: string;
		port: number;
		description?: string;
	} {
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, 'text/xml');

		let hostname = '';
		let port = 8089;
		let description: string | undefined;

		const entries = doc.getElementsByTagName('entry');
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (!entry) continue;
			const key = entry.getAttribute('key');
			const value = entry.textContent?.trim() ?? '';

			if (key === 'connectString0') {
				const parsed = this.parseConnectString(value);
				hostname = parsed.hostname;
				port = parsed.port;
			} else if (key === 'description') {
				description = value || undefined;
			}
		}

		if (!hostname) {
			throw new Error('Invalid data package — no connectString found in preference.pref');
		}

		return { hostname, port, description };
	}

	/**
	 * Parses TAK connectString format: "<host>:<port>:<protocol>"
	 * Example: "192.168.1.100:8089:ssl"
	 */
	private static parseConnectString(cs: string): { hostname: string; port: number } {
		const parts = cs.split(':');
		if (parts.length < 2) {
			throw new Error(`Invalid connectString format: ${cs}`);
		}
		const hostname = parts[0];
		const port = parseInt(parts[1], 10);
		if (!hostname || isNaN(port) || port < 1 || port > 65535) {
			throw new Error(`Invalid connectString values: ${cs}`);
		}
		return { hostname, port };
	}

	/**
	 * Finds certificate files (.p12, .pem, .crt, .key) in the extracted package.
	 */
	private static extractCertFiles(dir: string): { name: string; data: Buffer }[] {
		const certExts = ['.p12', '.pem', '.crt', '.key'];
		const results: { name: string; data: Buffer }[] = [];

		this.walkDir(dir, (filePath) => {
			const ext = path.extname(filePath).toLowerCase();
			if (certExts.includes(ext)) {
				results.push({
					name: path.basename(filePath),
					data: fs.readFileSync(filePath)
				});
			}
		});

		return results;
	}

	/** Recursively searches for a file by name in a directory tree. */
	private static findFile(dir: string, filename: string): string | null {
		let found: string | null = null;
		this.walkDir(dir, (filePath) => {
			if (!found && path.basename(filePath) === filename) {
				found = filePath;
			}
		});
		return found;
	}

	/** Simple recursive directory walker. */
	private static walkDir(dir: string, callback: (filePath: string) => void) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				this.walkDir(fullPath, callback);
			} else {
				callback(fullPath);
			}
		}
	}
}
