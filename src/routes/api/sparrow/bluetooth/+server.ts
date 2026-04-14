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
export const POST = createHandler(async ({ request }) => {
	const rawBody = await request.json();
	const validated = safeParseWithHandling(BluetoothControlSchema, rawBody, 'user-action');
	if (!validated) return error(400, 'Invalid Bluetooth control request');

	const success =
		validated.action === 'start' ? await startBluetoothScan() : await stopBluetoothScan();

	return json({
		success,
		message: success
			? `Bluetooth scan ${validated.action === 'start' ? 'started' : 'stopped'}`
			: `Failed to ${validated.action} Bluetooth scan`
	});
});
