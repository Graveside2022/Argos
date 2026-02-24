import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { performGsmScan } from '$lib/server/services/gsm-evil/gsm-scan-service';

/**
 * POST /api/gsm-evil/scan
 * Perform GSM frequency scan to detect active towers
 * Body (optional): { frequency?: number }
 */
export const POST = createHandler(async ({ request }) => {
	// Parse request body for frequency parameter
	let requestedFreq = null;
	try {
		const body = await request.json();
		if (body.frequency) {
			requestedFreq = parseFloat(body.frequency);
		}
	} catch (_error: unknown) {
		// No body or invalid JSON, use defaults
	}

	const result = await performGsmScan(requestedFreq);
	return json(result, { status: result.success ? 200 : 500 });
});
