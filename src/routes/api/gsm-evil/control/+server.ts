import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { startGsmEvil, stopGsmEvil } from '$lib/server/services/gsm-evil/gsm-evil-control-service';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/**
 * Zod schema for GSM Evil control POST request
 * Task: T030 - Constitutional Audit Remediation (P1)
 */
const GsmEvilControlRequestSchema = z.object({
	action: z.enum(['start', 'stop']).describe('Control action: start or stop GSM monitoring'),
	frequency: z
		.string()
		.regex(/^\d+(\.\d+)?$/, 'Frequency must be a valid number')
		.optional()
		.describe('GSM frequency in MHz (e.g., "947.2")')
});

/**
 * POST /api/gsm-evil/control
 * Start or stop GSM Evil monitoring (grgsm_livemon_headless + GsmEvil2)
 * Body: { action: "start" | "stop", frequency?: string }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const rawBody = await request.json();

		// Validate request body with Zod (T030)
		const validationResult = GsmEvilControlRequestSchema.safeParse(rawBody);

		if (!validationResult.success) {
			return json(
				{
					success: false,
					message: 'Invalid request body',
					errors: validationResult.error.format()
				},
				{ status: 400 }
			);
		}

		const { action, frequency } = validationResult.data;

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
		logger.error('Control API error', { error: (error as Error).message });
		return json(
			{
				success: false,
				message: 'Invalid request',
				// Safe: Catch block error cast to Error for message extraction
				// Safe: Catch block error cast to Error for message extraction
				error: (error as Error).message
			},
			{ status: 400 }
		);
	}
};
