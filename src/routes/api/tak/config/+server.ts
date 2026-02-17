import { json } from '@sveltejs/kit';

import { TakService } from '$lib/server/tak/TakService';
import type { TakServerConfig } from '$lib/types/tak';

import type { RequestHandler } from './$types';

// GET: Retrieve the current TAK configuration
// GET: Retrieve the current TAK configuration
export const GET: RequestHandler = async () => {
	// Better to query DB to ensure fresh data.
	// Assuming getRFDatabase handles singleton.
	const { getRFDatabase } = await import('$lib/server/db/database');
	const dbInstance = getRFDatabase();

	// safe property access if rawDb is public or use exposed method
	const stmt = dbInstance.rawDb.prepare('SELECT * FROM tak_configs LIMIT 1');
	const config = stmt.get() as TakServerConfig | undefined;

	if (!config) {
		return json(null);
	}

	return json(config);
};

// POST: Save/Update TAK configuration
export const POST: RequestHandler = async ({ request }) => {
	try {
		const config = (await request.json()) as TakServerConfig;

		if (!config.id) {
			config.id = crypto.randomUUID();
		}

		const service = TakService.getInstance();
		await service.saveConfig(config);

		return json({ success: true, config });
	} catch (err) {
		console.error('Failed to save TAK config:', err);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
