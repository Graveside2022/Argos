import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import path from 'path';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';

// Sample tower data for demo (when real DB is not available)
const sampleTowers: { [key: string]: any } = {
	'310-410-12345-6789': { lat: 37.7749, lon: -122.4194, range: 1000, city: 'San Francisco, CA' },
	'310-410-12345-6790': { lat: 37.7849, lon: -122.4094, range: 1000, city: 'San Francisco, CA' },
	'262-01-23456-7890': { lat: 52.52, lon: 13.405, range: 1500, city: 'Berlin, Germany' },
	'262-01-23456-7891': { lat: 52.51, lon: 13.415, range: 1500, city: 'Berlin, Germany' },
	'432-11-34567-8901': { lat: 35.6892, lon: 51.389, range: 2000, city: 'Tehran, Iran' },
	'432-11-34567-8902': { lat: 35.6792, lon: 51.399, range: 2000, city: 'Tehran, Iran' },
	'234-10-45678-9012': { lat: 51.5074, lon: -0.1276, range: 1200, city: 'London, UK' },
	'260-01-56789-1234': { lat: 52.2297, lon: 21.0122, range: 1800, city: 'Warsaw, Poland' },
	// Add the actual towers from OpenCellID website
	'262-01-4207-13721': {
		lat: 50.006592,
		lon: 8.288978,
		range: 3636,
		city: 'Mainz-Kastel, Germany'
	},
	'262-01-4207-13720': {
		lat: 50.014965,
		lon: 8.293576,
		range: 4659,
		city: 'Mainz-Kastel, Germany'
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		// Validate all parameters as integers before they reach URL interpolation.
		// MCC: Mobile Country Code (0-999), MNC: Mobile Network Code (0-999),
		// LAC: Location Area Code (0-65535), CI: Cell ID (0-268435455 = 2^28-1)
		let mcc: number, mnc: number, lac: number, ci: number;
		try {
			mcc = validateNumericParam(body.mcc, 'mcc', 0, 999);
			mnc = validateNumericParam(body.mnc, 'mnc', 0, 999);
			lac = validateNumericParam(body.lac, 'lac', 0, 65535);
			ci = validateNumericParam(body.ci, 'ci', 0, 268435455);
		} catch (validationError) {
			return json(
				{
					success: false,
					message: `Invalid parameter: ${(validationError as Error).message}`
				},
				{ status: 400 }
			);
		}

		// Try to use real database first
		const dbPath = path.join(process.cwd(), 'data', 'celltowers', 'towers.db');
		let result = null;

		try {
			const db = new Database(dbPath, { readonly: true });
			const stmt = db.prepare(`
        SELECT lat, lon, range, created, updated, samples
        FROM towers 
        WHERE mcc = ? AND net = ? AND area = ? AND cell = ?
      `);

			result = stmt.get(mcc, mnc, lac, ci);
			db.close();
		} catch (_dbError) {
			console.warn('Database not available, will try API');
		}

		// If no result from DB, try OpenCellID API
		if (!result) {
			const apiKey = process.env.OPENCELLID_API_KEY;
			if (!apiKey) {
				return json(
					{ success: false, message: 'OPENCELLID_API_KEY not configured' },
					{ status: 503 }
				);
			}
			const apiUrl = `https://opencellid.org/cell/get?key=${apiKey}&mcc=${mcc}&mnc=${mnc}&lac=${lac}&cellid=${ci}&format=json`;

			try {
				console.log('Querying OpenCellID API for:', { mcc, mnc, lac, ci });
				const apiResponse = await fetch(apiUrl);

				if (apiResponse.ok) {
					const apiData = await apiResponse.json();

					// Check if API returned an error
					if (apiData.error) {
						console.log('OpenCellID API error:', apiData.error, 'for tower:', {
							mcc,
							mnc,
							lac,
							ci
						});
					} else if (apiData.lat && apiData.lon) {
						console.log('Found in OpenCellID API:', apiData);
						return json({
							success: true,
							found: true,
							location: {
								lat: parseFloat(apiData.lat),
								lon: parseFloat(apiData.lon),
								range: parseInt(apiData.range) || 1000,
								samples: parseInt(apiData.samples) || 1,
								source: 'opencellid-api'
							}
						});
					} else {
						console.log('OpenCellID API returned incomplete data:', apiData);
					}
				} else {
					console.log(
						'OpenCellID API returned:',
						apiResponse.status,
						apiResponse.statusText
					);
				}
			} catch (apiError) {
				console.error('OpenCellID API error:', apiError);
			}

			// Check sample data as last resort
			const key = `${mcc}-${String(mnc).padStart(2, '0')}-${lac}-${ci}`;
			const sampleData = sampleTowers[key];

			if (sampleData) {
				return json({
					success: true,
					found: true,
					location: {
						lat: sampleData.lat,
						lon: sampleData.lon,
						range: sampleData.range,
						city: sampleData.city,
						source: 'sample'
					}
				});
			}

			// Tower not found
			return json({
				success: true,
				found: false,
				message: 'Tower not found in database or API'
			});
		}

		// Return real database result
		return json({
			success: true,
			found: true,
			location: {
				lat: (result as any).lat,
				lon: (result as any).lon,
				range: (result as any).range || 1000,
				samples: (result as any).samples || 1,
				lastUpdated: (result as any).updated,
				source: 'database'
			}
		});
	} catch (error: unknown) {
		console.error('Tower location lookup error:', error);
		return json(
			{
				success: false,
				message: 'Failed to lookup tower location'
			},
			{ status: 500 }
		);
	}
};
