import { json } from '@sveltejs/kit';

import {
	getKismetStatus,
	startKismetExtended,
	stopKismetExtended
} from '$lib/server/services/kismet/kismet-control-service-extended';

import type { RequestHandler } from './$types';

/**
 * POST /api/kismet/control
 * Start, stop, or check status of Kismet WiFi discovery service
 * Body: { action: "start" | "stop" | "status" }
 * Query: ?mock=true for mock responses (testing)
 */
export const POST: RequestHandler = async ({ request, url }) => {
	try {
		// Safe: Request body structure validated - action property extracted for control logic
		const { action } = (await request.json()) as {
			action: unknown;
		};

		// Only use mock responses if explicitly requested via ?mock=true
		const useMock = url.searchParams.get('mock') === 'true';

		if (useMock) {
			if (action === 'start') {
				return json({
					success: true,
					message: 'Kismet service started (mock mode)',
					details: 'Mock Kismet process started successfully'
				});
			} else if (action === 'stop') {
				return json({
					success: true,
					message: 'Kismet stopped gracefully (mock mode)'
				});
			} else if (action === 'status') {
				return json({
					success: true,
					running: false,
					status: 'inactive'
				});
			}
		}

		if (action === 'start') {
			const result = await startKismetExtended();
			return json(result, { status: result.success ? 200 : result.error ? 400 : 500 });
		} else if (action === 'stop') {
			const result = await stopKismetExtended();
			return json(result, { status: result.success ? 200 : 500 });
		} else if (action === 'status') {
			const result = await getKismetStatus();
			return json(result);
		} else {
			return json(
				{
					success: false,
					message: 'Invalid action'
				},
				{ status: 400 }
			);
		}
	} catch (error: unknown) {
		return json(
			{
				success: false,
				message: 'Server error',
				// Safe: Error object cast to extract optional message property for user-friendly error response
				error: (error as { message?: string }).message
			},
			{ status: 500 }
		);
	}
};
