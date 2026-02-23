import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { errMsg } from '$lib/server/api/error-utils';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/**
 * Zod schema for HackRF start-sweep POST request
 * Task: T024 - Constitutional Audit Remediation (P1)
 */
const StartSweepRequestSchema = z.object({
	frequencies: z
		.array(
			z.union([
				z.number().min(1).max(6000).describe('Single frequency in MHz'),
				z
					.object({
						start: z.number().min(1).max(6000),
						stop: z.number().min(1).max(6000)
					})
					.refine((data) => data.stop > data.start, {
						message: 'stop must be greater than start'
					}),
				z
					.object({
						start: z.number().min(1).max(6000),
						end: z.number().min(1).max(6000)
					})
					.refine((data) => data.end > data.start, {
						message: 'end must be greater than start'
					})
			])
		)
		.min(1, 'At least one frequency range required'),
	cycleTime: z.number().positive().default(10).describe('Cycle time in seconds')
});

type FreqRange = z.infer<typeof StartSweepRequestSchema>['frequencies'][number];

/** Convert a validated frequency range to center frequency. */
function toFrequency(range: FreqRange): { value: number; unit: string } {
	if (typeof range === 'number') return { value: range, unit: 'MHz' };
	const end = 'stop' in range ? range.stop : range.end;
	return { value: (range.start + end) / 2, unit: 'MHz' };
}

/** Validate request body. Returns parsed data or error response. */
function parseStartSweepBody(rawBody: unknown) {
	const result = StartSweepRequestSchema.safeParse(rawBody);
	if (!result.success) {
		logger.error('[start-sweep] Validation failed', { errors: result.error.format() });
		return {
			error: json(
				{ status: 'error', message: 'Invalid request body', errors: result.error.format() },
				{ status: 400 }
			)
		};
	}
	return { data: result.data };
}

/** Start sweep cycle and return response. */
async function startSweepCycle(
	frequencies: { value: number; unit: string }[],
	cycleTimeMs: number
) {
	const success = await sweepManager.startCycle(frequencies, cycleTimeMs);
	if (success) {
		logger.info('[start-sweep] Sweep started successfully');
		return json({
			status: 'success',
			message: 'Sweep started successfully',
			frequencies,
			cycleTime: cycleTimeMs
		});
	}
	logger.error('[start-sweep] startCycle returned false');
	return json(
		{
			status: 'error',
			message: 'Failed to start sweep - check server logs for details',
			currentStatus: sweepManager.getStatus()
		},
		{ status: 500 }
	);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const parsed = parseStartSweepBody(await request.json());
		if (parsed.error) return parsed.error;

		const frequencies = parsed.data.frequencies.map(toFrequency);
		const cycleTimeMs = parsed.data.cycleTime * 1000;
		logger.info('[start-sweep] Attempting to start sweep', { frequencies, cycleTimeMs });
		return await startSweepCycle(frequencies, cycleTimeMs);
	} catch (error: unknown) {
		const msg = errMsg(error);
		logger.error('Error in start-sweep endpoint', { error: msg });
		return json({ status: 'error', message: msg }, { status: 500 });
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
