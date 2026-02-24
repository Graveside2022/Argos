import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import path from 'path';

import { createHandler } from '$lib/server/api/create-handler';
import { env } from '$lib/server/env';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

interface TowerLocationData {
	lat: number;
	lon: number;
	range: number;
	city?: string;
	samples?: number;
	created?: number;
	updated?: number;
}

interface CellParams {
	mcc: number;
	mnc: number;
	lac: number;
	ci: number;
}

interface LocationResult {
	found: boolean;
	location?: {
		lat: number;
		lon: number;
		range: number;
		samples?: number;
		city?: string;
		lastUpdated?: number;
		source: string;
	};
	message?: string;
}

// Sample tower data for demo (when real DB is not available)
const sampleTowers: Record<string, TowerLocationData> = {
	'310-410-12345-6789': { lat: 37.7749, lon: -122.4194, range: 1000, city: 'San Francisco, CA' },
	'310-410-12345-6790': { lat: 37.7849, lon: -122.4094, range: 1000, city: 'San Francisco, CA' },
	'262-01-23456-7890': { lat: 52.52, lon: 13.405, range: 1500, city: 'Berlin, Germany' },
	'262-01-23456-7891': { lat: 52.51, lon: 13.415, range: 1500, city: 'Berlin, Germany' },
	'432-11-34567-8901': { lat: 35.6892, lon: 51.389, range: 2000, city: 'Tehran, Iran' },
	'432-11-34567-8902': { lat: 35.6792, lon: 51.399, range: 2000, city: 'Tehran, Iran' },
	'234-10-45678-9012': { lat: 51.5074, lon: -0.1276, range: 1200, city: 'London, UK' },
	'260-01-56789-1234': { lat: 52.2297, lon: 21.0122, range: 1800, city: 'Warsaw, Poland' },
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

function validateCellParams(body: Record<string, unknown>): CellParams {
	return {
		mcc: validateNumericParam(body.mcc, 'mcc', 0, 999),
		mnc: validateNumericParam(body.mnc, 'mnc', 0, 999),
		lac: validateNumericParam(body.lac, 'lac', 0, 65535),
		ci: validateNumericParam(body.ci, 'ci', 0, 268435455)
	};
}

function lookupInDatabase(params: CellParams): TowerLocationData | null {
	const dbPath = path.join(process.cwd(), 'data', 'celltowers', 'towers.db');
	try {
		const db = new Database(dbPath, { readonly: true });
		const stmt = db.prepare(`
        SELECT lat, lon, range, created, updated, samples
        FROM towers
        WHERE mcc = ? AND net = ? AND area = ? AND cell = ?
      `);
		const result = stmt.get(params.mcc, params.mnc, params.lac, params.ci) as
			| TowerLocationData
			| undefined;
		db.close();
		return result ?? null;
	} catch (_dbError) {
		logger.warn('Tower database not available, will try API');
		return null;
	}
}

function formatDbResult(dbResult: TowerLocationData): LocationResult {
	return {
		found: true,
		location: {
			lat: dbResult.lat,
			lon: dbResult.lon,
			range: dbResult.range || 1000,
			samples: dbResult.samples || 1,
			lastUpdated: dbResult.updated,
			source: 'database'
		}
	};
}

function validateApiData(apiData: Record<string, string>): boolean {
	if (apiData.error) {
		logger.warn('OpenCellID API error', { apiError: apiData.error });
		return false;
	}
	if (!apiData.lat || !apiData.lon) {
		logger.warn('OpenCellID API returned incomplete data', { apiData });
		return false;
	}
	return true;
}

function buildApiLocationResult(apiData: Record<string, string>): LocationResult {
	logger.info('Found in OpenCellID API', { lat: apiData.lat, lon: apiData.lon });
	return {
		found: true,
		location: {
			lat: parseFloat(apiData.lat),
			lon: parseFloat(apiData.lon),
			range: parseInt(apiData.range) || 1000,
			samples: parseInt(apiData.samples) || 1,
			source: 'opencellid-api'
		}
	};
}

function parseApiResponse(apiData: Record<string, string>): LocationResult | null {
	if (!validateApiData(apiData)) return null;
	return buildApiLocationResult(apiData);
}

async function lookupViaApi(params: CellParams): Promise<LocationResult | null> {
	const apiKey = env.OPENCELLID_API_KEY;
	if (!apiKey) return null;

	const { mcc, mnc, lac, ci } = params;
	const apiUrl = `https://opencellid.org/cell/get?key=${apiKey}&mcc=${mcc}&mnc=${mnc}&lac=${lac}&cellid=${ci}&format=json`;

	try {
		logger.info('Querying OpenCellID API', { mcc, mnc, lac, ci });
		const apiResponse = await fetch(apiUrl);
		if (!apiResponse.ok) {
			logger.warn('OpenCellID API returned error', {
				status: apiResponse.status,
				statusText: apiResponse.statusText
			});
			return null;
		}
		const apiData = await apiResponse.json();
		return parseApiResponse(apiData);
	} catch (apiError) {
		logger.error('OpenCellID API error', {
			error: apiError instanceof Error ? apiError.message : String(apiError)
		});
		return null;
	}
}

function lookupInSampleData(params: CellParams): LocationResult | null {
	const key = `${params.mcc}-${String(params.mnc).padStart(2, '0')}-${params.lac}-${params.ci}`;
	const sampleData = sampleTowers[key];
	if (!sampleData) return null;
	return {
		found: true,
		location: {
			lat: sampleData.lat,
			lon: sampleData.lon,
			range: sampleData.range,
			city: sampleData.city,
			source: 'sample'
		}
	};
}

async function resolveTowerLocation(params: CellParams): Promise<LocationResult> {
	const dbResult = lookupInDatabase(params);
	if (dbResult) return formatDbResult(dbResult);

	if (!env.OPENCELLID_API_KEY) {
		return { found: false, message: 'OPENCELLID_API_KEY not configured' };
	}

	const apiResult = await lookupViaApi(params);
	if (apiResult) return apiResult;

	const sampleResult = lookupInSampleData(params);
	if (sampleResult) return sampleResult;

	return { found: false, message: 'Tower not found in database or API' };
}

export const POST = createHandler(async ({ request }) => {
	const body = await request.json();

	let params: CellParams;
	try {
		params = validateCellParams(body);
	} catch (validationError) {
		return json(
			{
				success: false,
				message: `Invalid parameter: ${(validationError as Error).message}`
			},
			{ status: 400 }
		);
	}

	const result = await resolveTowerLocation(params);

	if (!result.found && result.message === 'OPENCELLID_API_KEY not configured') {
		return json({ success: false, message: result.message }, { status: 503 });
	}

	return { success: true, ...result };
});
