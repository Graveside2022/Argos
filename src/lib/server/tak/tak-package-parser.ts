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
	enrollForCert?: boolean;
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

			// TAK data packages may name pref files differently (preference.pref, TAKServer.pref, etc.)
			const prefPath = this.findFileByExt(tmpDir, '.pref');
			if (!prefPath) {
				throw new Error('Invalid data package — no .pref file found');
			}

			const prefXml = fs.readFileSync(prefPath, 'utf-8');
			const { hostname, port, description, enrollForCert } =
				this.parsePreferencePref(prefXml);

			const certFiles = this.extractCertFiles(tmpDir);
			if (certFiles.length === 0) {
				throw new Error('No certificates found in data package');
			}

			return { hostname, port, protocol: 'tls', certFiles, description, enrollForCert };
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	}

	/**
	 * Parses preference.pref XML to extract connection parameters.
	 * TAK preference files use <preference> elements with <entry> children.
	 * The connectString entry format is: <host>:<port>:<protocol>
	 */
	/** Extract key and text content from a single XML entry element */
	private static extractEntry(entry: Element | null): [string, string] | null {
		if (!entry) return null;
		const key = entry.getAttribute('key');
		if (!key) return null;
		return [key, entry.textContent?.trim() ?? ''];
	}

	/** Extract key-value entries from a preference XML document */
	private static extractEntries(xml: string): Map<string, string> {
		const doc = new DOMParser().parseFromString(xml, 'text/xml');
		const map = new Map<string, string>();
		const entries = doc.getElementsByTagName('entry');
		for (let i = 0; i < entries.length; i++) {
			const kv = this.extractEntry(entries[i]);
			if (kv) map.set(kv[0], kv[1]);
		}
		return map;
	}

	/** Look up a description value from possible keys */
	private static findDescription(entries: Map<string, string>): string | undefined {
		const val = entries.get('description0') ?? entries.get('description') ?? '';
		return val || undefined;
	}

	private static parsePreferencePref(xml: string): {
		hostname: string;
		port: number;
		description?: string;
		enrollForCert?: boolean;
	} {
		const entries = this.extractEntries(xml);
		const connectString = entries.get('connectString0') ?? '';
		if (!connectString) {
			throw new Error('Invalid data package — no connectString found in preference.pref');
		}
		const { hostname, port } = this.parseConnectString(connectString);

		const enrollVal = entries.get('enrollForCertificateWithTrust0');
		return {
			hostname,
			port,
			description: this.findDescription(entries),
			enrollForCert: enrollVal === 'true' ? true : undefined
		};
	}

	/**
	 * Parses TAK connectString format: "<host>:<port>:<protocol>"
	 * Example: "192.168.1.100:8089:ssl"
	 */
	/** Validate that a parsed port is within the valid range */
	private static isValidPort(port: number): boolean {
		return !isNaN(port) && port >= 1 && port <= 65535;
	}

	private static parseConnectString(cs: string): { hostname: string; port: number } {
		const parts = cs.split(':');
		if (parts.length < 2) throw new Error(`Invalid connectString format: ${cs}`);
		const hostname = parts[0];
		const port = parseInt(parts[1], 10);
		if (!hostname || !this.isValidPort(port))
			throw new Error(`Invalid connectString values: ${cs}`);
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

	/** Finds the first file matching a given extension (case-insensitive). */
	private static findFileByExt(dir: string, ext: string): string | null {
		let found: string | null = null;
		this.walkDir(dir, (filePath) => {
			if (!found && path.extname(filePath).toLowerCase() === ext.toLowerCase()) {
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
