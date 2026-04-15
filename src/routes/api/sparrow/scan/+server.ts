import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { scanNetworks } from '$lib/server/services/sparrow/sparrow-proxy-service';
import { safeParseWithHandling } from '$lib/utils/validation-error';

const ScanQuerySchema = z.object({
	interface: z
		.string()
		.min(1)
		.max(20)
		.regex(/^[a-zA-Z0-9_-]+$/, 'Invalid interface name')
		.describe('WiFi interface name')
});

/**
 * GET /api/sparrow/scan?interface=wlan0
 * Returns WiFi scan results from Sparrow agent for the specified interface.
 */
export const GET = createHandler(async ({ url }) => {
	const params = Object.fromEntries(url.searchParams);
	const validated = safeParseWithHandling(ScanQuerySchema, params, 'api');
	if (!validated) return error(400, 'Missing or invalid interface parameter');

	const networks = await scanNetworks(validated.interface);
	return json({ networks, count: networks.length });
});
