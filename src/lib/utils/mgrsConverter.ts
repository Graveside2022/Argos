// MGRS (Military Grid Reference System) converter
// Converts lat/lon to 10-digit MGRS format (10m precision)

// Manual MGRS conversion implementation since package install is having issues
// This provides the core functionality needed for the tactical map

import { logError } from '$lib/utils/logger';

const _MGRS_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Note: I and O are omitted

interface _MGRSComponents {
	zone: number;
	band: string;
	square1: string;
	square2: string;
	easting: string;
	northing: string;
}

/**
 * Convert latitude/longitude to 10-digit MGRS
 * Format: 31U FT 12345 56789 (10m precision)
 */
export function latLonToMGRS(lat: number, lon: number): string {
	try {
		// Get UTM zone
		const zone = Math.floor((lon + 180) / 6) + 1;

		// Get latitude band
		const band = getLatitudeBand(lat);

		// Convert to UTM coordinates
		const utm = latLonToUTM(lat, lon, zone);

		// Get 100km square identifier
		const squares = get100kmSquare(zone, utm.easting, utm.northing, lat);

		// Format easting and northing to 5 digits each (10m precision)
		const eastingStr = Math.floor((utm.easting % 100000) / 10)
			.toString()
			.padStart(5, '0');
		const northingStr = Math.floor((utm.northing % 100000) / 10)
			.toString()
			.padStart(5, '0');

		// Format: 31U FT 12345 56789
		return `${zone}${band} ${squares} ${eastingStr} ${northingStr}`;
	} catch (error) {
		logError('Error converting to MGRS', { error });
		return 'Invalid';
	}
}

/**
 * Get latitude band letter
 */
function getLatitudeBand(lat: number): string {
	// MGRS latitude bands from C to X (excluding I and O)
	const bands = 'CDEFGHJKLMNPQRSTUVWX';

	if (lat < -80) return 'Invalid';
	if (lat >= 84) return 'Invalid';

	// Special case for Norway
	if (lat >= 72 && lat < 84) return 'X';

	// Calculate band index
	const index = Math.floor((lat + 80) / 8);
	return bands[index] || 'Invalid';
}

/**
 * Convert lat/lon to UTM coordinates
 */
function latLonToUTM(
	lat: number,
	lon: number,
	zone: number
): { easting: number; northing: number } {
	const a = 6378137.0; // WGS84 major axis
	const f = 1 / 298.257223563; // WGS84 flattening
	const k0 = 0.9996; // UTM scale factor

	const latRad = (lat * Math.PI) / 180;
	const lonRad = (lon * Math.PI) / 180;

	// Calculate meridian
	const lonOrigin = (zone - 1) * 6 - 180 + 3;
	const lonOriginRad = (lonOrigin * Math.PI) / 180;

	const e = Math.sqrt(2 * f - f * f);
	const e2 = e * e;
	const e4 = e2 * e2;
	const e6 = e4 * e2;

	const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
	const T = Math.tan(latRad) * Math.tan(latRad);
	const C = (e2 * Math.cos(latRad) * Math.cos(latRad)) / (1 - e2);
	const A = Math.cos(latRad) * (lonRad - lonOriginRad);

	const M =
		a *
		((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * latRad -
			((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * latRad) +
			((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * latRad) -
			((35 * e6) / 3072) * Math.sin(6 * latRad));

	const easting =
		k0 *
			N *
			(A +
				((1 - T + C) * A * A * A) / 6 +
				((5 - 18 * T + T * T + 72 * C - 58 * e2) * A * A * A * A * A) / 120) +
		500000;

	let northing =
		k0 *
		(M +
			N *
				Math.tan(latRad) *
				((A * A) / 2 +
					((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
					((61 - 58 * T + T * T + 600 * C - 330 * e2) * A * A * A * A * A * A) / 720));

	// Adjust for southern hemisphere
	if (lat < 0) {
		northing += 10000000;
	}

	return { easting, northing };
}

/**
 * Get 100km square identifier
 */
function get100kmSquare(zone: number, easting: number, northing: number, lat: number): string {
	// Simplified 100km square calculation
	// This is a basic implementation - full MGRS requires more complex logic

	const set = ((zone - 1) % 6) + 1;
	let eastingIndex = Math.floor(easting / 100000);
	let northingIndex = Math.floor((northing % 2000000) / 100000);

	// Column letters repeat every 3 zones
	const colLetters = 'ABCDEFGHJKLMNPQRSTUV';
	const col = (eastingIndex + (set - 1) * 8 - 1) % 24;

	// Row letters
	const rowLetters = lat >= 0 ? 'ABCDEFGHJKLMNPQRSTUV' : 'VWXYZABCDEFGHJKLMNPQRSTU';
	const row = northingIndex % 20;

	return colLetters[col] + rowLetters[row];
}

/**
 * Format MGRS for display with proper spacing
 */
export function formatMGRS(mgrs: string): string {
	// Ensure proper spacing: 31U FT 12345 56789
	return mgrs.replace(/(\d+[A-Z])\s*([A-Z]{2})\s*(\d{5})\s*(\d{5})/, '$1 $2 $3 $4');
}

/**
 * Get precision description for MGRS
 */
export function getMGRSPrecision(digits: number): string {
	switch (digits) {
		case 0:
			return '100km';
		case 2:
			return '10km';
		case 4:
			return '1km';
		case 6:
			return '100m';
		case 8:
			return '10m';
		case 10:
			return '1m';
		default:
			return 'Unknown';
	}
}
