import { json } from '@sveltejs/kit';

import { getRFDatabase } from '$lib/server/db/database';
import { loadTakConfig } from '$lib/server/tak/tak-db';
import { TakService } from '$lib/server/tak/TakService';
import type { TakServerConfig } from '$lib/types/tak';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const db = getRFDatabase();
	const config = loadTakConfig(db.rawDb);
	return json(config ?? null);
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const config = (await request.json()) as TakServerConfig;

		if (!config.id) {
			config.id = crypto.randomUUID();
		}

		// saveConfig handles DB persistence + in-memory update + reconnect
		const service = TakService.getInstance();
		await service.saveConfig(config);

		return json({ success: true, config });
	} catch (err) {
		console.error('Failed to save TAK config:', err);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
