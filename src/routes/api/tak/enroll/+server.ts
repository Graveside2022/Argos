import { json } from '@sveltejs/kit';

import { CertManager } from '$lib/server/tak/CertManager';

import type { RequestHandler } from './$types';

interface EnrollRequest {
	hostname: string;
	port: number;
	username: string;
	password: string;
	id: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as EnrollRequest;
		const { hostname, port = 8446, username, password, id } = body;

		if (!hostname || !username || !password) {
			return json(
				{ success: false, error: 'Missing required fields: hostname, username, password' },
				{ status: 400 }
			);
		}

		const configId = id || crypto.randomUUID();

		// TAKAPI creates a Credentials instance on construction
		// Usage: api.Credentials.generate() handles CSR + POST + PEM response
		const { TAKAPI, APIAuthPassword } = await import('@tak-ps/node-tak');

		const api = new TAKAPI(
			new URL(`https://${hostname}:${port}`),
			new APIAuthPassword(username, password)
		);

		let result: { ca: string[]; cert: string; key: string };
		try {
			result = await api.Credentials.generate();
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
			throw err;
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
		console.error('Enrollment failed:', err);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
