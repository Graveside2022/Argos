// WebSocket endpoint for Kismet real-time data
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request }) => {
	const upgradeHeader = request.headers.get('upgrade');
	if (upgradeHeader !== 'websocket') {
		return json(
			{ error: 'Expected WebSocket upgrade request' },
			{ status: 426, headers: { Upgrade: 'websocket' } }
		);
	}

	// SvelteKit doesn't directly support WebSocket upgrades.
	// Handled by the separate WebSocket server (port 3001).
	return json(
		{ error: 'WebSocket endpoint — requires platform-specific adapter' },
		{ status: 501 }
	);
};

// Alternative: Document how to set up WebSocket server separately
export const config = {
	api: {
		bodyParser: false
	}
};
