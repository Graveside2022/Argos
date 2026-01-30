import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { wifiteManager } from '$lib/server/wifite/processManager';
import type { AttackMode } from '$lib/server/wifite/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, targets, channels, timeout, attackMode } = (await request.json()) as {
			action: string;
			targets?: string[];
			channels?: number[];
			timeout?: number;
			attackMode?: AttackMode;
		};

		if (action === 'start') {
			if (!targets || targets.length === 0) {
				return json({ success: false, error: 'No targets specified' }, { status: 400 });
			}
			const result = await wifiteManager.start({
				targets,
				channels: channels || [],
				timeout: timeout || 300,
				attackMode: attackMode || 'auto'
			});
			if (!result.success) {
				return json({ success: false, error: result.error }, { status: 500 });
			}
			return json({ success: true });
		} else if (action === 'stop') {
			await wifiteManager.stop();
			return json({ success: true });
		} else {
			return json({ success: false, error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: 500 });
	}
};
