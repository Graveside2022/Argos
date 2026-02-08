import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

interface ResourceState {
	device: string;
	available: boolean;
	owner: string | null;
	connectedSince: number | null;
	detected: boolean;
}

interface HardwareStatus {
	hackrf: ResourceState;
	alfa: ResourceState;
	bluetooth: ResourceState;
}

const defaultState: HardwareStatus = {
	hackrf: {
		device: 'hackrf',
		available: true,
		owner: null,
		connectedSince: null,
		detected: false
	},
	alfa: { device: 'alfa', available: true, owner: null, connectedSince: null, detected: false },
	bluetooth: {
		device: 'bluetooth',
		available: true,
		owner: null,
		connectedSince: null,
		detected: false
	}
};

export const hardwareStatus = writable<HardwareStatus>(defaultState);

export const hackrfAvailable = derived(hardwareStatus, ($s) => $s.hackrf.available);
export const alfaAvailable = derived(hardwareStatus, ($s) => $s.alfa.available);
export const hackrfOwner = derived(hardwareStatus, ($s) => $s.hackrf.owner);
export const alfaOwner = derived(hardwareStatus, ($s) => $s.alfa.owner);
export const hackrfDetected = derived(hardwareStatus, ($s) => $s.hackrf.detected);
export const alfaDetected = derived(hardwareStatus, ($s) => $s.alfa.detected);

let pollInterval: ReturnType<typeof setInterval> | null = null;

async function fetchStatus(): Promise<void> {
	try {
		const response = await fetch('/api/hardware/status');
		if (response.ok) {
			const data = await response.json();
			hardwareStatus.set(data);
		}
	} catch (_error: unknown) {
		// Network error, keep current state
	}
}

export function startPolling(): void {
	if (!browser || pollInterval) return;

	fetchStatus();
	pollInterval = setInterval(fetchStatus, 5000);

	// Pause when tab is hidden
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			if (pollInterval) {
				clearInterval(pollInterval);
				pollInterval = null;
			}
		} else {
			fetchStatus();
			pollInterval = setInterval(fetchStatus, 5000);
		}
	});
}

export function stopPolling(): void {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}

export async function acquireDevice(
	toolName: string,
	device: string
): Promise<{ success: boolean; error?: string; owner?: string }> {
	try {
		const response = await fetch('/api/hardware/acquire', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ toolName, device })
		});
		const result = await response.json();
		if (result.success) {
			await fetchStatus();
		}
		return result;
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}

export async function releaseDevice(
	toolName: string,
	device: string
): Promise<{ success: boolean; error?: string }> {
	try {
		const response = await fetch('/api/hardware/release', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ toolName, device })
		});
		const result = await response.json();
		if (result.success) {
			await fetchStatus();
		}
		return result;
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}

export async function forceReleaseDevice(
	device: string
): Promise<{ success: boolean; error?: string }> {
	try {
		const response = await fetch('/api/hardware/force-release', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ device })
		});
		const result = await response.json();
		if (result.success) {
			await fetchStatus();
		}
		return result;
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}
