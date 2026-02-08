import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const deviceType = (body.deviceType as string) || 'hackrf';

		// Always use the HackRF sweep manager which handles both devices
		await sweepManager.stopSweep();

		return json({
			status: 'success',
			message: 'Sweep stopped successfully',
			device: deviceType || 'auto'
		});
	} catch (error: unknown) {
		console.error('Error in rf/stop-sweep endpoint:', error);
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
