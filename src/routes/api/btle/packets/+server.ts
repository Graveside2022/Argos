import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { btleManager } from '$lib/server/btle/processManager';

export const GET: RequestHandler = async ({ url }) => {
	const mac = url.searchParams.get('mac') || undefined;
	const channel = url.searchParams.get('channel')
		? parseInt(url.searchParams.get('channel')!)
		: undefined;
	const packets = btleManager.getPackets({ mac, channel });
	return json({ packets, total: packets.length });
};
