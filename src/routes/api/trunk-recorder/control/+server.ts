import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getStatus,
	restart,
	start,
	startResultToResponse,
	stop
} from '$lib/server/services/trunk-recorder/service';
import { ControlActionSchema, type ControlBody } from '$lib/server/services/trunk-recorder/types';

/**
 * POST /api/trunk-recorder/control
 *
 * Body: { action: 'start' | 'stop' | 'restart' | 'status', presetId?: string }
 *
 * `start` and `restart` require a presetId. Starting takes an EXCLUSIVE HackRF
 * lock — trunk-recorder is not a WebRX-peer; any other tool holding the HackRF
 * returns 409 Conflict with the current owner name.
 *
 * `stop` leaves rdio-scanner running so archived calls stay replayable.
 */
export const POST = createHandler(
	async ({ request }) => {
		const { action, presetId } = (await request.json()) as ControlBody;

		if (action === 'status') {
			const status = await getStatus();
			return json({ success: true, ...status });
		}

		if (action === 'stop') {
			const result = await stop();
			return json(result);
		}

		if (!presetId) {
			return json(
				{ success: false, message: `Action '${action}' requires a presetId` },
				{ status: 400 }
			);
		}

		const result = action === 'start' ? await start(presetId) : await restart(presetId);
		return startResultToResponse(result);
	},
	{ validateBody: ControlActionSchema }
);
