import { error, json } from '@sveltejs/kit';

import { SignalBatchRequestSchema, type SignalInput } from '$lib/schemas/api';
import { getRFDatabase } from '$lib/server/db/database';
import { SignalSource } from '$lib/types/enums';
import type { SignalMarker, SignalMetadata } from '$lib/types/signals';
import { logger } from '$lib/utils/logger';
import { handleValidationError } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

function normalizeSignalSource(source: string): SignalSource {
	const sourceMap: Record<string, SignalSource> = {
		hackrf: SignalSource.HackRF,
		kismet: SignalSource.Kismet,
		manual: SignalSource.Manual,
		'rtl-sdr': SignalSource.RtlSdr,
		other: SignalSource.Other
	};
	return sourceMap[source?.toLowerCase()] || SignalSource.HackRF;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const db = getRFDatabase();
		const rawBody = await request.json();

		// Validate request body with Zod (T027)
		const validationResult = SignalBatchRequestSchema.safeParse(rawBody);
		if (!validationResult.success) {
			handleValidationError(validationResult.error, 'api', rawBody);
			return error(400, 'Invalid request: ' + validationResult.error.errors[0].message);
		}

		// Extract signals array from validated request
		const validatedData = validationResult.data;
		const signalInputs: SignalInput[] = Array.isArray(validatedData)
			? validatedData
			: validatedData.signals;

		// Convert validated SignalInput objects to SignalMarker format
		const signalMarkers: SignalMarker[] = signalInputs.map((signal) => {
			// Generate unique ID if not provided
			const id =
				signal.id || `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			// Extract coordinates (validated by Zod refine, at least one source exists)
			const lat = signal.lat ?? signal.location?.lat ?? 0;
			const lon =
				signal.lon ?? signal.lng ?? signal.location?.lon ?? signal.location?.lng ?? 0;
			const altitude = signal.altitude ?? signal.location?.altitude ?? 0;

			// Convert timestamp to milliseconds
			const timestamp =
				typeof signal.timestamp === 'string'
					? new Date(signal.timestamp).getTime()
					: signal.timestamp;

			// Build SignalMarker with validated data
			return {
				id,
				lat,
				lon,
				position: { lat, lon },
				altitude,
				frequency: signal.frequency,
				power: signal.power,
				timestamp,
				source: normalizeSignalSource(signal.source || 'hackrf'),
				metadata: {
					bandwidth: signal.bandwidth,
					modulation: signal.modulation,
					confidence: signal.confidence,
					noiseFloor: signal.noiseFloor,
					snr: signal.snr,
					peakPower: signal.peakPower,
					averagePower: signal.averagePower,
					standardDeviation: signal.standardDeviation,
					skewness: signal.skewness,
					kurtosis: signal.kurtosis,
					antennaId: signal.antennaId,
					scanConfig: signal.scanConfig
				} as SignalMetadata
			} as SignalMarker;
		});

		if (signalMarkers.length === 0) {
			logger.warn('No signals to insert', { endpoint: 'batch' });
			return json({
				success: true,
				count: 0,
				message: 'No signals to insert'
			});
		}

		// Batch store signals (validation happens in insertSignalsBatch via T034)
		const count = db.insertSignalsBatch(signalMarkers);

		return json({
			success: true,
			count,
			total: signalInputs.length,
			valid: count
		});
	} catch (err: unknown) {
		logger.error('Error storing signals', {
			endpoint: 'batch',
			error: err instanceof Error ? err.message : String(err)
		});
		return error(500, 'Failed to batch store signals');
	}
};
