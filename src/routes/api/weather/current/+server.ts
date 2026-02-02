import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const lat = url.searchParams.get('lat');
	const lon = url.searchParams.get('lon');

	if (!lat || !lon) {
		return new Response(JSON.stringify({ error: 'Missing lat/lon parameters' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const params = new URLSearchParams({
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

	try {
		const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
		if (!response.ok) {
			return new Response(
				JSON.stringify({ error: `Open-Meteo returned ${response.status}` }),
				{ status: 502, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const data = await response.json();
		return new Response(JSON.stringify(data.current), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'max-age=300'
			}
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return new Response(JSON.stringify({ error: message }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
