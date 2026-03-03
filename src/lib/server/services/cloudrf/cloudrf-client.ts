/**
 * CloudRF Cloud API client — server-side only.
 *
 * Handles coverage area computation, point-to-point path loss,
 * and status checks against the CloudRF cloud API.
 *
 * @module
 */

import { env } from '$lib/server/env';
import type {
	CoverageLegendEntry,
	CoverageRequest,
	CoverageResult,
	P2PRequest,
	P2PResult,
	PropagationBounds
} from '$lib/types/rf-propagation';
import { logger } from '$lib/utils/logger';

const CLOUDRF_BASE = 'https://api.cloudrf.com';

const TIMEOUT_AREA_MS = 60_000;
const TIMEOUT_PATH_MS = 30_000;
const TIMEOUT_STATUS_MS = 10_000;

// ── Error class ────────────────────────────────────────────────────

export class CloudRFError extends Error {
	constructor(
		message: string,
		public readonly statusCode: number
	) {
		super(message);
		this.name = 'CloudRFError';
	}
}

// ── Internal helpers ───────────────────────────────────────────────

function getApiKey(): string {
	const key = env.CLOUDRF_API_KEY;
	if (!key) {
		throw new CloudRFError('CloudRF API key not configured. Set CLOUDRF_API_KEY in .env', 503);
	}
	return key;
}

/** Build CloudRF /area request body from Argos coverage params */
function buildAreaBody(params: CoverageRequest): Record<string, unknown> {
	return {
		site: params.site ?? 'Argos',
		network: params.network ?? 'Argos',
		engine: '2',
		transmitter: {
			lat: params.lat,
			lon: params.lon,
			alt: String(params.txHeight),
			frq: String(params.frequency),
			txw: '5',
			bwi: '0.1'
		},
		receiver: {
			lat: 0,
			lon: 0,
			alt: String(params.rxHeight),
			rxg: '2.15',
			rxs: '-90'
		},
		antenna: {
			txg: '2.15',
			txl: '0',
			ant: '1',
			azi: '0',
			tlt: '0',
			hbw: '360',
			vbw: '90',
			fbr: '0',
			pol: params.polarization === 0 ? 'h' : 'v'
		},
		model: {
			pm: '11',
			pe: '2',
			ked: '1',
			rel: '95'
		},
		environment: {
			elevation: '2',
			landcover: '1',
			buildings: '1',
			clt: 'Minimal.clt'
		},
		output: {
			units: 'm',
			col: params.colormap,
			out: '2',
			nf: '-114',
			res: String(params.resolution),
			rad: String(params.radius)
		}
	};
}

/** Download a PNG from a URL and return it as a base64 data URI */
async function downloadPng(url: string): Promise<string> {
	const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_AREA_MS) });
	if (!res.ok) {
		throw new CloudRFError(`Failed to download PNG: HTTP ${res.status}`, res.status);
	}
	const buffer = Buffer.from(await res.arrayBuffer());
	return `data:image/png;base64,${buffer.toString('base64')}`;
}

/** Parse CloudRF bounds array [north, east, south, west] → PropagationBounds */
function parseBounds(arr: number[]): PropagationBounds {
	return { north: arr[0], south: arr[2], east: arr[1], west: arr[3] };
}

/** Map HTTP status codes to user-friendly error messages */
function handleApiError(status: number, body: string): never {
	if (status === 401) {
		throw new CloudRFError('Invalid CloudRF API key', 401);
	}
	if (status === 429) {
		throw new CloudRFError('CloudRF rate limit exceeded — try again shortly', 429);
	}
	if (status >= 500) {
		throw new CloudRFError(`CloudRF server error (${status})`, status);
	}
	throw new CloudRFError(`CloudRF request failed: ${status} — ${body.slice(0, 200)}`, status);
}

