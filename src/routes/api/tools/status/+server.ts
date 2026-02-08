import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { checkInstalledTools } from '$lib/server/tool-checker';

export const GET: RequestHandler = async () => {
	const tools = checkInstalledTools();
	return json(tools);
};
