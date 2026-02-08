import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import * as bettercapClient from '$lib/server/bettercap/api-client';

export const GET: RequestHandler = async () => {
	try {
		const [wifiAPs, bleDevices] = await Promise.all([
			bettercapClient.getWiFiAPs(),
			bettercapClient.getBLEDevices()
		]);

		return json({ wifiAPs, bleDevices });
	} catch (error) {
		return json({ wifiAPs: [], bleDevices: [], error: (error as Error).message });
	}
};
