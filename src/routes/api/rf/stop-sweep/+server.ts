import { json } from '@sveltejs/kit';

import { StopSweepRequestSchema } from '$lib/schemas/rf';
import { createHandler } from '$lib/server/api/create-handler';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

export const POST = createHandler(async ({ request }) => {
	const rawBody = await request.json();
	const validated = safeParseWithHandling(StopSweepRequestSchema, rawBody, 'user-action');
	if (!validated)
		return json({ status: 'error', message: 'Invalid stop sweep request' }, { status: 400 });

	await sweepManager.stopSweep();
	return {
		status: 'success',
		message: 'Sweep stopped successfully',
		device: validated.deviceType || 'hackrf'
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
