/**
 * GET /api/kismet/health
 *
 * Structured health probe for Kismet: process alive + API responding +
 * devices endpoint fetchable. Used by the SITREP automation script and
 * any consumer that needs more than "process is running" as a signal.
 */

import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { probeKismetHealth } from '$lib/server/services/kismet/kismet-health';

export const GET = createHandler(async () => {
	const health = await probeKismetHealth();
	return json(health, { status: health.healthy ? 200 : 503 });
});
