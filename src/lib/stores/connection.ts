import type { Readable, Writable } from 'svelte/store';
import { derived, writable } from 'svelte/store';

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

const DEFAULT_CONNECTION_STATUS: ServiceConnectionStatus = {
	isConnected: false,
	isConnecting: false,
	error: null,
	reconnectAttempts: 0
};

export const kismetConnection: Writable<ServiceConnectionStatus> = writable({
	...DEFAULT_CONNECTION_STATUS
});

export const systemHealth: Writable<SystemHealth | null> = writable(null);

export const serviceStatuses: Writable<Map<string, ServiceStatus>> = writable(
	new Map<string, ServiceStatus>()
);

export const webSocketStates: Writable<Map<string, number>> = writable(new Map<string, number>());

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
	kismetConnection.set({ ...DEFAULT_CONNECTION_STATUS });
	systemHealth.set(null);
	serviceStatuses.set(new Map<string, ServiceStatus>());
	webSocketStates.set(new Map<string, number>());
}
