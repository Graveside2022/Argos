// Kismet server types — only types actively imported by kismet modules

/**
 * Kismet configuration
 */
export interface KismetConfig {
	interface: string;
	monitorMode: boolean;
	channels: number[];
	hopRate: number;
	restPort: number;
	restUser: string;
	restPassword: string;
	logLevel: string;
	enableGPS: boolean;
	enableLogging: boolean;
	enableAlerts: boolean;
	deviceTimeout: number;
}

/**
 * Kismet status
 */
export interface KismetStatus {
	running: boolean;
	interface: string | null;
	channels: number[];
	startTime: Date | null;
	uptime: number;
	deviceCount: number;
	monitorInterfaces: MonitorInterface[];
	metrics: Record<string, number | string>;
	config: KismetConfig;
}

/**
 * Monitor interface configuration
 */
export interface MonitorInterface {
	name: string;
	type: string;
	channels: number[];
	enabled: boolean;
}

/**
 * Device statistics
 */
export interface DeviceStats {
	// Compatible with existing usage in kismetProxy.ts
	total: number;
	byType: Record<string, number>;
	byEncryption: Record<string, number>;
	byManufacturer: Record<string, number>;
	activeInLast5Min: number;
	activeInLast15Min: number;
	// Extended properties for comprehensive stats
	totalDevices: number;
	accessPoints: number;
	clients: number;
	unknownDevices: number;
	newDevicesLastHour: number;
	activeDevicesLast5Min: number;
	securityThreats: number;
	rogueAPs: number;
	encryptionTypes: Map<string, number>;
	manufacturers: Map<string, number>;
	channelUsage: Map<number, number>;
	signalStrengthDistribution: Map<string, number>;
	lastUpdate: Date;
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
	type:
		| 'device_discovered'
		| 'device_updated'
		| 'device_lost'
		| 'security_threat'
		| 'correlation_found'
		| 'status_update'
		| 'device_update'
		| 'status_change'
		| 'error'
		| 'tak_status'
		| 'tak_cot';
	data: Record<string, unknown>;
	timestamp: string;
}

/**
 * Kismet service status
 */
export interface KismetServiceStatus {
	running: boolean;
	pid?: number;
	cpu?: number;
	memory?: number;
	uptime?: number;
	error?: string;
	restApiRunning?: boolean;
	webUIRunning?: boolean;
	gpsStatus?: boolean;
	interfaceStatus?: string;
	errors?: string[];
	startTime?: Date;
	version?: string;
	configValid?: boolean;
}

/**
 * Compatible KismetDevice interface
 */
export interface KismetDevice {
	mac: string;
	ssid?: string;
	type: string;
	manufacturer?: string;
	firstSeen: number;
	lastSeen: number;
	signal: {
		last_signal?: number;
		max_signal?: number;
		min_signal?: number;
	};
	signalStrength: number;
	channel: number;
	frequency: number;
	encryptionType?: string[];
	encryption?: string[];
	location?: {
		latitude: number;
		longitude: number;
		accuracy?: number;
	};
	packets: number;
	dataSize: number;
	dataPackets?: number;
	clients?: string[];
	parentAP?: string;
	probeRequests?: string[];
	macaddr: string; // Alias for mac
}

/**
 * Device filter for queries
 */
export interface DeviceFilter {
	type?: string;
	manufacturer?: string;
	encryption?: string;
	ssid?: string;
	minSignal?: number;
	maxSignal?: number;
	seenWithin?: number; // minutes
	signalStrength?: {
		min?: number;
		max?: number;
	};
	lastSeen?: {
		after?: Date;
		before?: Date;
	};
	location?: {
		latitude: number;
		longitude: number;
		radius: number;
	};
}
