import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { wifiteManager } from '$lib/server/wifite/process-manager';

export const GET: RequestHandler = async () => {
	const status = wifiteManager.getStatus();
	return json({ results: status.results });
};
