import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { CertManager } from '$lib/server/tak/CertManager';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const EnrollSchema = z.object({
	hostname: z.string().min(1).max(253),
	port: z.number().int().min(1).max(65535).default(8446),
	username: z.string().min(1).max(256),
	password: z.string().min(1).max(256),
	id: z.string().uuid().optional()
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const parsed = EnrollSchema.safeParse(await request.json());
		if (!parsed.success) {
			return json(
				{ success: false, error: parsed.error.issues.map((i) => i.message).join('; ') },
				{ status: 400 }
			);
		}

		const { hostname, port, username, password, id } = parsed.data;
		const configId = id || crypto.randomUUID();

		// TAKAPI creates a Credentials instance on construction
		// Usage: api.Credentials.generate() handles CSR + POST + PEM response
		const { TAKAPI, APIAuthPassword } = await import('@tak-ps/node-tak');

		let result: { ca: string[]; cert: string; key: string };
		try {
			// TAK servers use self-signed certs — temporarily disable TLS verification
			// for the enrollment HTTPS calls (OAuth login + config + signClient)
			const prevTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
			try {
				// Use TAKAPI.init() to perform OAuth login first — gets JWT for all API calls
				const api = await TAKAPI.init(
					new URL(`https://${hostname}:${port}`),
					new APIAuthPassword(username, password)
				);
				result = await api.Credentials.generate();
			} finally {
				// Restore previous setting
				if (prevTLS === undefined) {
					delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
				} else {
					process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTLS;
				}
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('401') || msg.includes('403') || msg.includes('auth')) {
				return json(
					{
						success: false,
						error: 'Authentication failed — check username and password'
					},
					{ status: 401 }
				);
			}
			if (
				msg.includes('ECONNREFUSED') ||
				msg.includes('ETIMEDOUT') ||
				msg.includes('ENOTFOUND')
			) {
				return json(
					{
						success: false,
						error: `Enrollment server unreachable at ${hostname}:${port} — verify the server address and that port ${port} is accessible`
					},
					{ status: 502 }
				);
			}
			// Forward actual error message instead of generic 500
			logger.error('Enrollment API call failed', { error: msg });
			return json({ success: false, error: msg }, { status: 502 });
		}

		// Save PEM files
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
		if (err instanceof Error && err.name === 'InputValidationError') {
			return json({ success: false, error: err.message }, { status: 400 });
		}
		logger.error('Enrollment failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
