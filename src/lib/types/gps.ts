/**
 * Canonical GPS type definitions.
 * Used by tactical-map pages and GPS services.
 */

export interface GPSPositionData {
	latitude: number;
	longitude: number;
	altitude?: number | null;
	speed?: number | null;
	heading?: number | null;
	accuracy?: number;
	satellites?: number;
	fix?: number;
	time?: string;
}

export interface GPSApiResponse {
	success: boolean;
	data?: GPSPositionData;
	error?: string;
	mode?: number;
	details?: string;
}

/**
 * Individual satellite data from gpsd SKY message.
 */
export interface Satellite {
	prn: number;
	constellation: 'GPS' | 'GLONASS' | 'Galileo' | 'BeiDou';
	snr: number;
	elevation: number;
	azimuth: number;
	used: boolean;
}

/**
 * API response for /api/gps/satellites endpoint.
 */
export interface SatellitesApiResponse {
	success: boolean;
	satellites: Satellite[];
	error?: string;
}
