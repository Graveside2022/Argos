import { json } from '@sveltejs/kit';

import { EmergencyStopRequestSchema } from '$lib/schemas/rf';
import { createHandler } from '$lib/server/api/create-handler';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

export const POST = createHandler(async ({ request }) => {
	const rawBody = await request.json();
	const validated = safeParseWithHandling(EmergencyStopRequestSchema, rawBody, 'user-action');
	if (!validated)
		return json(
			{ status: 'error', message: 'Invalid emergency stop request' },
			{ status: 400 }
		);

	await sweepManager.emergencyStop();
	return {
		status: 'success',
		message: 'HackRF emergency stop executed',
		device: 'hackrf',
		stopped: true
	};
});

// Add CORS headers
export const OPTIONS: RequestHandler = ({ request }) => {
	const origin = request.headers.get('origin');
	return new Response(null, {
		status: 204,
		headers: getCorsHeaders(origin)
	});
};
