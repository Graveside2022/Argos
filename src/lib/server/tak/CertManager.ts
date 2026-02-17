import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class CertManager {
	private static readonly BASE_DIR = 'data/certs';

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
		const configDir = path.join(this.BASE_DIR, configId);

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
			// Extract Certificate
			await execAsync(
				`openssl pkcs12 -in "${p12Path}" -clcerts -nokeys -out "${certPath}" -passin pass:"${password}"`
			);

			// Extract Private Key
			await execAsync(
				`openssl pkcs12 -in "${p12Path}" -nocerts -out "${keyPath}" -passin pass:"${password}" -nodes`
			);

			// Extract CA Certificate (if present)
			const caPath = path.join(configDir, 'ca.crt');
			try {
				await execAsync(
					`openssl pkcs12 -in "${p12Path}" -cacerts -nokeys -out "${caPath}" -passin pass:"${password}"`
				);
				fs.chmodSync(caPath, 0o600);
			} catch (_e) {
				// CA might not be present, ignore or log
			}

			// Set strict permissions on extracted files
			fs.chmodSync(certPath, 0o600);
			fs.chmodSync(keyPath, 0o600);

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
		const configDir = path.join(this.BASE_DIR, configId);
		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
		}

		const caPath = path.join(configDir, 'ca.crt');
		fs.writeFileSync(caPath, caBuffer, { mode: 0o600 });
		return caPath;
	}

	/**
	 * Deletes certificates for a configuration.
	 */
	static deleteCerts(configId: string) {
		const configDir = path.join(this.BASE_DIR, configId);
		if (fs.existsSync(configDir)) {
			fs.rmSync(configDir, { recursive: true, force: true });
		}
	}
}
