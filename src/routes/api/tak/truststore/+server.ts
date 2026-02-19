import fs from 'node:fs';
import path from 'node:path';

import { json } from '@sveltejs/kit';

import { CertManager } from '$lib/server/tak/CertManager';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('p12File') as File | null;
		const password = (formData.get('password') as string) ?? 'atakatak';
		const configId = (formData.get('id') as string) ?? crypto.randomUUID();

		if (!file) {
			return json({ success: false, error: 'No file provided' }, { status: 400 });
		}

		CertManager.init();
		const configDir = path.join('data/certs', configId);
		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
		}

		const truststorePath = path.join(configDir, 'truststore.p12');
		const buffer = Buffer.from(await file.arrayBuffer());
		fs.writeFileSync(truststorePath, buffer, { mode: 0o600 });

		// Validate the truststore
		const result = await CertManager.validateTruststore(truststorePath, password);
		if (!result.valid) {
			fs.unlinkSync(truststorePath);
			return json(
				{ success: false, error: result.error ?? 'Invalid truststore file' },
				{ status: 400 }
			);
		}

		// Extract CA certificate from truststore
		const caPath = path.join(configDir, 'ca.crt');
		const { execFile } = await import('node:child_process');
		const { promisify } = await import('node:util');
		const execFileAsync = promisify(execFile);

		await execFileAsync('openssl', [
			'pkcs12',
			'-in',
			truststorePath,
			'-cacerts',
			'-nokeys',
			'-out',
			caPath,
			'-passin',
			`pass:${password}`
		]);
		fs.chmodSync(caPath, 0o600);

		return json({
			success: true,
			id: configId,
			paths: {
				truststorePath,
				caPath
			}
		});
	} catch (err) {
		console.error('Failed to process truststore:', err);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
