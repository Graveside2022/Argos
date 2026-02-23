import fs from 'node:fs';
import path from 'node:path';

import { json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';
import { CertManager } from '$lib/server/tak/cert-manager';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const MAX_TRUSTSTORE_SIZE = 1024 * 1024; // 1 MB

/** Return true if the error is an InputValidationError from the security layer. */
function isInputValidationError(err: unknown): err is Error {
	return err instanceof Error && err.name === 'InputValidationError';
}

/** Validate form data and return the file, password, and configId, or an error Response. */
function validateFormData(formData: FormData):
	| {
			file: File;
			password: string;
			configId: string;
	  }
	| Response {
	const file = formData.get('p12File') as File | null;
	const password = (formData.get('password') as string) || 'atakatak';
	const configId = (formData.get('id') as string) || crypto.randomUUID();

	if (!file) {
		return json({ success: false, error: 'No file provided' }, { status: 400 });
	}

	if (file.size > MAX_TRUSTSTORE_SIZE) {
		return json({ success: false, error: 'File too large (max 1 MB)' }, { status: 413 });
	}

	return { file, password, configId };
}

/** Ensure the config directory exists and write the truststore .p12 file. */
async function saveTruststore(
	configId: string,
	file: File
): Promise<{ truststorePath: string; configDir: string }> {
	CertManager.init();
	const configDir = CertManager.validateConfigId(configId);
	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
	}

	const truststorePath = path.join(configDir, 'truststore.p12');
	const buffer = Buffer.from(await file.arrayBuffer());
	fs.writeFileSync(truststorePath, buffer, { mode: 0o600 });
	return { truststorePath, configDir };
}

/** Validate the truststore and return an error Response if invalid, or null if valid. */
async function validateTruststoreFile(
	truststorePath: string,
	password: string
): Promise<Response | null> {
	const result = await CertManager.validateTruststore(truststorePath, password);
	if (!result.valid) {
		fs.unlinkSync(truststorePath);
		return json(
			{ success: false, error: result.error ?? 'Invalid truststore file' },
			{ status: 400 }
		);
	}
	return null;
}

/** Extract the CA certificate from a .p12 truststore using openssl. */
async function extractCaCert(
	configDir: string,
	truststorePath: string,
	password: string
): Promise<string> {
	const caPath = path.join(configDir, 'ca.crt');
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
	return caPath;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const validated = validateFormData(formData);
		if (validated instanceof Response) return validated;

		const { file, password, configId } = validated;
		const { truststorePath, configDir } = await saveTruststore(configId, file);

		const validationError = await validateTruststoreFile(truststorePath, password);
		if (validationError) return validationError;

		const caPath = await extractCaCert(configDir, truststorePath, password);

		return json({
			success: true,
			id: configId,
			paths: { truststorePath, caPath }
		});
	} catch (err) {
		if (isInputValidationError(err)) {
			return json({ success: false, error: err.message }, { status: 400 });
		}
		logger.error('Failed to process truststore', { error: errMsg(err) });
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
