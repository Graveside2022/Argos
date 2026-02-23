import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { errMsg } from '$lib/server/api/error-utils';
import { CertManager } from '$lib/server/tak/cert-manager';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const EnrollSchema = z.object({
	hostname: z.string().min(1).max(253),
	port: z.number().int().min(1).max(65535).default(8446),
	username: z.string().min(1).max(256),
	password: z.string().min(1).max(256),
	id: z.string().uuid().optional()
});

/** Return true if the error is an InputValidationError from the security layer. */
function isInputValidationError(err: unknown): err is Error {
	return err instanceof Error && err.name === 'InputValidationError';
}

/** Enrollment error patterns mapped to user-facing HTTP responses. */
const ENROLLMENT_ERROR_MAP: Array<{
	patterns: string[];
	status: number;
	message: (hostname: string, port: number) => string;
}> = [
	{
		patterns: ['401', '403', 'auth'],
		status: 401,
		message: () => 'Authentication failed — check username and password'
	},
	{
		patterns: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
		status: 502,
		message: (hostname, port) =>
			`Enrollment server unreachable at ${hostname}:${port} — verify the server address and that port ${port} is accessible`
	}
];

/**
 * Match an enrollment error message against known patterns and return
 * the appropriate JSON error response, or null if no pattern matches.
 */
function matchEnrollmentError(msg: string, hostname: string, port: number): Response | null {
	for (const entry of ENROLLMENT_ERROR_MAP) {
		if (entry.patterns.some((p) => msg.includes(p))) {
			return json(
				{ success: false, error: entry.message(hostname, port) },
				{ status: entry.status }
			);
		}
	}
	return null;
}

/**
 * Temporarily disable Node TLS verification, run the callback,
 * then restore the original setting. Required for TAK server
 * self-signed certificate enrollment.
 */
async function withTlsDisabled<T>(fn: () => Promise<T>): Promise<T> {
	const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
	try {
		return await fn();
	} finally {
		if (prev === undefined) {
			delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
		} else {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
		}
	}
}

/** Validate the request body against the enrollment schema. */
function parseEnrollRequest(body: unknown): z.infer<typeof EnrollSchema> | Response {
	const parsed = EnrollSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{ success: false, error: parsed.error.issues.map((i) => i.message).join('; ') },
			{ status: 400 }
		);
	}
	return parsed.data;
}

/**
 * Perform TAK server credential enrollment via the @tak-ps/node-tak SDK.
 * Returns the generated certificate material or an error Response.
 */
async function performEnrollment(
	hostname: string,
	port: number,
	username: string,
	password: string
): Promise<{ ca: string[]; cert: string; key: string } | Response> {
	try {
		const { TAKAPI, APIAuthPassword } = await import('@tak-ps/node-tak');
		const result = await withTlsDisabled(async () => {
			const api = await TAKAPI.init(
				new URL(`https://${hostname}:${port}`),
				new APIAuthPassword(username, password)
			);
			return api.Credentials.generate();
		});
		return result;
	} catch (err) {
		const msg = errMsg(err);
		const matched = matchEnrollmentError(msg, hostname, port);
		if (matched) return matched;

		logger.error('Enrollment API call failed', { error: msg });
		return json({ success: false, error: msg }, { status: 502 });
	}
}

/** Handle top-level catch errors: InputValidationError or generic 500. */
function handleCatchError(err: unknown, context: string): Response {
	if (isInputValidationError(err)) {
		return json({ success: false, error: err.message }, { status: 400 });
	}
	logger.error(context, { error: errMsg(err) });
	return json({ error: 'Internal Server Error' }, { status: 500 });
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = parseEnrollRequest(await request.json());
		if (data instanceof Response) return data;

		const { hostname, port, username, password, id } = data;
		const configId = id || crypto.randomUUID();

		const result = await performEnrollment(hostname, port, username, password);
		if (result instanceof Response) return result;

		CertManager.init();
		const paths = CertManager.savePemCerts(configId, result.cert, result.key, result.ca);

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
		return handleCatchError(err, 'Enrollment failed');
	}
};
