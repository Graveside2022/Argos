import { error, json } from '@sveltejs/kit';

import { StopSweepRequestSchema } from '$lib/schemas/rf';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const rawBody = await request.json();
		const validated = safeParseWithHandling(StopSweepRequestSchema, rawBody, 'user-action');

		if (!validated) {
			return error(400, 'Invalid stop sweep request');
		}

		const deviceType = validated.deviceType || 'hackrf';

		// Always use the HackRF sweep manager which handles both devices
		await sweepManager.stopSweep();

		return json({
			status: 'success',
			message: 'Sweep stopped successfully',
			device: deviceType || 'auto'
		});
	} catch (error: unknown) {
		logger.error('Error in rf/stop-sweep endpoint', {
			error: error instanceof Error ? error.message : String(error)
		});
		return json(
			{
				status: 'error',
				message: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

// Add CORS headers
export const OPTIONS: RequestHandler = ({ request }) => {
	const origin = request.headers.get('origin');
	return new Response(null, {
		status: 204,
		headers: getCorsHeaders(origin)
	});
};
