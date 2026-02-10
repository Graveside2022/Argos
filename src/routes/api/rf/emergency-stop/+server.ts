import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { UsrpSweepManager } from '$lib/server/usrp/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const deviceType = (body.deviceType as string) || 'hackrf';

		if (deviceType === 'usrp') {
			// Emergency stop USRP
			const usrpManager = UsrpSweepManager.getInstance();
			await usrpManager.emergencyStop();

			return json({
				status: 'success',
				message: 'USRP emergency stop executed',
				device: 'usrp',
				stopped: true
			});
		} else {
			// Emergency stop HackRF
			await sweepManager.emergencyStop();

			return json({
				status: 'success',
				message: 'HackRF emergency stop executed',
				device: 'hackrf',
				stopped: true
			});
		}
	} catch (error: unknown) {
		console.error('Error in rf/emergency-stop endpoint:', error);
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
