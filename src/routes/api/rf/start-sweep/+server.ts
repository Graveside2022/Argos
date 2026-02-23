import { error, json } from '@sveltejs/kit';

import { StartSweepRequestSchema } from '$lib/schemas/rf';
import { errMsg } from '$lib/server/api/error-utils';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

type FreqResult = { value: number; unit: string } | null;

/** Compute center frequency from a range object with start/stop or start/end. */
function rangeObjectToFreq(range: unknown): FreqResult {
	const obj = range as Record<string, unknown>;
	const start = obj.start as number | undefined;
	const end = (obj.stop as number | undefined) ?? (obj.end as number | undefined);
	if (start === undefined || end === undefined) {
		logger.warn('Invalid frequency range format', { range: String(range) });
		return null;
	}
	return { value: (start + end) / 2, unit: 'MHz' };
}

/** Convert a frequency range (object or number) to a center frequency. */
function toFrequency(range: unknown): FreqResult {
	if (typeof range === 'number') return { value: range, unit: 'MHz' };
	if (typeof range === 'object' && range !== null) return rangeObjectToFreq(range);
	logger.warn('Invalid frequency range format', { range: String(range) });
	return null;
}

/** Attempt to start a sweep cycle, returning a JSON response. */
async function startSweepCycle(frequencies: FreqResult[], cycleTimeMs: number): Promise<Response> {
	const success = await sweepManager.startCycle(
		frequencies as { value: number; unit: string }[],
		cycleTimeMs
	);
	if (success) {
		logger.info('[rf/start-sweep] HackRF sweep started successfully');
		return json({
			status: 'success',
			message: 'HackRF sweep started successfully',
			device: 'hackrf',
			frequencies,
			cycleTime: cycleTimeMs
		});
	}
	logger.error('[rf/start-sweep] HackRF startCycle returned false');
	return json(
		{
			status: 'error',
			message: 'Failed to start HackRF sweep - check server logs for details',
			currentStatus: sweepManager.getStatus()
		},
		{ status: 500 }
	);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const rawBody = await request.json();
		const validated = safeParseWithHandling(StartSweepRequestSchema, rawBody, 'user-action');
		if (!validated) return error(400, 'Invalid sweep configuration');

		const { frequencies: frequencyRanges, cycleTime } = validated;
		const frequencies = frequencyRanges
			.map(toFrequency)
			.filter((f): f is { value: number; unit: string } => f !== null);

		if (frequencies.length === 0) {
			return json(
				{
					status: 'error',
					message: 'No valid frequencies after parsing',
					rawFrequencies: frequencyRanges
				},
				{ status: 400 }
			);
		}

		return await startSweepCycle(frequencies, cycleTime * 1000);
	} catch (err: unknown) {
		logger.error('Error in rf/start-sweep endpoint', { error: errMsg(err) });
		return json({ status: 'error', message: errMsg(err) }, { status: 500 });
	}
};

// Add CORS headers
export const OPTIONS: RequestHandler = ({ request }) => {
	const origin = request.headers.get('origin');
	return new Response(null, {
		status: 204,
		headers: getCorsHeaders(origin)
	});
};
