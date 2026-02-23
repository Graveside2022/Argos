import { error, json } from '@sveltejs/kit';

import { SignalBatchRequestSchema, type SignalInput } from '$lib/schemas/api';
import { getRFDatabase } from '$lib/server/db/database';
import { SignalSource } from '$lib/types/enums';
import type { SignalMarker, SignalMetadata } from '$lib/types/signals';
import { logger } from '$lib/utils/logger';
import { handleValidationError } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

/** Extract error message from unknown error values. */
function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** Map of lowercase source strings to SignalSource enum values. */
const SOURCE_MAP: Record<string, SignalSource> = {
	hackrf: SignalSource.HackRF,
	kismet: SignalSource.Kismet,
	manual: SignalSource.Manual,
	'rtl-sdr': SignalSource.RtlSdr,
	other: SignalSource.Other
};

/** Normalize a source string to a SignalSource enum value. */
function normalizeSignalSource(source: string): SignalSource {
	return SOURCE_MAP[source?.toLowerCase()] || SignalSource.HackRF;
}

/** Generate a unique signal ID with timestamp and random suffix. */
function generateSignalId(): string {
	return `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Resolve latitude from top-level or nested location fields. */
function resolveLat(signal: SignalInput): number {
	return signal.lat ?? signal.location?.lat ?? 0;
}

/** Resolve longitude from nested location object. */
function resolveLocationLon(signal: SignalInput): number {
	return signal.location?.lon ?? signal.location?.lng ?? 0;
}

/** Resolve longitude from top-level or nested location fields. */
function resolveLon(signal: SignalInput): number {
	return signal.lon ?? signal.lng ?? resolveLocationLon(signal);
}

/** Resolve altitude from top-level or nested location fields. */
function resolveAltitude(signal: SignalInput): number {
	return signal.altitude ?? signal.location?.altitude ?? 0;
}

/** Extract geographic coordinates from a SignalInput. */
function extractCoordinates(signal: SignalInput) {
	return {
		lat: resolveLat(signal),
		lon: resolveLon(signal),
		altitude: resolveAltitude(signal)
	};
}

/** Normalize a timestamp value to milliseconds since epoch. */
function normalizeTimestamp(timestamp: string | number): number {
	return typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
}

/** Build SignalMetadata from a validated SignalInput. */
function buildSignalMetadata(signal: SignalInput): SignalMetadata {
	return {
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
	} as SignalMetadata;
}

/** Convert a validated SignalInput to SignalMarker format. */
function toSignalMarker(signal: SignalInput): SignalMarker {
	const id = signal.id || generateSignalId();
	const { lat, lon, altitude } = extractCoordinates(signal);
	const timestamp = normalizeTimestamp(signal.timestamp);

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
		metadata: buildSignalMetadata(signal)
	} as SignalMarker;
}

/** Extract signals array from validated batch request data. */
function extractSignalInputs(
	validatedData: SignalInput[] | { signals: SignalInput[] }
): SignalInput[] {
	return Array.isArray(validatedData) ? validatedData : validatedData.signals;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const db = getRFDatabase();
		const rawBody = await request.json();

		const validationResult = SignalBatchRequestSchema.safeParse(rawBody);
		if (!validationResult.success) {
			handleValidationError(validationResult.error, 'api', rawBody);
			return error(400, 'Invalid request: ' + validationResult.error.errors[0].message);
		}

		const signalInputs = extractSignalInputs(validationResult.data);
		const signalMarkers = signalInputs.map(toSignalMarker);

		if (signalMarkers.length === 0) {
			logger.warn('No signals to insert', { endpoint: 'batch' });
			return json({ success: true, count: 0, message: 'No signals to insert' });
		}

		const count = db.insertSignalsBatch(signalMarkers);

		return json({
			success: true,
			count,
			total: signalInputs.length,
			valid: count
		});
	} catch (err: unknown) {
		logger.error('Error storing signals', { endpoint: 'batch', error: errMsg(err) });
		return error(500, 'Failed to batch store signals');
	}
};
