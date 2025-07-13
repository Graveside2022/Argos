import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRFDatabase } from '$lib/server/db/database';
import type { SignalMarker } from '$lib/stores/map/signals';
import { SignalSource } from '$lib/types/enums';

function normalizeSignalSource(source: string): SignalSource {
	const sourceMap: Record<string, SignalSource> = {
		'hackrf': SignalSource.HackRF,
		'kismet': SignalSource.Kismet,
		'manual': SignalSource.Manual,
		'rtl-sdr': SignalSource.RtlSdr,
		'other': SignalSource.Other
	};
	return sourceMap[source?.toLowerCase()] || SignalSource.HackRF;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const db = getRFDatabase();
		const body = (await request.json()) as Record<string, unknown>;

		// Handle both direct array and object with signals property
		const signals: SignalMarker[] = Array.isArray(body)
			? (body as SignalMarker[])
			: (body.signals as SignalMarker[]);

		if (!signals || !Array.isArray(signals)) {
			return error(400, 'Invalid signals array');
		}

		// Convert incoming signals to SignalMarker format
		const signalMarkers: SignalMarker[] = signals.map((signal: unknown) => {
			// Generate unique ID if not provided
			const id =
				(signal as { id?: string }).id ||
				`signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			const signalObj = signal as Record<string, unknown>;
			const location = signalObj.location as Record<string, unknown> | undefined;

			// Extract coordinates from either direct properties or location object
			const lat = signalObj.lat ?? location?.lat;
			const lon = signalObj.lon ?? signalObj.lng ?? location?.lng ?? location?.lon;
			const altitude = signalObj.altitude ?? location?.altitude ?? 0;

			// Convert timestamp to milliseconds
			const timestamp =
				typeof signalObj.timestamp === 'string'
					? new Date(signalObj.timestamp).getTime()
					: signalObj.timestamp;

			return {
				id,
				lat: lat as number,
				lon: lon as number,
				altitude: altitude as number,
				frequency: signalObj.frequency as number,
				power: signalObj.power as number,
				timestamp: timestamp as number,
				source: normalizeSignalSource(signalObj.source as string),
				metadata: {
					bandwidth: signalObj.bandwidth as number,
					modulation: signalObj.modulation as string,
					confidence: signalObj.confidence as number,
					noiseFloor: signalObj.noiseFloor as number,
					snr: signalObj.snr as number,
					peakPower: signalObj.peakPower as number,
					averagePower: signalObj.averagePower as number,
					standardDeviation: signalObj.standardDeviation as number,
					skewness: signalObj.skewness as number,
					kurtosis: signalObj.kurtosis as number,
					antennaId: signalObj.antennaId as string,
					scanConfig: signalObj.scanConfig as Record<string, unknown>
				}
			};
		});

		// Validate converted signals
		const validSignals = signalMarkers.filter((signal) => {
			if (
				signal.lat === undefined ||
				signal.lon === undefined ||
				signal.power === undefined ||
				signal.frequency === undefined ||
				!signal.timestamp
			) {
				console.warn('[batch] Invalid signal skipped:', signal);
				return false;
			}
			return true;
		});

		if (validSignals.length === 0) {
			console.warn('[batch] No valid signals to insert');
			return json({
				success: true,
				count: 0,
				message: 'No valid signals to insert'
			});
		}

		// Batch store signals
		const count = db.insertSignalsBatch(validSignals);

		return json({
			success: true,
			count,
			total: signals.length,
			valid: validSignals.length
		});
	} catch (err: unknown) {
		console.error('[batch] Error storing signals:', err);
		return error(500, 'Failed to batch store signals');
	}
};
