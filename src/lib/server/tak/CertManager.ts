import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { InputValidationError, validatePathWithinDir } from '../security/input-sanitizer';

const execFileAsync = promisify(execFile);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CertManager {
	private static readonly BASE_DIR = 'data/certs';

	/**
	 * Validates a configId is a proper UUID and returns the resolved config directory.
	 * Prevents path traversal and empty-string edge cases.
	 */
	static validateConfigId(configId: string): string {
		if (!UUID_RE.test(configId)) {
			throw new InputValidationError(`Invalid config ID — must be a UUID, got: ${configId}`);
		}
		return validatePathWithinDir(configId, path.resolve(this.BASE_DIR));
	}

	/**
	 * Initializes the secure storage directory.
	 */
	static init() {
		if (!fs.existsSync(this.BASE_DIR)) {
			fs.mkdirSync(this.BASE_DIR, { recursive: true, mode: 0o700 });
		}
	}

	/**
	 * Saves a P12 file and extracts the certificate and private key.
	 * Uses execFile() with argument arrays to prevent shell injection.
	 * @param configId The unique ID of the TAK server config.
	 * @param p12Buffer The P12 file content.
	 * @param password The password for the P12 file.
	 * @returns Paths to the extracted cert, key, and optional CA.
	 */
	static async saveAndExtract(
		configId: string,
		p12Buffer: Buffer,
		password: string
	): Promise<{ certPath: string; keyPath: string; caPath?: string }> {
		const configDir = this.validateConfigId(configId);

		// Ensure config directory exists with strict permissions
		if (fs.existsSync(configDir)) {
			fs.rmSync(configDir, { recursive: true, force: true });
		}
		fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });

		const p12Path = path.join(configDir, 'client.p12');
		const certPath = path.join(configDir, 'client.crt');
		const keyPath = path.join(configDir, 'client.key');

		// Write P12 file securely
		fs.writeFileSync(p12Path, p12Buffer, { mode: 0o600 });

		try {
			// Extract Certificate — execFile prevents shell injection via password
			await execFileAsync('openssl', [
				'pkcs12',
				'-in',
				p12Path,
				'-clcerts',
				'-nokeys',
				'-out',
				certPath,
				'-passin',
				`pass:${password}`
			]);

			// Extract Private Key
			await execFileAsync('openssl', [
				'pkcs12',
				'-in',
				p12Path,
				'-nocerts',
				'-out',
				keyPath,
				'-passin',
				`pass:${password}`,
				'-nodes'
			]);

			// Extract CA Certificate (if present)
			const caPath = path.join(configDir, 'ca.crt');
			try {
				await execFileAsync('openssl', [
					'pkcs12',
					'-in',
					p12Path,
					'-cacerts',
					'-nokeys',
					'-out',
					caPath,
					'-passin',
					`pass:${password}`
				]);
				fs.chmodSync(caPath, 0o600);
			} catch (_e) {
				// CA might not be present in the p12 bundle
			}

			// Set strict permissions on extracted files
			fs.chmodSync(certPath, 0o600);
			fs.chmodSync(keyPath, 0o600);

			// Validate extracted cert/key are non-empty — a CA-only truststore P12
			// produces 0-byte client.crt and client.key
			const certSize = fs.statSync(certPath).size;
			const keySize = fs.statSync(keyPath).size;
			if (certSize === 0 || keySize === 0) {
				throw new InputValidationError(
					'This .p12 file does not contain a client certificate and private key. ' +
						'It may be a CA truststore — upload it in the Trust Store section instead.'
				);
			}

			return { certPath, keyPath, caPath: fs.existsSync(caPath) ? caPath : undefined };
		} catch (error) {
			// Cleanup on failure
			fs.rmSync(configDir, { recursive: true, force: true });
			throw new Error(
				`Failed to extract certificates: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Saves a CA certificate.
	 * @param configId The unique ID of the TAK server config.
	 * @param caBuffer The CA certificate content.
	 * @returns Path to the saved CA certificate.
	 */
	static saveCA(configId: string, caBuffer: Buffer): string {
		const configDir = this.validateConfigId(configId);
		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
		}

		const caPath = path.join(configDir, 'ca.crt');
		fs.writeFileSync(caPath, caBuffer, { mode: 0o600 });
		return caPath;
	}

	/**
	 * Validates a PKCS#12 truststore by attempting to read it with openssl.
	 * Returns true if the file is valid and the password is correct.
	 */
	static async validateTruststore(
		truststorePath: string,
		password: string
	): Promise<{ valid: boolean; error?: string }> {
		try {
			await execFileAsync('openssl', [
				'pkcs12',
				'-in',
				truststorePath,
				'-info',
				'-passin',
				`pass:${password}`,
				'-noout'
			]);
			return { valid: true };
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			if (msg.includes('mac verify failure') || msg.includes('invalid password')) {
				return { valid: false, error: 'Invalid truststore or password' };
			}
			return { valid: false, error: `Invalid truststore file: ${msg}` };
		}
	}

	/**
	 * Saves PEM certificate strings directly to disk.
	 * Used after enrollment when the TAK Server API returns PEM strings
	 * rather than a P12 bundle.
	 */
	static savePemCerts(
		configId: string,
		cert: string,
		key: string,
		ca: string[]
	): { certPath: string; keyPath: string; caPath?: string } {
		const configDir = this.validateConfigId(configId);
		if (fs.existsSync(configDir)) {
			fs.rmSync(configDir, { recursive: true, force: true });
		}
		fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });

		const certPath = path.join(configDir, 'client.crt');
		const keyPath = path.join(configDir, 'client.key');

		fs.writeFileSync(certPath, cert, { mode: 0o600 });
		fs.writeFileSync(keyPath, key, { mode: 0o600 });

		let caPath: string | undefined;
		if (ca.length > 0) {
			caPath = path.join(configDir, 'ca.crt');
			fs.writeFileSync(caPath, ca.join('\n'), { mode: 0o600 });
		}

		return { certPath, keyPath, caPath };
	}

	/**
	 * Deletes certificates for a configuration.
	 */
	static deleteCerts(configId: string) {
		const configDir = this.validateConfigId(configId);
		if (fs.existsSync(configDir)) {
			fs.rmSync(configDir, { recursive: true, force: true });
		}
	}
}
