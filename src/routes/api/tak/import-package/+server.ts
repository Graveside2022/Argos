import fs from 'node:fs';
import path from 'node:path';

import { json } from '@sveltejs/kit';

import { CertManager } from '$lib/server/tak/cert-manager';
import type { ParsedTakPackage } from '$lib/server/tak/tak-package-parser';
import { TakPackageParser } from '$lib/server/tak/tak-package-parser';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const MAX_PACKAGE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Extract error message from an unknown thrown value. */
function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** Return true if the error is an InputValidationError from the security layer. */
function isInputValidationError(err: unknown): err is Error {
	return err instanceof Error && err.name === 'InputValidationError';
}

/** Validate the uploaded form data and return the file and configId, or an error Response. */
function validateUpload(formData: FormData): { file: File; configId: string } | Response {
	const file = formData.get('packageFile') as File | null;

	if (!file) {
		return json({ success: false, error: 'No file provided' }, { status: 400 });
	}

	if (file.size > MAX_PACKAGE_SIZE) {
		return json({ success: false, error: 'File too large (max 10 MB)' }, { status: 413 });
	}

	const configId = (formData.get('id') as string) || crypto.randomUUID();
	return { file, configId };
}

/** Write the uploaded file to a temporary zip path for parsing. */
async function writeTempZip(file: File, configId: string): Promise<string> {
	const tmpDir = path.join('data', 'tmp');
	fs.mkdirSync(tmpDir, { recursive: true });
	const zipPath = path.join(tmpDir, `upload-${configId}.zip`);
	const buffer = Buffer.from(await file.arrayBuffer());
	fs.writeFileSync(zipPath, buffer);
	return zipPath;
}

/** Determine the role of a .p12 cert file: 'truststore', 'client', or null for non-p12. */
function classifyP12Role(name: string): 'truststore' | 'client' | null {
	if (path.extname(name).toLowerCase() !== '.p12') return null;
	return name.toLowerCase().includes('truststore') ? 'truststore' : 'client';
}

/** Save cert files to disk and classify .p12 files into client cert and truststore paths. */
function classifyCertFiles(
	parsed: ParsedTakPackage,
	certDir: string
): { clientCertPath?: string; truststorePath?: string } {
	let clientCertPath: string | undefined;
	let truststorePath: string | undefined;

	for (const cert of parsed.certFiles) {
		const destPath = path.join(certDir, cert.name);
		fs.writeFileSync(destPath, cert.data, { mode: 0o600 });

		const role = classifyP12Role(cert.name);
		if (role === 'truststore') truststorePath = destPath;
		if (role === 'client') clientCertPath = destPath;
	}

	return { clientCertPath, truststorePath };
}

/** Determine if a warning is needed about missing client certificates. */
function buildCertWarning(
	enrollForCert: boolean | undefined,
	hasClientCert: boolean
): string | undefined {
	if (hasClientCert) return undefined;

	if (enrollForCert) {
		return 'This data package requires certificate enrollment. Switch to "Enroll for Certificate" in the Authentication section to get your client cert.';
	}
	return 'No client certificate found in package. You will need to upload one separately or enroll for one.';
}

/** Known error message patterns mapped to user-facing 400 responses. */
const KNOWN_ERROR_MAP: Record<string, string> = {
	'no manifest.xml': 'Invalid data package — no manifest.xml found',
	'No certificates found':
		'No certificates found in data package — import trust store and client certificate manually'
};

/** Match a thrown error against known patterns and return a 400 Response, or null. */
function matchKnownError(msg: string): Response | null {
	for (const [pattern, userMessage] of Object.entries(KNOWN_ERROR_MAP)) {
		if (msg.includes(pattern)) {
			return json({ success: false, error: userMessage }, { status: 400 });
		}
	}
	return null;
}

/**
 * Process the parsed package: save cert files and build the response payload.
 */
function processPackage(
	parsed: ParsedTakPackage,
	configId: string
): { config: Record<string, unknown>; warning?: string } {
	const certDir = CertManager.validateConfigId(configId);
	fs.mkdirSync(certDir, { recursive: true, mode: 0o700 });

	const { clientCertPath, truststorePath } = classifyCertFiles(parsed, certDir);

	const config = {
		hostname: parsed.hostname,
		port: parsed.port,
		protocol: 'tls' as const,
		description: parsed.description,
		truststorePath,
		clientCertPath
	};

	const warning = buildCertWarning(parsed.enrollForCert, !!clientCertPath);
	return { config, warning };
}

/** Handle top-level errors: validation errors, known patterns, or generic 500. */
function handleCatchError(err: unknown): Response {
	if (isInputValidationError(err)) {
		return json({ success: false, error: err.message }, { status: 400 });
	}
	const msg = errMsg(err);
	const matched = matchKnownError(msg);
	if (matched) return matched;

	logger.error('Failed to process data package', { error: msg });
	return json({ error: 'Internal Server Error' }, { status: 500 });
}

/** Safely remove a temp file if it exists. */
function cleanupTempFile(zipPath: string): void {
	if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const validated = validateUpload(formData);
		if (validated instanceof Response) return validated;

		const { file, configId } = validated;
		const zipPath = await writeTempZip(file, configId);

		try {
			CertManager.init();
			const parsed = await TakPackageParser.parse(zipPath);
			const { config, warning } = processPackage(parsed, configId);

			return json({ success: true, id: configId, config, warning });
		} finally {
			cleanupTempFile(zipPath);
		}
	} catch (err) {
		return handleCatchError(err);
	}
};
