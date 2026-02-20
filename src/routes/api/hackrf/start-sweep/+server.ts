import { json } from '@sveltejs/kit';
import { z } from 'zod';

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

export const POST: RequestHandler = async ({ request }) => {
	try {
		const rawBody = await request.json();

		// Validate request body with Zod (T024)
		const validationResult = StartSweepRequestSchema.safeParse(rawBody);

		if (!validationResult.success) {
			logger.error('[start-sweep] Validation failed', {
				errors: validationResult.error.format()
			});
			return json(
				{
					status: 'error',
					message: 'Invalid request body',
					errors: validationResult.error.format()
				},
				{ status: 400 }
			);
		}

		const body = validationResult.data;
		logger.debug('[start-sweep] Request body', { body });

		// Extract validated frequencies from request
		const frequencyRanges = body.frequencies;
		const cycleTime = body.cycleTime;

		// Convert validated frequency ranges to center frequencies
		// Zod validation ensures all types are correct - no assertions needed
		const frequencies = frequencyRanges.map((range) => {
			if (typeof range === 'number') {
				return { value: range, unit: 'MHz' };
			} else if ('stop' in range && range.stop !== undefined) {
				const centerFreq = (range.start + range.stop) / 2;
				return { value: centerFreq, unit: 'MHz' };
			} else if ('end' in range && range.end !== undefined) {
				// 'end' variant (validated by Zod)
				const centerFreq = (range.start + range.end) / 2;
				return { value: centerFreq, unit: 'MHz' };
			} else {
				// Unreachable after Zod validation, but satisfies exhaustive check
				return { value: 0, unit: 'MHz' };
			}
		});

		// Convert cycleTime from seconds to milliseconds
		const cycleTimeMs = cycleTime * 1000;

		// Start the sweep using sweepManager
		logger.info('[start-sweep] Attempting to start sweep', { frequencies, cycleTimeMs });

		try {
			const success = await sweepManager.startCycle(frequencies, cycleTimeMs);

			if (success) {
				logger.info('[start-sweep] Sweep started successfully');
				return json({
					status: 'success',
					message: 'Sweep started successfully',
					frequencies: frequencies,
					cycleTime: cycleTimeMs
				});
			} else {
				logger.error('[start-sweep] startCycle returned false');
				const status = sweepManager.getStatus();
				logger.error('[start-sweep] Current sweep manager status', { status });

				return json(
					{
						status: 'error',
						message: 'Failed to start sweep - check server logs for details',
						currentStatus: status
					},
					{ status: 500 }
				);
			}
		} catch (cycleError: unknown) {
			logger.error('[start-sweep] Error in startCycle', {
				error: cycleError instanceof Error ? cycleError.message : String(cycleError)
			});
			throw cycleError;
		}
	} catch (error: unknown) {
		logger.error('Error in start-sweep endpoint', {
			error: error instanceof Error ? error.message : String(error)
		});
		return json(
			{
				status: 'error',
				message: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
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
