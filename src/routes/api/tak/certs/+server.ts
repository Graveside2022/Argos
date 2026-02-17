import { json } from '@sveltejs/kit';

import { CertManager } from '$lib/server/tak/CertManager';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

// POST: Upload .p12 certificate
export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('p12File') as File;
		const password = formData.get('password') as string;

		if (!file || !password) {
			return json({ error: 'Missing file or password' }, { status: 400 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		// We need a config ID to store certs securely
		// Check if ID passed in form data, else generate
		let configId = formData.get('id') as string;
		if (!configId) {
			configId = crypto.randomUUID();
		}

		// Save and extract
		const paths = await CertManager.saveAndExtract(configId, buffer, password);

		// Update DB options if an ID is provided? Or just return paths?
		// Let's return paths, frontend will populate config form.

		return json({
			success: true,
			id: configId,
			paths: {
				certPath: paths.certPath,
				keyPath: paths.keyPath,
				caPath: paths.caPath
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.error('Failed to upload/extract certs', { error: message });
		return json({ error: 'Failed to process certificate: ' + message }, { status: 500 });
	}
};
