import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache last known satellite count from full SKY messages (accurate per-satellite data).
// Full SKY messages only arrive every ~4-5s, so between them we serve the cached value.
let cachedSatelliteCount = 0;

interface TPVData {
	class: string;
	mode: number;
	lat?: number;
	lon?: number;
	alt?: number;
	speed?: number;
	track?: number;
	epx?: number;
	epy?: number;
	time?: string;
}

interface SkyMessage {
	class: string;
	satellites?: Array<{
		used?: boolean;
	}>;
	uSat?: number; // Used satellites count (GPSD 3.20+)
	nSat?: number; // Total visible satellites
}

interface SatelliteData {
	used?: boolean;
}

function isSatelliteArray(value: unknown): value is SatelliteData[] {
	return (
		Array.isArray(value) &&
		value.every(
			(item) =>
				typeof item === 'object' &&
				item !== null &&
				(typeof (item as SatelliteData).used === 'boolean' ||
					(item as SatelliteData).used === undefined)
		)
	);
}

function parseTPVData(data: unknown): TPVData | null {
	if (typeof data !== 'object' || data === null) {
		return null;
	}

	const obj = data as Record<string, unknown>;

	if (typeof obj.class !== 'string' || obj.class !== 'TPV') {
		return null;
	}

	return {
		class: obj.class,
		mode: typeof obj.mode === 'number' ? obj.mode : 0,
		lat: typeof obj.lat === 'number' ? obj.lat : undefined,
		lon: typeof obj.lon === 'number' ? obj.lon : undefined,
		alt: typeof obj.alt === 'number' ? obj.alt : undefined,
		speed: typeof obj.speed === 'number' ? obj.speed : undefined,
		track: typeof obj.track === 'number' ? obj.track : undefined,
		epx: typeof obj.epx === 'number' ? obj.epx : undefined,
		epy: typeof obj.epy === 'number' ? obj.epy : undefined,
		time: typeof obj.time === 'string' ? obj.time : undefined
	};
}

function parseSkyMessage(data: unknown): SkyMessage | null {
	if (typeof data !== 'object' || data === null) {
		return null;
	}

	const obj = data as Record<string, unknown>;

	if (typeof obj.class !== 'string' || obj.class !== 'SKY') {
		return null;
	}

	return {
		class: obj.class,
		satellites: isSatelliteArray(obj.satellites) ? obj.satellites : undefined,
		uSat: typeof obj.uSat === 'number' ? obj.uSat : undefined,
		nSat: typeof obj.nSat === 'number' ? obj.nSat : undefined
	};
}

export const GET: RequestHandler = async () => {
	try {
		// Single GPSD connection — capture both TPV and SKY in one query.
		// Use timeout to let nc run for 2s then collect all output (avoids SIGPIPE from head).
		let allLines = '';
		try {
			const result = await execAsync(
				'timeout 2 bash -c \'echo \\\'?WATCH={"enable":true,"json":true}\\\' | nc localhost 2947\' 2>/dev/null || true',
				{ timeout: 5000 }
			);
			allLines = result.stdout;
		} catch {
			// nc failed, try gpspipe as fallback
			try {
				const result = await execAsync('timeout 3 gpspipe -w -n 10 2>/dev/null || true');
				allLines = result.stdout;
			} catch {
				// gpspipe also failed
			}
		}

		// Parse both TPV and SKY from the single output.
		// GPSD sends two SKY formats: compact (uSat only — inflated aggregate) and
		// full (includes satellites array with per-sat used flag — accurate count).
		// Full SKY only arrives every ~4-5s, so we cache the last accurate count.
		let tpvData: TPVData | null = null;
		const lines = allLines.trim().split('\n');

		for (const line of lines) {
			if (line.trim() === '') continue;
			try {
				const parsed = JSON.parse(line) as unknown;

				if (!tpvData) {
					tpvData = parseTPVData(parsed);
				}

				const msg = parseSkyMessage(parsed);
				if (msg && msg.satellites && msg.satellites.length > 0) {
					// Full SKY message — update cache with accurate used-satellite count
					cachedSatelliteCount = msg.satellites.filter((sat) => sat.used === true).length;
				}
			} catch {
				// Skip non-JSON lines
			}
		}

		if (!tpvData) {
			throw new Error('Failed to parse TPV data');
		}

		if (tpvData.class === 'TPV' && tpvData.mode >= 2) {
			// We have a valid fix
			return new Response(
				JSON.stringify({
					success: true,
					data: {
						latitude: tpvData.lat ?? null,
						longitude: tpvData.lon ?? null,
						altitude: tpvData.alt ?? null,
						speed: tpvData.speed ?? null,
						heading: tpvData.track ?? null,
						accuracy: tpvData.epx ?? tpvData.epy ?? 10, // Horizontal error in meters
						satellites: cachedSatelliteCount,
						fix: tpvData.mode, // 0=no fix, 1=no fix, 2=2D fix, 3=3D fix
						time: tpvData.time ?? null
					}
				}),
				{
					headers: { 'Content-Type': 'application/json' }
				}
			);
		} else {
			// No valid fix yet - this is a normal GPS state, not a service error
			return new Response(
				JSON.stringify({
					success: false,
					error: 'No GPS fix available',
					data: {
						latitude: null,
						longitude: null,
						altitude: null,
						speed: null,
						heading: null,
						accuracy: null,
						satellites: cachedSatelliteCount,
						fix: tpvData.mode, // 0=no fix, 1=no fix, 2=2D fix, 3=3D fix
						time: tpvData.time ?? null
					},
					mode: tpvData.mode
				}),
				{
					status: 200, // Changed from 503 - no GPS fix is normal operational state
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}
	} catch (error: unknown) {
		return new Response(
			JSON.stringify({
				success: false,
				error: 'GPS service not available. Make sure gpsd is running.',
				details: error instanceof Error ? error.message : 'Unknown error',
				data: {
					latitude: null,
					longitude: null,
					altitude: null,
					speed: null,
					heading: null,
					accuracy: null,
					satellites: null,
					fix: 0, // No fix available
					time: null
				}
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
