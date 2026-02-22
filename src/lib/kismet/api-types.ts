/**
 * Kismet API type definitions.
 * Extracted from api.ts to comply with Article 2.2 (max 300 lines/file).
 */

export interface KismetStatus {
	isRunning: boolean;
	pid?: number;
	uptime?: number;
	version?: string;
	devices?: number;
	lastUpdate?: string;
}

export interface KismetDevice {
	mac: string;
	type?: 'AP' | 'CLIENT' | 'BRIDGE' | 'UNKNOWN';
	firstSeen: string;
	lastSeen: string;
	ssid?: string;
	manufacturer?: string;
	signalStrength?: number;
	signal?: number; // Alias for signalStrength
	channel?: number;
	encryption?: string[];
	frequency?: number;
	packets?: number;
	lat?: number;
	lon?: number;
	alt?: number;
	gps?: {
		lat: number;
		lon: number;
		alt?: number;
	};
	bytes?: {
		rate?: number;
		total?: number;
	};
	wps?: {
		enabled: boolean;
		locked: boolean;
		version?: string;
	};
	probes?: string[];
}

export interface KismetScript {
	name: string;
	path: string;
	description?: string;
	running?: boolean;
	pid?: number;
}

export interface KismetStats {
	totalDevices: number;
	activeDevices: number;
	packetsPerSecond: number;
	memoryUsage: number;
	cpuUsage: number;
	uptime: number;
}

export interface KismetConfig {
	interfaces: string[];
	logLevel: string;
	gpsd: {
		enabled: boolean;
		host: string;
		port: number;
	};
	channels?: string[];
	hopRate?: number;
}

export interface DeviceFilter {
	ssid?: string;
	manufacturer?: string;
	minSignal?: number;
	maxSignal?: number;
	encryption?: string;
	channel?: number;
	lastSeenMinutes?: number;
}

export interface ChannelStat {
	channel: number;
	frequency: number;
	devices: number;
	packets: number;
	utilization: number;
}

export interface InterfaceInfo {
	name: string;
	type: string;
	hardware: string;
	active: boolean;
	monitoring: boolean;
}
