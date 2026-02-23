// MGRS (Military Grid Reference System) converter
// Converts lat/lon to 10-digit MGRS format (10m precision)

// Using the battle-tested mgrs npm package for reliable conversion
import * as mgrs from 'mgrs';

import { logError } from '$lib/utils/logger';

// Note: Helper interfaces and constants removed as we're now using the mgrs npm package

/**
 * Convert latitude/longitude to 10-digit MGRS
 * Format: 31U FT 12345 56789 (10m precision)
 */
export function latLonToMGRS(lat: number, lon: number): string {
	try {
		// Use the mgrs package for reliable conversion
		// The package expects [longitude, latitude] order
		// Precision 5 = 10 digits total (5 for easting, 5 for northing) = 1 meter
		const mgrsString = mgrs.forward([lon, lat], 5);

		// The package returns format like "32UMA5188543428" without spaces
		// We need to format it as "32U MA 51885 43428"
		return formatMGRS(mgrsString);
	} catch (error) {
		logError('Error converting to MGRS', { error });
		return 'Invalid';
	}
}

// Old helper functions removed - now using mgrs npm package for conversion

/**
 * Format MGRS for display with proper spacing
 * Converts "32UMA5188543428" to "32U MA 51885 43428"
 */
export function formatMGRS(mgrsString: string): string {
	// Remove any existing spaces first
	const clean = mgrsString.replace(/\s+/g, '');

	// Match the MGRS format: zone(1-2 digits) + band(1 letter) + square(2 letters) + easting(5 digits) + northing(5 digits)
	const match = clean.match(/^(\d{1,2})([A-Z])([A-Z]{2})(\d{5})(\d{5})$/);

	if (match) {
		const [, zone, band, square, easting, northing] = match;
		return `${zone}${band} ${square} ${easting} ${northing}`;
	}

	// If format doesn't match, return as-is
	return mgrsString;
}
