import { error } from '@sveltejs/kit';

import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/** Parse and validate coordinate params, throwing on invalid input. */
function parseCoordinates(url: URL): { latitude: number; longitude: number } {
	const lat = url.searchParams.get('lat');
	const lon = url.searchParams.get('lon');
	if (!lat || !lon) throw error(400, 'Missing required parameters: lat and lon');

	const latitude = parseFloat(lat);
	const longitude = parseFloat(lon);
	if (isNaN(latitude) || isNaN(longitude)) throw error(400, 'Invalid coordinates');

	validateCoordinateRange(latitude, longitude);
	return { latitude, longitude };
}

/** Throw if coordinates are outside valid geographic range. */
function validateCoordinateRange(lat: number, lon: number): void {
	const outOfRange = lat < -90 || lat > 90 || lon < -180 || lon > 180;
	if (outOfRange) throw error(400, 'Coordinates out of valid range');
}

/** City field priority for Nominatim address. */
const CITY_FIELDS = ['city', 'town', 'village'] as const;

/** Extract city name from Nominatim address object. */
function extractCity(address: Record<string, string>): string {
	for (const field of CITY_FIELDS) {
		if (address?.[field]) return address[field];
	}
	return '';
}

/** Build location name string from city and country. */
function buildLocationName(city: string, country: string): string {
	if (city && country) return `${city}, ${country}`;
	return city || country || '';
}

/** Extract country code from Nominatim address. */
function extractCountry(address: Record<string, string>): string {
	return address?.country_code?.toUpperCase() || '';
}

/** Build geocoding response body from Nominatim data. */
function buildGeoResponse(data: Record<string, unknown>): Record<string, unknown> {
	const address = data.address as Record<string, string>;
	const city = extractCity(address);
	const country = extractCountry(address);
	return {
		success: true,
		locationName: buildLocationName(city, country),
		city,
		country,
		fullAddress: (data.display_name as string) || '',
		raw: address
	};
}

/** Fetch reverse geocoding from Nominatim. */
async function fetchNominatim(lat: number, lon: number): Promise<Record<string, unknown>> {
	const response = await fetch(
		`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
		{ headers: { 'User-Agent': 'Argos-SDR-Console/1.0', Accept: 'application/json' } }
	);
	if (!response.ok) {
		throw error(response.status, 'Failed to fetch location data from Nominatim');
	}
	return response.json();
}

const GEO_HEADERS = {
	'Content-Type': 'application/json',
	'Cache-Control': 'public, max-age=3600'
};

/**
 * Reverse geocoding proxy endpoint
 * Proxies requests to OpenStreetMap Nominatim to avoid CORS issues
 */
export const GET: RequestHandler = async ({ url }) => {
	const { latitude, longitude } = parseCoordinates(url);

	try {
		const data = await fetchNominatim(latitude, longitude);
		return new Response(JSON.stringify(buildGeoResponse(data)), { headers: GEO_HEADERS });
	} catch (err) {
		logger.error('Reverse geocoding error', {
			error: err instanceof Error ? err.message : String(err)
		});
		throw error(500, 'Failed to fetch location data');
	}
};