/** POST to a CloudRF endpoint and return parsed JSON; throws on non-ok response */
async function cloudRFPost(
	endpoint: string,
	key: string,
	body: Record<string, unknown>,
	timeoutMs: number
): Promise<Record<string, unknown>> {
	const res = await fetch(`${CLOUDRF_BASE}/${endpoint}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', key },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		handleApiError(res.status, text);
	}
	return res.json() as Promise<Record<string, unknown>>;
}

/** Build CloudRF /path request body from Argos P2P params */
function buildPathBody(params: P2PRequest): Record<string, unknown> {
	return {
		site: params.site ?? 'Argos',
		network: params.network ?? 'Argos',
		engine: '2',
		transmitter: {
			lat: params.txLat,
			lon: params.txLon,
			alt: String(params.txHeight),
			frq: String(params.frequency),
			txw: '5',
			bwi: '0.1'
		},
		receiver: {
			lat: params.rxLat,
			lon: params.rxLon,
			alt: String(params.rxHeight),
			rxg: '2.15',
			rxs: '-90'
		},
		antenna: {
			txg: '2.15',
			txl: '0',
			ant: '1',
			azi: '0',
			tlt: '0',
			hbw: '360',
			vbw: '90',
			fbr: '0',
			pol: params.polarization === 0 ? 'h' : 'v'
		},
		model: { pm: '11', pe: '2', ked: '1', rel: '95' },
		environment: { elevation: '2', landcover: '1', buildings: '1', clt: 'Minimal.clt' }
	};
}

/** Parse a raw /area response into a CoverageResult */
async function parseAreaResponse(
	data: Record<string, unknown>,
	elapsed: number
): Promise<CoverageResult> {
	const imageDataUri = await downloadPng(data.PNG_WGS84 as string);
	const bounds = parseBounds(data.bounds as number[]);
	return {
		imageDataUri,
		bounds,
		meta: {
			elapsed,
			area: (data.area as number) ?? 0,
			coverage: (data.coverage as number) ?? 0,
			calculationId: (data.sid as number) ?? 0
		},
		legend: (data.key as CoverageLegendEntry[]) ?? []
	};
}

/** Return a numeric field from a data record, defaulting to 0 if absent */
function num(data: Record<string, unknown>, key: string): number {
	return (data[key] as number | undefined) ?? 0;
}

/** Return an array field from a data record, defaulting to [] if absent */
function arr(data: Record<string, unknown>, key: string): number[] {
	return (data[key] as number[] | undefined) ?? [];
}

/**
 * Extract the first Transmitter record from a /path response.
 * Returns null if the response structure is not as expected.
 */
function extractTransmitter(data: Record<string, unknown>): Record<string, unknown> | null {
	const transmitters = data['Transmitters'];
	if (!Array.isArray(transmitters) || transmitters.length === 0) {
		return null;
	}
	const first: unknown = transmitters[0];
	if (typeof first !== 'object' || first === null) {
		return null;
	}
	return first as Record<string, unknown>;
}

/** Parse a raw /path response into a P2PResult */
function parsePathResponse(data: Record<string, unknown>): P2PResult {
	const tx = extractTransmitter(data);
	if (!tx) {
		logger.warn('CloudRF /path: missing or empty Transmitters array in response');
		return {
			lossAtRx: 0,
			distanceM: 0,
			bearingDeg: 0,
			elevationProfile: [],
			lossProfile: [],
			distances: [],
			error: 1
		};
	}
	return {
		lossAtRx: num(tx, 'Computed path loss dB'),
		distanceM: num(tx, 'Distance to receiver km') * 1000,
		bearingDeg: num(tx, 'Azimuth to receiver deg'),
		elevationProfile: arr(tx, 'Terrain_AMSL'),
		lossProfile: arr(tx, 'dB'),
		distances: arr(tx, 'Distance'),
		error: 0
	};
}

// ── Public API ─────────────────────────────────────────────────────

/** Compute area coverage and return a PNG overlay with bounds */
export async function computeArea(params: CoverageRequest): Promise<CoverageResult> {
	const key = getApiKey();
	const start = Date.now();
	logger.info(
		`CloudRF /area: ${params.frequency}MHz, ${params.radius}km @ ${params.resolution}m`
	);
	const data = await cloudRFPost('area', key, buildAreaBody(params), TIMEOUT_AREA_MS);
	const elapsed = Date.now() - start;
	logger.info(`CloudRF /area complete in ${elapsed}ms`);
	return parseAreaResponse(data, elapsed);
}

/** Compute point-to-point path loss between TX and RX */
export async function computePath(params: P2PRequest): Promise<P2PResult> {
	const key = getApiKey();
	const start = Date.now();
	logger.info(
		`CloudRF /path: ${params.frequency}MHz, TX(${params.txLat},${params.txLon}) → RX(${params.rxLat},${params.rxLon})`
	);
	const data = await cloudRFPost('path', key, buildPathBody(params), TIMEOUT_PATH_MS);
	const elapsed = Date.now() - start;
	logger.info(`CloudRF /path complete in ${elapsed}ms`);
	return parsePathResponse(data);
}

/** Lightweight status check — verifies API key works */
export async function getStatus(): Promise<{ available: boolean; engine: 'cloudrf' }> {
	const key = env.CLOUDRF_API_KEY;
	if (!key) {
		return { available: false, engine: 'cloudrf' };
	}

	try {
		const res = await fetch(`${CLOUDRF_BASE}/area`, {
			method: 'OPTIONS',
			headers: { key },
			signal: AbortSignal.timeout(TIMEOUT_STATUS_MS)
		});
		return { available: res.ok || res.status === 405, engine: 'cloudrf' };
	} catch {
		return { available: false, engine: 'cloudrf' };
	}
}
