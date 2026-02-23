/**
 * Shared types for Kismet service layer.
 * Extracted to break the circular dependency between kismet.service.ts and kismet-service-transform.ts.
 */

/**
 * Represents a wireless device detected by Kismet
 */
export interface KismetDevice {
	mac: string;
	last_seen: number;
	signal: {
		last_signal: number;
		max_signal: number;
		min_signal: number;
	};
	manufacturer: string;
	type: string;
	channel: number;
	frequency: number;
	packets: number;
	datasize: number;
	ssid?: string;
	encryption?: string[];
	location: {
		lat: number;
		lon: number;
	};
}

/**
 * GPS coordinates for device location
 */
export interface GPSPosition {
	latitude: number;
	longitude: number;
}

/**
 * Response from the Kismet device service
 */
export interface DevicesResponse {
	devices: KismetDevice[];
	error: string | null;
	source: 'kismet' | 'fallback';
}
