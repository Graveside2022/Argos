import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type {
	BettercapWiFiAP,
	BettercapBLEDevice,
	BettercapMode
} from '$lib/server/bettercap/types';

interface BettercapState {
	mode: BettercapMode | null;
	running: boolean;
	wifiAPs: BettercapWiFiAP[];
	bleDevices: BettercapBLEDevice[];
	commandHistory: string[];
	commandOutput: string[];
}

const defaultState: BettercapState = {
	mode: null,
	running: false,
	wifiAPs: [],
	bleDevices: [],
	commandHistory: [],
	commandOutput: []
};

export const bettercapState = writable<BettercapState>(defaultState);
export const bettercapRunning = derived(bettercapState, ($s) => $s.running);
export const bettercapMode = derived(bettercapState, ($s) => $s.mode);

let pollInterval: ReturnType<typeof setInterval> | null = null;

async function fetchStatus(): Promise<void> {
	try {
		const response = await fetch('/api/bettercap/status');
		if (response.ok) {
			const data = await response.json();
			bettercapState.update((s) => ({ ...s, running: data.running }));
		}
	} catch (_error: unknown) {
		/* ignore */
	}
}

async function fetchDevices(): Promise<void> {
	try {
		const response = await fetch('/api/bettercap/devices');
		if (response.ok) {
			const data = await response.json();
			bettercapState.update((s) => ({
				...s,
				wifiAPs: data.wifiAPs || [],
				bleDevices: data.bleDevices || []
			}));
		}
	} catch (_error: unknown) {
		/* ignore */
	}
}

export function startBettercapPolling(): void {
	if (!browser || pollInterval) return;
	fetchStatus();
	fetchDevices();
	pollInterval = setInterval(() => {
		fetchStatus();
		fetchDevices();
	}, 5000);
}

export function stopBettercapPolling(): void {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}

export async function startRecon(
	mode: BettercapMode
): Promise<{ success: boolean; error?: string }> {
	try {
		const response = await fetch('/api/bettercap/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'start', mode })
		});
		const result = await response.json();
		if (result.success) {
			bettercapState.update((s) => ({ ...s, running: true, mode }));
		}
		return result;
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}

export async function stopRecon(): Promise<{ success: boolean }> {
	try {
		const response = await fetch('/api/bettercap/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'stop' })
		});
		const result = await response.json();
		if (result.success) {
			bettercapState.update((s) => ({ ...s, running: false, mode: null }));
		}
		return result;
	} catch (_error: unknown) {
		return { success: false };
	}
}

export async function sendCommand(cmd: string): Promise<void> {
	try {
		const response = await fetch('/api/bettercap/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'command', command: cmd })
		});
		const result = await response.json();
		bettercapState.update((s) => ({
			...s,
			commandHistory: [...s.commandHistory, cmd],
			commandOutput: [...s.commandOutput, JSON.stringify(result.result ?? result.error ?? '')]
		}));
	} catch (_error: unknown) {
		/* ignore */
	}
}
