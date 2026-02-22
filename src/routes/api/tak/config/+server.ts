import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { getRFDatabase } from '$lib/server/db/database';
import { loadTakConfig } from '$lib/server/tak/tak-db';
import { TakService } from '$lib/server/tak/tak-service';
import type { TakServerConfig } from '$lib/types/tak';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const TakConfigSchema = z.object({
	id: z.string().uuid().optional(),
	name: z.string().min(1).max(256),
	hostname: z.string().min(1).max(253),
	port: z.number().int().min(1).max(65535),
	protocol: z.literal('tls'),
	certPath: z.string().optional(),
	keyPath: z.string().optional(),
	caPath: z.string().optional(),
	shouldConnectOnStartup: z.boolean(),
	authMethod: z.enum(['enroll', 'import']).optional(),
	truststorePath: z.string().optional(),
	truststorePass: z.string().max(256).optional(),
	certPass: z.string().max(256).optional(),
	enrollmentUser: z.string().max(256).optional(),
	enrollmentPass: z.string().max(256).optional(),
	enrollmentPort: z.number().int().min(1).max(65535).optional()
});

export const GET: RequestHandler = async () => {
	const db = getRFDatabase();
	const config = loadTakConfig(db.rawDb);
	return json(config ?? null);
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const parsed = TakConfigSchema.safeParse(await request.json());
		if (!parsed.success) {
			return json(
				{ success: false, error: parsed.error.issues.map((i) => i.message).join('; ') },
				{ status: 400 }
			);
		}

		const config = parsed.data as TakServerConfig;
		if (!config.id) {
			config.id = crypto.randomUUID();
		}

		// saveConfig handles DB persistence + in-memory update + reconnect
		const service = TakService.getInstance();
		await service.saveConfig(config);

		return json({ success: true, config });
	} catch (err) {
		logger.error('Failed to save TAK config', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
