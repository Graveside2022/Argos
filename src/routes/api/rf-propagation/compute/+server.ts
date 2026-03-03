/**
 * POST /api/rf-propagation/compute
 *
 * Runs a coverage area computation via the CloudRF cloud API.
 * Returns a PNG overlay as a base64 data URI with geographic bounds.
 */

import { json } from '@sveltejs/kit';

import { CoverageRequestSchema } from '$lib/schemas/rf-propagation';
import { createHandler } from '$lib/server/api/create-handler';
import { CloudRFError, computeArea } from '$lib/server/services/cloudrf/cloudrf-client';
import { safeParseWithHandling } from '$lib/utils/validation-error';

export const POST = createHandler(async ({ request }) => {
	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
	}
	const validated = safeParseWithHandling(CoverageRequestSchema, rawBody, 'api');
	if (!validated) {
		return json({ success: false, error: 'Invalid coverage request' }, { status: 400 });
	}

	try {
		const result = await computeArea(validated);
		return {
			success: true,
			imageDataUri: result.imageDataUri,
			bounds: result.bounds,
			legend: result.legend,
			meta: result.meta
		};
	} catch (err: unknown) {
		if (err instanceof CloudRFError) {
			return json({ success: false, error: err.message }, { status: err.statusCode });
		}
		throw err;
	}
});
