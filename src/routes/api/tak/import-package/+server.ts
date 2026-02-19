import fs from 'node:fs';
import path from 'node:path';

import { json } from '@sveltejs/kit';

import { CertManager } from '$lib/server/tak/CertManager';
import { TakPackageParser } from '$lib/server/tak/TakPackageParser';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('packageFile') as File | null;

		if (!file) {
			return json({ success: false, error: 'No file provided' }, { status: 400 });
		}

		const configId = (formData.get('id') as string) ?? crypto.randomUUID();

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
			const certDir = path.join('data/certs', configId);
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
				protocol: 'ssl' as const,
				description: parsed.description,
				truststorePath,
				clientCertPath
			};

			if (parsed.certFiles.length === 0) {
				return json({
					success: true,
					id: configId,
					config,
					warning:
						'No certificates found in data package — import trust store and client certificate manually'
				});
			}

			return json({ success: true, id: configId, config });
		} finally {
			// Clean up temp zip
			if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg.includes('no manifest.xml')) {
			return json(
				{ success: false, error: 'Invalid data package — no manifest.xml found' },
				{ status: 400 }
			);
		}
		console.error('Failed to process data package:', err);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
