import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

/**
 * Reverse geocoding proxy endpoint
 * Proxies requests to OpenStreetMap Nominatim to avoid CORS issues
 */
export const GET: RequestHandler = async ({ url }) => {
	const lat = url.searchParams.get('lat');
	const lon = url.searchParams.get('lon');

	if (!lat || !lon) {
		throw error(400, 'Missing required parameters: lat and lon');
	}

	// Validate coordinates
	const latitude = parseFloat(lat);
	const longitude = parseFloat(lon);

	if (isNaN(latitude) || isNaN(longitude)) {
		throw error(400, 'Invalid coordinates');
	}

	if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
		throw error(400, 'Coordinates out of valid range');
	}

	try {
		// Fetch from Nominatim (server-side, no CORS issues)
		const response = await fetch(
			`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
			{
				headers: {
					'User-Agent': 'Argos-SDR-Console/1.0',
					Accept: 'application/json'
				}
			}
		);

		if (!response.ok) {
			throw error(response.status, 'Failed to fetch location data from Nominatim');
		}

		const data = await response.json();

		// Extract location name
		const city = data.address?.city || data.address?.town || data.address?.village || '';
		const country = data.address?.country_code?.toUpperCase() || '';
		const locationName = city && country ? `${city}, ${country}` : city || country || '';

		return new Response(
			JSON.stringify({
				success: true,
				locationName,
				city,
				country,
				fullAddress: data.display_name || '',
				raw: data.address
			}),
			{
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
				}
			}
		);
	} catch (err) {
		console.error('Reverse geocoding error:', err);
		throw error(500, 'Failed to fetch location data');
	}
};
