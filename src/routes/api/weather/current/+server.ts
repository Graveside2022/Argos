import type { RequestHandler } from './$types';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Build a JSON error response. */
function jsonError(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}

/** Build Open-Meteo query params for the given coordinates. */
function buildWeatherParams(lat: string, lon: string): URLSearchParams {
	return new URLSearchParams({
		latitude: lat,
		longitude: lon,
		current: [
			'temperature_2m',
			'relative_humidity_2m',
			'apparent_temperature',
			'wind_speed_10m',
			'wind_gusts_10m',
			'precipitation',
			'pressure_msl',
			'weather_code',
			'is_day'
		].join(','),
		temperature_unit: 'celsius',
		wind_speed_unit: 'kmh'
	});
}

/** Fetch weather data from Open-Meteo API. */
async function fetchWeather(lat: string, lon: string): Promise<Response> {
	const response = await fetch(
		`https://api.open-meteo.com/v1/forecast?${buildWeatherParams(lat, lon)}`
	);
	if (!response.ok) return jsonError(`Open-Meteo returned ${response.status}`, 502);
	const data = await response.json();
	return new Response(JSON.stringify(data.current), {
		headers: { ...JSON_HEADERS, 'Cache-Control': 'max-age=300' }
	});
}

export const GET: RequestHandler = async ({ url }) => {
	const lat = url.searchParams.get('lat');
	const lon = url.searchParams.get('lon');
	if (!lat || !lon) return jsonError('Missing lat/lon parameters', 400);

	try {
		return await fetchWeather(lat, lon);
	} catch (error: unknown) {
		return jsonError(error instanceof Error ? error.message : 'Unknown error', 502);
	}
};
