import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { pagermonManager } from '$lib/server/pagermon/process-manager';

export const GET: RequestHandler = async ({ url }) => {
	const since = url.searchParams.get('since');
	const capcode = url.searchParams.get('capcode');

	let messages = pagermonManager.getMessages(since ? parseInt(since) : undefined);

	if (capcode) {
		messages = messages.filter((m) => m.capcode === capcode);
	}

	return json({ messages, total: messages.length });
};
