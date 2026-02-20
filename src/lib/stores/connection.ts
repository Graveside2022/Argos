import type { Readable, Writable } from 'svelte/store';
import { derived, writable } from 'svelte/store';

// Types
export interface ServiceConnectionStatus {
	isConnected: boolean;
	isConnecting: boolean;
	error: string | null;
	lastConnected?: number;
	lastError?: string;
	reconnectAttempts: number;
}

export interface SystemHealth {
	cpu: number;
	memory: number;
	disk: number;
	temperature?: number;
	uptime: number;
}

export interface ServiceStatus {
	name: string;
	isRunning: boolean;
	pid?: number;
	uptime?: number;
	memory?: number;
	cpu?: number;
}

// Individual service connection stores
export const hackrfConnection: Writable<ServiceConnectionStatus> = writable({
	isConnected: false,
	isConnecting: false,
	error: null,
	reconnectAttempts: 0
});

export const kismetConnection: Writable<ServiceConnectionStatus> = writable({
	isConnected: false,
	isConnecting: false,
	error: null,
	reconnectAttempts: 0
});

export const expressConnection: Writable<ServiceConnectionStatus> = writable({
	isConnected: false,
	isConnecting: false,
	error: null,
	reconnectAttempts: 0
});

// System health store
export const systemHealth: Writable<SystemHealth | null> = writable(null);

// Service statuses
export const serviceStatuses: Writable<Map<string, ServiceStatus>> = writable(
	new Map<string, ServiceStatus>()
);

// WebSocket connection states
export const webSocketStates: Writable<Map<string, number>> = writable(new Map<string, number>());

// Derived stores
export const allConnected: Readable<boolean> = derived(
	[hackrfConnection, kismetConnection, expressConnection],
	([$hackrf, $kismet, $express]) =>
		$hackrf.isConnected && $kismet.isConnected && $express.isConnected
);

export const anyConnecting: Readable<boolean> = derived(
	[hackrfConnection, kismetConnection, expressConnection],
	([$hackrf, $kismet, $express]) =>
		$hackrf.isConnecting || $kismet.isConnecting || $express.isConnecting
);

export const connectionErrors: Readable<string[]> = derived(
	[hackrfConnection, kismetConnection, expressConnection],
	([$hackrf, $kismet, $express]) => {
		const errors: string[] = [];
		if ($hackrf.error) errors.push(`HackRF: ${$hackrf.error}`);
		if ($kismet.error) errors.push(`Kismet: ${$kismet.error}`);
		if ($express.error) errors.push(`Express: ${$express.error}`);
		return errors;
	}
);

export const totalReconnectAttempts: Readable<number> = derived(
	[hackrfConnection, kismetConnection, expressConnection],
	([$hackrf, $kismet, $express]) =>
		$hackrf.reconnectAttempts + $kismet.reconnectAttempts + $express.reconnectAttempts
);

export const systemHealthy: Readable<boolean> = derived(systemHealth, ($health) => {
	if (!$health) return false;
	return (
		$health.cpu < 80 &&
		$health.memory < 80 &&
		$health.disk < 90 &&
		(!$health.temperature || $health.temperature < 70)
	);
});

export const runningServices: Readable<ServiceStatus[]> = derived(serviceStatuses, ($statuses) =>
	Array.from($statuses.values()).filter((s) => s.isRunning)
);

export const stoppedServices: Readable<ServiceStatus[]> = derived(serviceStatuses, ($statuses) =>
	Array.from($statuses.values()).filter((s) => !s.isRunning)
);

// Helper functions
export function updateHackRFConnection(updates: Partial<ServiceConnectionStatus>) {
	hackrfConnection.update((status) => ({ ...status, ...updates }));
}

export function updateKismetConnection(updates: Partial<ServiceConnectionStatus>) {
	kismetConnection.update((status) => ({ ...status, ...updates }));
}

export function updateSystemHealth(health: SystemHealth | null) {
	systemHealth.set(health);
}

export function updateServiceStatus(name: string, status: ServiceStatus) {
	serviceStatuses.update((statuses) => {
		const map = new Map(statuses);
		map.set(name, status);
		return map;
	});
}

export function updateWebSocketState(name: string, state: number) {
	webSocketStates.update((states) => {
		const map = new Map(states);
		map.set(name, state);
		return map;
	});
}

export function resetConnectionStores() {
	hackrfConnection.set({
		isConnected: false,
		isConnecting: false,
		error: null,
		reconnectAttempts: 0
	});
	kismetConnection.set({
		isConnected: false,
		isConnecting: false,
		error: null,
		reconnectAttempts: 0
	});
	expressConnection.set({
		isConnected: false,
		isConnecting: false,
		error: null,
		reconnectAttempts: 0
	});
	systemHealth.set(null);
	serviceStatuses.set(new Map<string, ServiceStatus>());
	webSocketStates.set(new Map<string, number>());
}
