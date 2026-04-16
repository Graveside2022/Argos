import { writable } from 'svelte/store';

import {
	DragonSyncDronesResponseSchema,
	DragonSyncStatusResultSchema
} from '$lib/schemas/dragonsync';
import type {
	DragonSyncDrone,
	DragonSyncServiceStatus,
	DragonSyncStatusResult
} from '$lib/types/dragonsync';

export interface UASState {
	status: DragonSyncServiceStatus;
	droneCount: number;
	drones: Map<string, DragonSyncDrone>;
	error: string | null;
	lastUpdated: number | null;
	droneidGoRunning: boolean;
	dragonSyncRunning: boolean;
	apiReachable: boolean;
}

const INITIAL_STATE: UASState = {
	status: 'stopped',
	droneCount: 0,
	drones: new Map(),
	error: null,
	lastUpdated: null,
	droneidGoRunning: false,
	dragonSyncRunning: false,
	apiReachable: false
};

export const uasStore = writable<UASState>({ ...INITIAL_STATE, drones: new Map() });

export function applyUASStatus(status: DragonSyncStatusResult): void {
	uasStore.update((s) => ({
		...s,
		status: status.status,
		droneCount: status.droneCount,
		droneidGoRunning: status.droneidGoRunning,
		dragonSyncRunning: status.dragonSyncRunning,
		apiReachable: status.apiReachable,
		error: status.error ?? null,
		lastUpdated: Date.now()
	}));
}

export function applyUASDrones(drones: DragonSyncDrone[]): void {
	uasStore.update((s) => {
		const map = new Map<string, DragonSyncDrone>();
		for (const drone of drones) {
			map.set(drone.id, drone);
		}
		return { ...s, drones: map, droneCount: map.size, lastUpdated: Date.now() };
	});
}

export function setUASError(err: string): void {
	uasStore.update((s) => ({ ...s, error: err }));
}

export function resetUASStore(): void {
	uasStore.set({ ...INITIAL_STATE, drones: new Map() });
}

export async function fetchUASStatus(): Promise<void> {
	try {
		const res = await fetch('/api/dragonsync/status', { credentials: 'same-origin' });
		if (!res.ok) throw new Error(`status ${res.status}`);
		const raw: unknown = await res.json();
		const parsed = DragonSyncStatusResultSchema.safeParse(raw);
		if (!parsed.success) throw new Error('invalid status response');
		applyUASStatus(parsed.data as DragonSyncStatusResult);
	} catch (err) {
		setUASError(err instanceof Error ? err.message : 'status fetch failed');
	}
}

export async function fetchUASDrones(): Promise<void> {
	try {
		const res = await fetch('/api/dragonsync/devices', { credentials: 'same-origin' });
		if (!res.ok) throw new Error(`devices ${res.status}`);
		const raw: unknown = await res.json();
		const parsed = DragonSyncDronesResponseSchema.safeParse(raw);
		if (!parsed.success) throw new Error('invalid drones response');
		applyUASDrones(parsed.data.drones as DragonSyncDrone[]);
	} catch (err) {
		setUASError(err instanceof Error ? err.message : 'devices fetch failed');
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
	const res = await fetch('/api/dragonsync/control', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'same-origin',
		body: JSON.stringify(body)
	});
	const data = (await res.json()) as ControlResponse;
	return { ok: res.ok && data.success === true, data };
}

function handleControlFailure(data: ControlResponse, failLabel: string): void {
	setUASError(data.error ?? data.message ?? failLabel);
}

async function runControl(body: Record<string, unknown>, failLabel: string): Promise<boolean> {
	try {
		const { ok, data } = await sendControlRequest(body);
		if (!ok) {
			handleControlFailure(data, failLabel);
			return false;
		}
		await fetchUASStatus();
		return true;
	} catch (err) {
		setUASError(err instanceof Error ? err.message : failLabel);
		return false;
	}
}

export async function startDragonSyncFromUi(): Promise<boolean> {
	return runControl({ action: 'start' }, 'start request failed');
}

export async function stopDragonSyncFromUi(): Promise<boolean> {
	return runControl({ action: 'stop' }, 'stop request failed');
}
