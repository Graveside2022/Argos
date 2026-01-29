import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
		satellites: isSatelliteArray(obj.satellites) ? obj.satellites : undefined
	};
}

export const GET: RequestHandler = async ({ url }) => {
	// Check if mock parameter is explicitly requested
	const useMock = url.searchParams.get('mock') === 'true';

	if (useMock) {
		// Return mock GPS data only when explicitly requested
		return new Response(
			JSON.stringify({
				success: true,
				data: {
					latitude: 50.0833, // Mainz Kastel, Germany coordinates for demo
					longitude: 8.2833,
					altitude: 10.0,
					speed: 0.0,
					heading: 0.0,
					accuracy: 5.0,
					satellites: 8,
					fix: 3, // 3D fix
					time: new Date().toISOString()
				}
			}),
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	try {
		// Query gpsd via its JSON protocol on the default port (2947).
		// This returns in ~0.4s instead of the 10+ seconds the old cascading
		// timeout chain took when ports 2950/2948 didn't exist.
		let stdout = '';
		try {
			const result = await execAsync(
				'echo \'?WATCH={"enable":true,"json":true}\' | nc -w 2 localhost 2947 | grep -m 1 TPV',
				{ timeout: 3000 }
			);
			stdout = result.stdout;
		} catch {
			// Default port failed, try gpspipe as fallback
			try {
				const result = await execAsync('timeout 2 gpspipe -w -n 5 | grep -m 1 TPV');
				stdout = result.stdout;
			} catch {
				// gpspipe also failed
			}
		}

		// Parse the JSON output
		let tpvData: TPVData | null = null;
		try {
			const parsed = JSON.parse(stdout.trim()) as unknown;
			tpvData = parseTPVData(parsed);
		} catch {
			// JSON parsing failed
		}

		if (!tpvData) {
			throw new Error('Failed to parse TPV data');
		}

		// Get satellite info — single fast query, same connection approach
		let satelliteCount = 0;
		try {
			const { stdout: allMessages } = await execAsync(
				'echo \'?WATCH={"enable":true,"json":true}\' | nc -w 1 localhost 2947 | head -20',
				{ timeout: 2000 }
			);
			const lines = allMessages.trim().split('\n');

			for (const line of lines) {
				if (line.trim() === '') continue;
				try {
					const parsed = JSON.parse(line) as unknown;
					const msg = parseSkyMessage(parsed);
					if (msg && msg.satellites) {
						satelliteCount = msg.satellites.filter((sat) => sat.used === true).length;
						break;
					}
				} catch {
					// Skip non-JSON lines
				}
			}

			if (satelliteCount === 0 && tpvData.mode === 3) {
				satelliteCount = 4;
			}
		} catch {
			// Satellite data is optional
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
						satellites: satelliteCount,
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
						satellites: satelliteCount,
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
