import fs from 'node:fs';
import path from 'node:path';

import { json } from '@sveltejs/kit';

import { CertManager } from '$lib/server/tak/cert-manager';
import { TakPackageParser } from '$lib/server/tak/tak-package-parser';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const MAX_PACKAGE_SIZE = 10 * 1024 * 1024; // 10 MB

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('packageFile') as File | null;

		if (!file) {
			return json({ success: false, error: 'No file provided' }, { status: 400 });
		}

		if (file.size > MAX_PACKAGE_SIZE) {
			return json({ success: false, error: 'File too large (max 10 MB)' }, { status: 413 });
		}

		const configId = (formData.get('id') as string) || crypto.randomUUID();

		// Write uploaded zip to a temp file for TakPackageParser
		const tmpDir = path.join('data', 'tmp');
		fs.mkdirSync(tmpDir, { recursive: true });
		const zipPath = path.join(tmpDir, `upload-${configId}.zip`);
		const buffer = Buffer.from(await file.arrayBuffer());
		fs.writeFileSync(zipPath, buffer);

		try {
			CertManager.init();
			const parsed = await TakPackageParser.parse(zipPath);

			// Save extracted cert files to the config's cert directory
			const certDir = CertManager.validateConfigId(configId);
			fs.mkdirSync(certDir, { recursive: true, mode: 0o700 });

			let clientCertPath: string | undefined;
			let truststorePath: string | undefined;

			for (const cert of parsed.certFiles) {
				const destPath = path.join(certDir, cert.name);
				fs.writeFileSync(destPath, cert.data, { mode: 0o600 });
				const ext = path.extname(cert.name).toLowerCase();
				if (ext === '.p12' && cert.name.toLowerCase().includes('truststore')) {
					truststorePath = destPath;
				} else if (ext === '.p12') {
					clientCertPath = destPath;
				}
			}

			const config = {
				hostname: parsed.hostname,
				port: parsed.port,
				protocol: 'tls' as const,
				description: parsed.description,
				truststorePath,
				clientCertPath
			};

			// Determine if enrollment is needed
			let warning: string | undefined;
			if (parsed.enrollForCert && !clientCertPath) {
				warning =
					'This data package requires certificate enrollment. Switch to "Enroll for Certificate" in the Authentication section to get your client cert.';
			} else if (!clientCertPath && !parsed.enrollForCert) {
				warning =
					'No client certificate found in package. You will need to upload one separately or enroll for one.';
			}

			return json({ success: true, id: configId, config, warning });
		} finally {
			// Clean up temp zip
			if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
		}
	} catch (err) {
		if (err instanceof Error && err.name === 'InputValidationError') {
			return json({ success: false, error: err.message }, { status: 400 });
		}
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('no manifest.xml')) {
			return json(
				{ success: false, error: 'Invalid data package — no manifest.xml found' },
				{ status: 400 }
			);
		}
		if (msg.includes('No certificates found')) {
			return json(
				{
					success: false,
					error: 'No certificates found in data package — import trust store and client certificate manually'
				},
				{ status: 400 }
			);
		}
		logger.error('Failed to process data package', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
