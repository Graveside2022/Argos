import { json } from '@sveltejs/kit';

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
		logger.error('Kismet start error', { error: (error as Error).message });

		return json(
			{
				success: false,
				// Safe: Catch block error from KismetProxy.start() throws Error instances
				// Safe: Catch block error cast to Error for message extraction
				error: (error as Error).message,
				message: 'Failed to start Kismet'
			},
			{ status: 500 }
		);
	}
};
