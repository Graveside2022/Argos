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
		transmitter: {
			lat: params.lat,
			lon: params.lon,
			alt: params.txHeight,
			frq: params.frequency,
			txw: 5,
			bwi: 0.1
		},
		receiver: {
			lat: 0,
			lon: 0,
			alt: params.rxHeight,
			rxg: 2.15,
			rxs: -90
		},
		antenna: {
			txg: 2.15,
			txl: 0,
			ant: 0,
			azi: 0,
			tlt: 0,
			hbw: 360,
			vbw: 90,
			fbr: 0,
			pol: params.polarization === 0 ? 'h' : 'v'
		},
		model: {
			pm: 11,
			pe: 2,
			cli: 6,
			ked: 0,
			rel: 95,
			ter: 4
		},
		environment: {
			elevation: 2,
			landcover: 0,
			buildings: 0,
			clt: 'Minimal.clt'
		},
		output: {
			units: 'metric',
			col: params.colormap,
			out: 2,
			ber: 2,
			mod: 7,
			nf: -114,
			res: params.resolution,
			rad: params.radius
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
		transmitter: {
			lat: params.txLat,
			lon: params.txLon,
			alt: params.txHeight,
			frq: params.frequency,
			txw: 5,
			bwi: 0.1
		},
		receiver: {
			lat: params.rxLat,
			lon: params.rxLon,
			alt: params.rxHeight,
			rxg: 2.15,
			rxs: -90
		},
		antenna: {
			txg: 2.15,
			txl: 0,
			ant: 0,
			azi: 0,
			tlt: 0,
			hbw: 360,
			vbw: 90,
			fbr: 0,
			pol: params.polarization === 0 ? 'h' : 'v'
		},
		model: { pm: 11, pe: 2, cli: 6, ked: 0, rel: 95, ter: 4 },
		environment: { elevation: 2, landcover: 0, buildings: 0, clt: 'Minimal.clt' }
	};
}

/** Parse a raw /area response into a CoverageResult */
async function parseAreaResponse(
	data: Record<string, unknown>,
	elapsed: number
): Promise<CoverageResult> {
	const imageDataUri = await downloadPng(data.PNG_Mercator as string);
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

/** Parse a raw /path response into a P2PResult */
function parsePathResponse(data: Record<string, unknown>): P2PResult {
	const lossAtRx = num(data, 'Loss_at_receiver_dB') || num(data, 'received_power_dBm');
	return {
		lossAtRx,
		distanceM: num(data, 'distance_km') * 1000,
		bearingDeg: num(data, 'bearing_deg'),
		elevationProfile: arr(data, 'elevation_profile'),
		lossProfile: arr(data, 'path_loss_profile'),
		distances: arr(data, 'distance_profile'),
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
