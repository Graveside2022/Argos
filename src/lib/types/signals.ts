// Type definitions for signal data structures used throughout the application

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
	position: Position;
	frequency: number;
	power: number;
	timestamp: number;
	source: 'kismet' | 'hackrf' | 'rtl-sdr' | 'other';
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

export interface SignalFilter {
	source?: string[];
	frequencyRange?: {
		min: number;
		max: number;
	};
	powerRange?: {
		min: number;
		max: number;
	};
	timeRange?: {
		start: number;
		end: number;
	};
	signalTypes?: string[];
}

export interface SignalData {
	signals: SignalMarker[];
	clusters?: SignalCluster[];
	lastUpdate: number;
	totalCount: number;
}

// Kismet specific types
export interface KismetDevice {
	'kismet.device.base.macaddr': string;
	'kismet.device.base.name': string;
	'kismet.device.base.type': string;
	'kismet.device.base.channel': string;
	'kismet.device.base.frequency': number;
	'kismet.device.base.signal': {
		'kismet.common.signal.last_signal': number;
		'kismet.common.signal.max_signal': number;
		'kismet.common.signal.min_signal': number;
	};
	'kismet.device.base.location': {
		'kismet.common.location.avg_lat': number;
		'kismet.common.location.avg_lon': number;
		'kismet.common.location.last_lat': number;
		'kismet.common.location.last_lon': number;
	};
	'kismet.device.base.crypt': string;
	'kismet.device.base.manuf': string;
	'kismet.device.base.first_time': number;
	'kismet.device.base.last_time': number;
	'kismet.device.base.packets.total': number;
	'kismet.device.base.datasize': number;
}

// HackRF specific types
export interface HackRFData {
	frequency: number;
	timestamp: number;
	power: number;
	bandwidth?: number;
	modulation?: string;
	metadata?: {
		centerFreq?: number;
		sampleRate?: number;
		gain?: number;
		[key: string]: string | number | boolean | undefined;
	};
}

// WebSocket message types
export interface WSMessage {
	type: 'signal' | 'signals' | 'kismet' | 'hackrf' | 'system' | 'gps' | 'error';
	data: unknown;
	timestamp?: number;
	source?: string;
}

export interface SignalMessage extends WSMessage {
	type: 'signal' | 'signals';
	data: SignalMarker | SignalMarker[];
}

export interface KismetMessage extends WSMessage {
	type: 'kismet';
	data: {
		devices?: KismetDevice[];
		status?: unknown;
		error?: string;
	};
}

export interface HackRFMessage extends WSMessage {
	type: 'hackrf';
	data: HackRFData | HackRFData[];
}

// Signal processing types
export interface SignalProcessor {
	process(signal: SignalMarker): SignalMarker;
	validate(signal: SignalMarker): boolean;
}

export interface SignalAggregator {
	add(signal: SignalMarker): void;
	getStats(): SignalStats;
	clear(): void;
}
