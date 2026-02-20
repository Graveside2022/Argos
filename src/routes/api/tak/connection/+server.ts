import { json } from '@sveltejs/kit';

import { TakService } from '$lib/server/tak/TakService';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/** POST /api/tak/connection — Connect to the configured TAK server */
export const POST: RequestHandler = async () => {
	try {
		const service = TakService.getInstance();
		// Reload config from DB — cert/truststore uploads may have changed paths since last load
		service.reloadConfig();
		logger.info('[TAK API] Config before connect:', { config: (service as any).config });
		await service.connect();
		const status = service.getStatus();
		return json({ success: true, status: status.status });
	} catch (err) {
		logger.error('[TAK] Connect failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ success: false, error: 'Connection failed' }, { status: 500 });
	}
};

/** DELETE /api/tak/connection — Disconnect from the TAK server */
export const DELETE: RequestHandler = async () => {
	try {
		const service = TakService.getInstance();
		service.disconnect();
		return json({ success: true, status: 'disconnected' });
	} catch (err) {
		logger.error('[TAK] Disconnect failed', {
			error: err instanceof Error ? err.message : String(err)
		});
		return json({ success: false, error: 'Disconnect failed' }, { status: 500 });
	}
};
