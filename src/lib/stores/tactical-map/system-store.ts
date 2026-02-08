import { writable, type Writable } from 'svelte/store';

export interface SystemInfo {
	hostname: string;
	ip: string;
	wifiInterfaces: Array<{
		name: string;
		ip: string;
		mac: string;
	}>;
	cpu: {
		usage: number;
		model: string;
		cores: number;
	};
	memory: {
		total: number;
		used: number;
		percentage: number;
	};
	storage: {
		total: number;
		used: number;
		percentage: number;
	};
	temperature: number;
	uptime: number;
	battery?: {
		level: number;
		charging: boolean;
	};
}

export interface SystemState {
	info: SystemInfo | null;
	lastUpdated: number;
	isLoading: boolean;
	error: string | null;
	autoRefreshEnabled: boolean;
	refreshInterval: number; // in milliseconds
}

const initialSystemState: SystemState = {
	info: null,
	lastUpdated: 0,
	isLoading: false,
	error: null,
	autoRefreshEnabled: false,
	refreshInterval: 30000 // 30 seconds default
};

export const systemStore: Writable<SystemState> = writable(initialSystemState);

// Helper functions to update store
export const setSystemInfo = (info: SystemInfo) => {
	systemStore.update(state => ({
		...state,
		info,
		lastUpdated: Date.now(),
		isLoading: false,
		error: null
	}));
};

export const setSystemLoading = (isLoading: boolean) => {
	systemStore.update(state => ({ ...state, isLoading }));
};

export const setSystemError = (error: string | null) => {
	systemStore.update(state => ({ ...state, error, isLoading: false }));
};

export const setAutoRefresh = (enabled: boolean, interval?: number) => {
	systemStore.update(state => ({
		...state,
		autoRefreshEnabled: enabled,
		refreshInterval: interval || state.refreshInterval
	}));
};

export const clearSystemInfo = () => {
	systemStore.update(state => ({
		...state,
		info: null,
		lastUpdated: 0,
		error: null,
		isLoading: false
	}));
};

// Utility functions for system info analysis
export const getSystemHealthStatus = (info: SystemInfo | null): 'good' | 'warning' | 'critical' => {
	if (!info) return 'critical';
	
	// Check critical thresholds
	if (info.cpu.usage > 90 || info.memory.percentage > 90 || info.storage.percentage > 90) {
		return 'critical';
	}
	
	// Check warning thresholds
	if (info.cpu.usage > 70 || info.memory.percentage > 70 || info.storage.percentage > 80 || info.temperature > 65) {
		return 'warning';
	}
	
	return 'good';
};

export const formatUptime = (uptime: number): string => {
	const days = Math.floor(uptime / 86400);
	const hours = Math.floor((uptime % 86400) / 3600);
	const minutes = Math.floor((uptime % 3600) / 60);
	
	if (days > 0) {
		return `${days}d ${hours}h ${minutes}m`;
	} else if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else {
		return `${minutes}m`;
	}
};

export const formatBytes = (bytes: number): string => {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let size = bytes;
	let unitIndex = 0;
	
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}
	
	return `${size.toFixed(1)} ${units[unitIndex]}`;
};