import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { btleManager } from '$lib/server/btle/processManager';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, channel } = (await request.json()) as { action: string; channel?: number };

		if (action === 'start') {
			const result = await btleManager.start({ channel });
			if (!result.success) {
				return json(
					{ success: false, error: result.error },
					{ status: result.error?.includes('in use') ? 409 : 500 }
				);
			}
			return json({ success: true });
		} else if (action === 'stop') {
			await btleManager.stop();
			return json({ success: true });
		} else {
			return json({ success: false, error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: 500 });
	}
};
