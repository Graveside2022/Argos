import { error, json } from '@sveltejs/kit';

import { StartSweepRequestSchema } from '$lib/schemas/rf';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { getCorsHeaders } from '$lib/server/security/cors';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const rawBody = await request.json();
		const validated = safeParseWithHandling(StartSweepRequestSchema, rawBody, 'user-action');

		if (!validated) {
			return error(400, 'Invalid sweep configuration');
		}

		const { frequencies: frequencyRanges, cycleTime } = validated;
		logger.debug('[rf/start-sweep] Validated request', { frequencyRanges, cycleTime });

		// Always use the HackRF sweep manager which will auto-detect and use USRP if available
		{
			// Handle HackRF device (default)
			// Convert frequency ranges to center frequencies
			const frequencies = frequencyRanges
				.map((range: unknown) => {
					// Handle multiple formats:
					// 1. Object with start/stop/step
					// 2. Object with start/end
					// 3. Plain number
					if (typeof range === 'object' && range !== null) {
						let centerFreq;
						// Safe: Record type for dynamic access
						// Safe: Range property cast to Record for dynamic min/max property extraction
						const rangeObj = range as Record<string, unknown>;
						if (rangeObj.start !== undefined && rangeObj.stop !== undefined) {
							centerFreq =
								((rangeObj.start as number) + (rangeObj.stop as number)) / 2;
						} else if (rangeObj.start !== undefined && rangeObj.end !== undefined) {
							centerFreq =
								((rangeObj.start as number) + (rangeObj.end as number)) / 2;
						} else {
							logger.warn('Invalid frequency range format', { range: String(range) });
							return null;
						}
						return {
							value: centerFreq,
							unit: 'MHz'
						};
					} else if (typeof range === 'number') {
						return {
							value: range,
							unit: 'MHz'
						};
					} else {
						logger.warn('Invalid frequency range format', { range: String(range) });
						return null;
					}
				})
				.filter((freq): freq is { value: number; unit: string } => freq !== null); // Remove any null values

			if (frequencies.length === 0) {
				logger.error('[rf/start-sweep] No valid frequencies after parsing');
				return json(
					{
						status: 'error',
						message: 'No valid frequencies after parsing',
						rawFrequencies: frequencyRanges
					},
					{ status: 400 }
				);
			}

			// Convert cycleTime from seconds to milliseconds
			const cycleTimeMs = cycleTime * 1000;

			// Start the sweep using sweepManager
			logger.info('[rf/start-sweep] Attempting to start HackRF sweep', {
				frequencies,
				cycleTimeMs
			});

			try {
				const success = await sweepManager.startCycle(frequencies, cycleTimeMs);

				if (success) {
					logger.info('[rf/start-sweep] HackRF sweep started successfully');
					return json({
						status: 'success',
						message: 'HackRF sweep started successfully',
						device: 'hackrf',
						frequencies: frequencies,
						cycleTime: cycleTimeMs
					});
				} else {
					logger.error('[rf/start-sweep] HackRF startCycle returned false');
					const status = sweepManager.getStatus();
					logger.error('[rf/start-sweep] Current HackRF sweep manager status', {
						status
					});

					return json(
						{
							status: 'error',
							message: 'Failed to start HackRF sweep - check server logs for details',
							currentStatus: status
						},
						{ status: 500 }
					);
				}
			} catch (cycleError: unknown) {
				logger.error('[rf/start-sweep] Error in HackRF startCycle', {
					error: cycleError instanceof Error ? cycleError.message : String(cycleError)
				});
				throw cycleError;
			}
		}
	} catch (error: unknown) {
		logger.error('Error in rf/start-sweep endpoint', {
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
