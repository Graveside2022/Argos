import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getBluetoothDevices,
	getBluetoothPresent,
	isBluetoothScanRunning,
	startBluetoothScan,
	stopBluetoothScan
} from '$lib/server/services/sparrow/sparrow-proxy-service';
import { safeParseWithHandling } from '$lib/utils/validation-error';

const BluetoothControlSchema = z.object({
	action: z.enum(['start', 'stop']).describe('Bluetooth scan control action')
});

/**
 * GET /api/sparrow/bluetooth
 * Returns current BT scan status and discovered devices.
 */
export const GET = createHandler(async () => {
	const [present, running, devices] = await Promise.all([
		getBluetoothPresent(),
		isBluetoothScanRunning(),
		getBluetoothDevices()
	]);
	return json({ present, running, devices, count: devices.length });
});

/**
 * POST /api/sparrow/bluetooth
 * Start or stop Bluetooth scanning on the Sparrow agent.
 * Body: { action: "start" | "stop" }
 */
async function parseBody(request: Request) {
	try {
		return await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
}

function buildBtMessage(action: string, success: boolean): string {
	const verb = action === 'start' ? 'started' : 'stopped';
	return success ? `Bluetooth scan ${verb}` : `Failed to ${action} Bluetooth scan`;
}

export const POST = createHandler(async ({ request }) => {
	const rawBody = await parseBody(request);
	const validated = safeParseWithHandling(BluetoothControlSchema, rawBody, 'user-action');
	if (!validated) throw error(400, 'Invalid Bluetooth control request');

	const success =
		validated.action === 'start' ? await startBluetoothScan() : await stopBluetoothScan();

	return json({ success, message: buildBtMessage(validated.action, success) });
});
