import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { errMsg } from '$lib/server/api/error-utils';
import { startGsmEvil, stopGsmEvil } from '$lib/server/services/gsm-evil/gsm-evil-control-service';
import { logger } from '$lib/utils/logger';

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

function selectStartStatus(result: { success: boolean; conflictingService?: string }): number {
	if (!result.success && result.conflictingService) return 409;
	return result.success ? 200 : 500;
}

function selectStopStatus(result: { success: boolean; error?: string }): number {
	if (!result.success && result.error?.includes('timeout')) return 408;
	return result.success ? 200 : 500;
}

async function handleStart(frequency?: string) {
	const result = await startGsmEvil(frequency);
	return json(result, { status: selectStartStatus(result) });
}

async function handleStop() {
	const result = await stopGsmEvil();
	return json(result, { status: selectStopStatus(result) });
}

const actionHandlers: Record<string, (frequency?: string) => Promise<Response>> = {
	start: handleStart,
	stop: handleStop
};

/**
 * POST /api/gsm-evil/control
 * Start or stop GSM Evil monitoring (grgsm_livemon_headless + GsmEvil2)
 * Body: { action: "start" | "stop", frequency?: string }
 */
export const POST = createHandler(async ({ request }) => {
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
		const handler = actionHandlers[action];

		if (!handler) {
			return json({ success: false, message: 'Invalid action' }, { status: 400 });
		}

		return await handler(frequency);
	} catch (error: unknown) {
		logger.error('Control API error', { error: errMsg(error) });
		return json(
			{
				success: false,
				message: 'Invalid request',
				error: errMsg(error)
			},
			{ status: 400 }
		);
	}
});
