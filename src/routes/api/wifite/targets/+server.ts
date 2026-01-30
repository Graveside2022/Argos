import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ fetch: svelteKitFetch }) => {
	try {
		// Get devices from Kismet
		const kismetResponse = await svelteKitFetch('/api/kismet/devices').catch(() => null);
		let devices: any[] = [];

		if (kismetResponse?.ok) {
			const data = await kismetResponse.json();
			devices = (data.devices || [])
				.filter((d: any) => {
					// Fusion path uses deviceType: 'access_point', KismetProxy uses type: 'AP'
					const dtype = d.deviceType || d.type || '';
					return dtype === 'access_point' || dtype === 'AP' || dtype === 'ap';
				})
				.map((d: any) => ({
					bssid: d.mac || d.macaddr || '',
					essid: d.ssid || d.name || '',
					channel: parseInt(d.channel) || 0,
					encryption: formatEncryption(d.encryption || d.encryptionType || d.crypt),
					power: extractSignal(d),
					clients: Array.isArray(d.associations) ? d.associations.length : d.clients || 0
				}))
				.sort((a: any, b: any) => b.power - a.power);
		}

		return json({ targets: devices });
	} catch (error) {
		return json({ targets: [], error: (error as Error).message });
	}
};

function extractSignal(d: any): number {
	// Kismet returns signal as { last_signal: -57, max_signal: -57, min_signal: -57 }
	if (typeof d.signalStrength === 'number') return d.signalStrength;
	if (d.signal && typeof d.signal === 'object' && typeof d.signal.last_signal === 'number') {
		return d.signal.last_signal;
	}
	if (typeof d.signal === 'number') return d.signal;
	return -100;
}

function formatEncryption(enc: unknown): string {
	if (Array.isArray(enc)) {
		return enc.length > 0 ? enc.join('/') : 'Open';
	}
	if (typeof enc === 'string' && enc) {
		return enc;
	}
	return 'Unknown';
}
