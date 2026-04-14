import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { resetBluedragonDevices } from '$lib/server/services/bluedragon/process-manager';

export const POST = createHandler(async () => {
	resetBluedragonDevices();
	return json({ success: true, message: 'Blue Dragon device table reset' });
});
