import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

interface BLEPacket {
	mac: string;
	channel: number;
	rssi: number;
	pduType: string;
	advData: string;
	angle: number | null;
	timestamp: string;
	name: string | null;
}

interface BTLEState {
	running: boolean;
	channel: number;
	packets: BLEPacket[];
	packetCount: number;
	uniqueDevices: number;
}

const defaultState: BTLEState = {
	running: false,
	channel: 37,
	packets: [],
	packetCount: 0,
	uniqueDevices: 0
};

export const btleState = writable<BTLEState>(defaultState);
export const btleRunning = derived(btleState, ($s) => $s.running);

let pollInterval: ReturnType<typeof setInterval> | null = null;

async function fetchAll(): Promise<void> {
	try {
		const [statusRes, packetsRes] = await Promise.all([
			fetch('/api/btle/status'),
			fetch('/api/btle/packets')
		]);
		if (statusRes.ok) {
			const status = await statusRes.json();
			btleState.update((s) => ({
				...s,
				running: status.running,
				packetCount: status.packetCount,
				uniqueDevices: status.uniqueDevices,
				channel: status.channel
			}));
		}
		if (packetsRes.ok) {
			const data = await packetsRes.json();
			btleState.update((s) => ({ ...s, packets: data.packets.slice(-200) }));
		}
	} catch {
		/* ignore */
	}
}

export function startBtlePolling(): void {
	if (!browser || pollInterval) return;
	fetchAll();
	pollInterval = setInterval(fetchAll, 3000);
}

export function stopBtlePolling(): void {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}

export async function startBtle(channel?: number): Promise<{ success: boolean; error?: string }> {
	try {
		const res = await fetch('/api/btle/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'start', channel })
		});
		return await res.json();
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}

export async function stopBtle(): Promise<{ success: boolean }> {
	try {
		const res = await fetch('/api/btle/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'stop' })
		});
		return await res.json();
	} catch {
		return { success: false };
	}
}
