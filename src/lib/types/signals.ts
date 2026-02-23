// Type definitions for signal data structures used throughout the application
import type { SignalSource } from './enums';

export interface Position {
	lat: number;
	lon: number;
}

export interface SignalMetadata {
	// WiFi specific
	ssid?: string;
	mac?: string;
	channel?: number;
	encryption?: string;
	vendor?: string;

	// RF specific
	modulation?: string;
	bandwidth?: number;
	type?: string;
	protocol?: string;

	// Common
	description?: string;
	[key: string]: string | number | boolean | undefined; // Allow additional properties with specific types
}

export interface SignalMarker {
	id: string;
	lat: number;
	lon: number;
	altitude?: number; // Elevation data from GPS
	position: Position;
	frequency: number;
	power: number;
	timestamp: number;
	source: SignalSource;
	metadata: SignalMetadata;
}

export interface SignalStats {
	count: number;
	avgPower: number;
	minPower: number;
	maxPower: number;
	dominantFreq: number;
	signalTypes: Map<string, number>;
	timeRange: {
		start: number;
		end: number;
	};
}

export interface SignalCluster {
	id: string;
	position: Position;
	signals: SignalMarker[];
	stats: SignalStats;
}
