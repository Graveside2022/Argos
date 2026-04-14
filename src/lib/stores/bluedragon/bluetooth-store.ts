import { writable } from 'svelte/store';

import type {
	BluedragonProfile,
	BluedragonStatus,
	BluedragonStatusResult,
	BluetoothDevice
} from '$lib/types/bluedragon';

export interface BluetoothState {
	status: BluedragonStatus;
	pid: number | null;
	startedAt: number | null;
	packetCount: number;
	deviceCount: number;
	profile: BluedragonProfile | null;
	devices: Map<string, BluetoothDevice>;
	error: string | null;
	lastUpdated: number | null;
}

const INITIAL_STATE: BluetoothState = {
	status: 'stopped',
	pid: null,
	startedAt: null,
	packetCount: 0,
	deviceCount: 0,
	profile: null,
	devices: new Map(),
	error: null,
	lastUpdated: null
};

export const bluetoothStore = writable<BluetoothState>({
	...INITIAL_STATE,
	devices: new Map()
});

export function applyBluetoothStatus(status: BluedragonStatusResult): void {
	bluetoothStore.update((s) => ({
		...s,
		status: status.status,
		pid: status.pid,
		startedAt: status.startedAt,
		packetCount: status.packetCount,
		deviceCount: status.deviceCount,
		profile: status.profile,
		error: null,
		lastUpdated: Date.now()
	}));
}

export function applyBluetoothDevices(devices: BluetoothDevice[]): void {
	bluetoothStore.update((s) => {
		const map = new Map<string, BluetoothDevice>();
		for (const device of devices) {
			map.set(device.addr, device);
		}
		return { ...s, devices: map, deviceCount: map.size, lastUpdated: Date.now() };
	});
}

export function setBluetoothError(err: string): void {
	bluetoothStore.update((s) => ({ ...s, error: err }));
}

export function resetBluetoothStore(): void {
	bluetoothStore.set({ ...INITIAL_STATE, devices: new Map() });
}

export async function fetchBluetoothStatus(): Promise<void> {
	try {
		const res = await fetch('/api/bluedragon/status', { credentials: 'same-origin' });
		if (!res.ok) throw new Error(`status ${res.status}`);
		const data = (await res.json()) as BluedragonStatusResult;
		applyBluetoothStatus(data);
	} catch (err) {
		setBluetoothError(err instanceof Error ? err.message : 'status fetch failed');
	}
}

export async function fetchBluetoothDevices(): Promise<void> {
	try {
		const res = await fetch('/api/bluedragon/devices', { credentials: 'same-origin' });
		if (!res.ok) throw new Error(`devices ${res.status}`);
		const data = (await res.json()) as { success: boolean; devices: BluetoothDevice[] };
		if (data.success) applyBluetoothDevices(data.devices);
	} catch (err) {
		setBluetoothError(err instanceof Error ? err.message : 'devices fetch failed');
	}
}

interface ControlResponse {
	success?: boolean;
	message?: string;
	error?: string;
}

async function sendControlRequest(
	body: Record<string, unknown>
): Promise<{ ok: boolean; data: ControlResponse }> {
	const res = await fetch('/api/bluedragon/control', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'same-origin',
		body: JSON.stringify(body)
	});
	const data = (await res.json()) as ControlResponse;
	return { ok: res.ok && data.success === true, data };
}

function handleControlFailure(data: ControlResponse, failLabel: string): void {
	setBluetoothError(data.error ?? data.message ?? failLabel);
}

async function runControl(body: Record<string, unknown>, failLabel: string): Promise<boolean> {
	try {
		const { ok, data } = await sendControlRequest(body);
		if (!ok) {
			handleControlFailure(data, failLabel);
			return false;
		}
		await fetchBluetoothStatus();
		return true;
	} catch (err) {
		setBluetoothError(err instanceof Error ? err.message : failLabel);
		return false;
	}
}

export async function startBluedragonFromUi(
	profile: BluedragonProfile = 'volume'
): Promise<boolean> {
	return runControl({ action: 'start', profile }, 'start request failed');
}

export async function stopBluedragonFromUi(): Promise<boolean> {
	return runControl({ action: 'stop' }, 'stop request failed');
}
