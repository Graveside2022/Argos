import { writable, derived } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

// Types
export interface ServiceConnectionStatus {
    connected: boolean;
    connecting: boolean;
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
    running: boolean;
    pid?: number;
    uptime?: number;
    memory?: number;
    cpu?: number;
}

// Individual service connection stores
export const hackrfConnection: Writable<ServiceConnectionStatus> = writable({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0
});

export const kismetConnection: Writable<ServiceConnectionStatus> = writable({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0
});

export const expressConnection: Writable<ServiceConnectionStatus> = writable({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0
});

// System health store
export const systemHealth: Writable<SystemHealth | null> = writable(null);

// Service statuses
export const serviceStatuses: Writable<Map<string, ServiceStatus>> = writable(new Map<string, ServiceStatus>());

// WebSocket connection states
export const webSocketStates: Writable<Map<string, number>> = writable(new Map<string, number>());

// Derived stores
export const allConnected: Readable<boolean> = derived(
    [hackrfConnection, kismetConnection, expressConnection],
    ([$hackrf, $kismet, $express]) => 
        $hackrf.connected && $kismet.connected && $express.connected
);

export const anyConnecting: Readable<boolean> = derived(
    [hackrfConnection, kismetConnection, expressConnection],
    ([$hackrf, $kismet, $express]) => 
        $hackrf.connecting || $kismet.connecting || $express.connecting
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

export const systemHealthy: Readable<boolean> = derived(
    systemHealth,
    $health => {
        if (!$health) return false;
        return $health.cpu < 80 && 
               $health.memory < 80 && 
               $health.disk < 90 &&
               (!$health.temperature || $health.temperature < 70);
    }
);

export const runningServices: Readable<ServiceStatus[]> = derived(
    serviceStatuses,
    $statuses => Array.from($statuses.values()).filter(s => s.running)
);

export const stoppedServices: Readable<ServiceStatus[]> = derived(
    serviceStatuses,
    $statuses => Array.from($statuses.values()).filter(s => !s.running)
);

// Helper functions
export function updateHackRFConnection(updates: Partial<ServiceConnectionStatus>) {
    hackrfConnection.update(status => ({ ...status, ...updates }));
}

export function updateKismetConnection(updates: Partial<ServiceConnectionStatus>) {
    kismetConnection.update(status => ({ ...status, ...updates }));
}

export function updateExpressConnection(updates: Partial<ServiceConnectionStatus>) {
    expressConnection.update(status => ({ ...status, ...updates }));
}

export function updateSystemHealth(health: SystemHealth | null) {
    systemHealth.set(health);
}

export function updateServiceStatus(name: string, status: ServiceStatus) {
    serviceStatuses.update(statuses => {
        const map = new Map(statuses);
        map.set(name, status);
        return map;
    });
}

export function removeServiceStatus(name: string) {
    serviceStatuses.update(statuses => {
        const map = new Map(statuses);
        map.delete(name);
        return map;
    });
}

export function updateWebSocketState(name: string, state: number) {
    webSocketStates.update(states => {
        const map = new Map(states);
        map.set(name, state);
        return map;
    });
}

export function removeWebSocketState(name: string) {
    webSocketStates.update(states => {
        const map = new Map(states);
        map.delete(name);
        return map;
    });
}

export function resetConnectionStores() {
    hackrfConnection.set({
        connected: false,
        connecting: false,
        error: null,
        reconnectAttempts: 0
    });
    kismetConnection.set({
        connected: false,
        connecting: false,
        error: null,
        reconnectAttempts: 0
    });
    expressConnection.set({
        connected: false,
        connecting: false,
        error: null,
        reconnectAttempts: 0
    });
    systemHealth.set(null);
    serviceStatuses.set(new Map<string, ServiceStatus>());
    webSocketStates.set(new Map<string, number>());
}

// Utility functions
export function getWebSocketStateText(state: number | undefined): string {
    switch (state) {
        case 0: return 'Connecting';
        case 1: return 'Open';
        case 2: return 'Closing';
        case 3: return 'Closed';
        default: return 'Unknown';
    }
}

export function getConnectionStatusClass(status: ServiceConnectionStatus): string {
    if (status.connected) return 'text-green-600';
    if (status.connecting) return 'text-yellow-600';
    if (status.error) return 'text-red-600';
    return 'text-gray-600';
}

export function getHealthStatusClass(value: number, thresholds: { warning: number; danger: number }): string {
    if (value >= thresholds.danger) return 'text-red-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-green-600';
}