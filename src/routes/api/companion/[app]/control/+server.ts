import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { companionLauncher } from '$lib/server/companion/launcher';

export const POST: RequestHandler = async ({ params, request }) => {
	const appName = params.app;

	if (!companionLauncher.isValidApp(appName)) {
		return json(
			{ success: false, error: `Unknown companion app: ${appName}` },
			{ status: 404 }
		);
	}

	try {
		const { action } = (await request.json()) as { action: string };

		if (action === 'start') {
			const status = await companionLauncher.launch(appName);
			return json({ success: true, ...status });
		} else if (action === 'stop') {
			const status = await companionLauncher.stop(appName);
			return json({ success: true, ...status });
		} else if (action === 'status') {
			const status = await companionLauncher.getStatus(appName);
			return json({ success: true, ...status });
		} else {
			return json({ success: false, error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: 500 });
	}
};
