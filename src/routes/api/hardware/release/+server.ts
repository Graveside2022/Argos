import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { resourceManager } from '$lib/server/hardware/resourceManager';
import { HardwareDevice } from '$lib/server/hardware/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { toolName, device } = (await request.json()) as {
			toolName: string;
			device: string;
		};

		if (!toolName || !device) {
			return json({ success: false, error: 'Missing toolName or device' }, { status: 400 });
		}

		const deviceEnum = device as HardwareDevice;
		if (!Object.values(HardwareDevice).includes(deviceEnum)) {
			return json({ success: false, error: `Invalid device: ${device}` }, { status: 400 });
		}

		const result = await resourceManager.release(toolName, deviceEnum);

		if (!result.success) {
			return json({ success: false, error: result.error }, { status: 403 });
		}

		return json({ success: true });
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: 500 });
	}
};
