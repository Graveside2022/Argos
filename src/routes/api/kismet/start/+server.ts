import { json } from '@sveltejs/kit';

import { startKismet } from '$lib/server/services/kismet/kismet-control-service';

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
		console.error('Kismet start error:', error);

		return json(
			{
				success: false,
				error: (error as Error).message,
				message: 'Failed to start Kismet'
			},
			{ status: 500 }
		);
	}
};
