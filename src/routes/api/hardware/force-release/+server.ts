import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { device } = (await request.json()) as { device: string };

		if (!device) {
			return json({ success: false, error: 'Missing device' }, { status: 400 });
		}

		const deviceEnum = device as HardwareDevice;
		if (!Object.values(HardwareDevice).includes(deviceEnum)) {
			return json({ success: false, error: `Invalid device: ${device}` }, { status: 400 });
		}

		const result = await resourceManager.forceRelease(deviceEnum);

		if (!result.success) {
			return json(
				{ success: false, error: 'Failed to force-release device' },
				{ status: 500 }
			);
		}

		return json({ success: true });
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: 500 });
	}
};
