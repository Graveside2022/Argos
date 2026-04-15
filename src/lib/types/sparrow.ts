/**
 * Type definitions for Sparrow-WiFi agent REST API responses.
 * The agent runs on port 8020 and returns JSON from iw/bluetooth scans.
 */

/** WiFi network from /wireless/networks/<interface> */
export interface SparrowNetwork {
	macAddr: string;
	ssid: string;
	security: string;
	privacy: string;
	channel: number;
	frequency: number;
	signal: number;
	lastSeen: string;
	mode: string;
	firstSeen?: string;
	gps?: SparrowGpsPosition;
}

/** Bluetooth device from /bluetooth/scanstatus */
export interface SparrowBluetoothDevice {
	name: string;
	address: string;
	rssi: number;
	btType: string;
	company: string;
	lastSeen: string;
}

/** GPS position from /gps/status */
export interface SparrowGpsPosition {
	latitude: number;
	longitude: number;
	altitude: number;
	speed: number;
}

/** Sparrow agent control result */
export interface SparrowControlResult {
	success: boolean;
	message: string;
	details?: string;
	error?: string;
}

/** Sparrow agent status */
export interface SparrowStatusResult {
	success: boolean;
	isRunning: boolean;
	status: 'active' | 'inactive';
	port: number;
}
