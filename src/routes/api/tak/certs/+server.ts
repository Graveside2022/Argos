import { json } from '@sveltejs/kit';

import { CertManager } from '$lib/server/tak/cert-manager';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const MAX_P12_SIZE = 1024 * 1024; // 1 MB

/** Extract error message from an unknown thrown value. */
function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** Return true if the error is an InputValidationError from the security layer. */
function isInputValidationError(err: unknown): err is Error {
	return err instanceof Error && err.name === 'InputValidationError';
}

/** Validate the uploaded form data and return the file, password, and configId. */
function validateFormData(formData: FormData):
	| {
			file: File;
			password: string;
			configId: string;
	  }
	| Response {
	const file = formData.get('p12File') as File;
	const password = formData.get('password') as string;

	if (!file || !password) {
		return json({ error: 'Missing file or password' }, { status: 400 });
	}

	if (file.size > MAX_P12_SIZE) {
		return json({ error: 'File too large (max 1 MB)' }, { status: 413 });
	}

	const configId = (formData.get('id') as string) || crypto.randomUUID();
	return { file, password, configId };
}

// POST: Upload .p12 certificate
export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const validated = validateFormData(formData);

		if (validated instanceof Response) {
			return validated;
		}

		const { file, password, configId } = validated;
		const buffer = Buffer.from(await file.arrayBuffer());
		const paths = await CertManager.saveAndExtract(configId, buffer, password);

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
		if (isInputValidationError(err)) {
			return json({ success: false, error: err.message }, { status: 400 });
		}
		logger.error('Failed to upload/extract certs', { error: errMsg(err) });
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
