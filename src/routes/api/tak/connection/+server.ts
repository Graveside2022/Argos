import { createHandler } from '$lib/server/api/create-handler';
import { TakService } from '$lib/server/tak/tak-service';
import { logger } from '$lib/utils/logger';

/** GET /api/tak/connection — Check current TAK server connection status */
export const GET = createHandler(async () => {
	const service = TakService.getInstance();
	const status = service.getStatus();
	return { success: true, ...status };
});

/** POST /api/tak/connection — Connect to the configured TAK server */
export const POST = createHandler(async () => {
	const service = TakService.getInstance();
	// Reload config from DB — cert/truststore uploads may have changed paths since last load
	service.reloadConfig();
	logger.info('[TAK API] Config before connect:', { config: service.getStatus() });
	await service.connect();
	const status = service.getStatus();
	return { success: true, status: status.status };
});

/** DELETE /api/tak/connection — Disconnect from the TAK server */
export const DELETE = createHandler(async () => {
	const service = TakService.getInstance();
	service.disconnect();
	return { success: true, status: 'disconnected' };
});
