import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { pagermonManager } from '$lib/server/pagermon/processManager';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, frequency, gain } = (await request.json()) as {
			action: string;
			frequency?: number;
			gain?: number;
		};

		if (action === 'start') {
			const result = await pagermonManager.start({ frequency, gain });
			if (!result.success) {
				return json(
					{ success: false, error: result.error },
					{ status: result.error?.includes('in use') ? 409 : 500 }
				);
			}
			return json({ success: true });
		} else if (action === 'stop') {
			await pagermonManager.stop();
			return json({ success: true });
		} else {
			return json({ success: false, error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: 500 });
	}
};
