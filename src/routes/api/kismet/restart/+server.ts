/**
 * POST /api/kismet/restart
 *
 * Stop → wait → start → health-probe cycle. Used to recover a hung
 * Kismet daemon (process alive but HTTP API wedged). Returns 200 on
 * successful recovery, 503 when the restart completes but the daemon
 * is still unhealthy so callers can react without parsing error strings.
 */

import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { restartKismet } from '$lib/server/services/kismet/kismet-health';

export const POST = createHandler(async () => {
	const result = await restartKismet();
	return json(result, { status: result.success ? 200 : 503 });
});
