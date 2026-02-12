import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { startGsmEvil, stopGsmEvil } from '$lib/server/services/gsm-evil/gsm-evil-control-service';

/**
 * POST /api/gsm-evil/control
 * Start or stop GSM Evil monitoring (grgsm_livemon_headless + GsmEvil2)
 * Body: { action: "start" | "stop", frequency?: string }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, frequency } = (await request.json()) as {
			action: string;
			frequency?: string;
		};

		if (action === 'start') {
			const result = await startGsmEvil(frequency);
			if (!result.success && result.conflictingService) {
				return json(result, { status: 409 });
			}
			return json(result, { status: result.success ? 200 : 500 });
		} else if (action === 'stop') {
			const result = await stopGsmEvil();
			// Check for timeout status (suggestion contains "nuclear")
			if (!result.success && result.error?.includes('timeout')) {
				return json(result, { status: 408 });
			}
			return json(result, { status: result.success ? 200 : 500 });
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
		console.error('Control API error:', error);
		return json(
			{
				success: false,
				message: 'Invalid request',
				error: (error as Error).message
			},
			{ status: 400 }
		);
	}
};
