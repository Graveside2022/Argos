import { error, json } from '@sveltejs/kit';

import { EmergencyStopRequestSchema } from '$lib/schemas/rf';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const rawBody = await request.json();
		const validated = safeParseWithHandling(EmergencyStopRequestSchema, rawBody, 'user-action');

		if (!validated) {
			return error(400, 'Invalid emergency stop request');
		}

		// Emergency stop HackRF (USRP support removed - duplicate code)
		await sweepManager.emergencyStop();

		return json({
			status: 'success',
			message: 'HackRF emergency stop executed',
			device: 'hackrf',
			stopped: true
		});
	} catch (error: unknown) {
		logger.error('Error in rf/emergency-stop endpoint', {
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
