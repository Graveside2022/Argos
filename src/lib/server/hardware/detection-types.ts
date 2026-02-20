/**
 * Hardware Auto-Detection System Types
 * Comprehensive hardware detection and capability tracking
 */

/**
 * Hardware categories
 */
export type HardwareCategory =
	| 'sdr' // Software Defined Radio
	| 'wifi' // WiFi adapter
	| 'bluetooth' // Bluetooth adapter
	| 'gps' // GPS module
	| 'cellular' // Cellular modem
	| 'serial' // Generic serial device
	| 'network' // Network device
	| 'audio' // Audio device
	| 'unknown';

/**
 * Hardware connection type
 */
export type ConnectionType = 'usb' | 'network' | 'serial' | 'pci' | 'internal' | 'virtual';

/**
 * Hardware status
 */
export type HardwareStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

/**
 * SDR Capabilities
 */
export interface SDRCapabilities {
	minFrequency: number; // Hz
	maxFrequency: number; // Hz
	sampleRate: number; // Samples per second
	bandwidth?: number; // Hz
	canTransmit: boolean;
	canReceive: boolean;
	fullDuplex?: boolean; // Simultaneous TX/RX
}

/**
 * WiFi Capabilities
 */
export interface WiFiCapabilities {
	interface: string; // e.g., wlan0
	hasMonitorMode: boolean;
	canInject: boolean;
	frequencyBands: string[]; // ['2.4GHz', '5GHz']
	channels: number[];
	maxTxPower?: number; // dBm
}

/**
 * Bluetooth Capabilities
 */
export interface BluetoothCapabilities {
	interface: string; // e.g., hci0
	hasBleSupport: boolean;
	hasClassicSupport: boolean;
	version?: string; // Bluetooth version
	manufacturer?: string;
}

/**
 * GPS Capabilities
 */
export interface GPSCapabilities {
	device: string; // e.g., /dev/ttyUSB0
	protocol?: string; // NMEA, UBX, etc.
	baudRate?: number;
	updateRate?: number; // Hz
}

/**
 * Cellular Capabilities
 */
export interface CellularCapabilities {
	interface: string;
	supportedBands: string[]; // ['GSM', 'LTE', '5G']
	imei?: string;
	simStatus?: string;
}

/**
 * Hardware capabilities (union type)
 */
export type HardwareCapabilities =
	| SDRCapabilities
	| WiFiCapabilities
	| BluetoothCapabilities
	| GPSCapabilities
	| CellularCapabilities
	| Record<string, unknown>;

/**
 * Detected hardware information
 */
export interface DetectedHardware {
	id: string; // Unique identifier
	name: string; // Display name
	category: HardwareCategory;
	connectionType: ConnectionType;
	status: HardwareStatus;
	capabilities: HardwareCapabilities;

	// USB-specific fields
	vendorId?: string;
	productId?: string;
	serial?: string;
	busNumber?: number;
	deviceNumber?: number;

	// Network-specific fields
	ipAddress?: string;
	port?: number;
	hostname?: string;

	// Serial-specific fields
	device?: string; // /dev/ttyUSB0
	baudRate?: number;

	// Metadata
	manufacturer?: string;
	model?: string;
	driver?: string;
	firmwareVersion?: string;
	lastSeen?: number; // Timestamp
	firstSeen?: number; // Timestamp

	// Tool compatibility
	compatibleTools?: string[]; // Tool IDs that can use this hardware
}

/**
 * Hardware scan result
 */
export interface HardwareScanResult {
	detected: DetectedHardware[];
	stats: {
		total: number;
		connected: number;
		byCategory: Record<HardwareCategory, number>;
		byConnectionType: Record<ConnectionType, number>;
	};
	timestamp: number;
}

/**
 * Hardware query options
 */
export interface HardwareQueryOptions {
	category?: HardwareCategory;
	connectionType?: ConnectionType;
	status?: HardwareStatus;
	search?: string;
	compatibleWithTool?: string; // Tool ID
}

/**
 * Hardware requirement (for tools)
 */
export interface HardwareRequirement {
	category: HardwareCategory;
	isRequired: boolean;
	capabilities?: Partial<HardwareCapabilities>;
	message?: string; // Error message if not available
}
