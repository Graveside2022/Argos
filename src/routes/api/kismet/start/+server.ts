import { json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { startKismet } from '$lib/server/services/kismet/kismet-control-service';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/**
 * POST /api/kismet/start
 * Starts Kismet WiFi discovery service
 */
export const POST: RequestHandler = async () => {
	try {
		const result = await startKismet();

		if (!result.success) {
			return json(result, { status: 500 });
		}

		return json(result);
	} catch (error) {
		logger.error('Kismet start error', { error: errMsg(error) });

		return json(
			{
				success: false,
				error: errMsg(error),
				message: 'Failed to start Kismet'
			},
			{ status: 500 }
		);
	}
};
