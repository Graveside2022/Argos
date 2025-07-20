import { json } from '@sveltejs/kit';
import { debugToolSearch } from '$lib/server/toolCheckerDebug';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		console.log('Running tool debug search...');
		const debugInfo = debugToolSearch();
		
		return json({
			success: true,
			debug: debugInfo,
			message: 'Check server console for detailed output'
		});
	} catch (error) {
		console.error('Debug tool search error:', error);
		return json({
			success: false,
			error: error.message
		}, { status: 500 });
	}
};