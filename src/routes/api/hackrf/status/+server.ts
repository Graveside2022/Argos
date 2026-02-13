import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { getSweepManager } from '$lib/server/hackrf/sweep-manager';
import { SystemStatus } from '$lib/types/enums';

import type { RequestHandler } from './$types';

/**
 * Zod schema for HackRF status GET response
 * Task: T025 - Constitutional Audit Remediation (P1)
 */
const HackRFStatusResponseSchema = z.object({
	connected: z.boolean().describe('HackRF connection status'),
	sweeping: z.boolean().describe('Currently performing sweep'),
	deviceInfo: z.null().or(z.record(z.unknown())).describe('Device information'),
	currentFrequency: z.number().nullable().describe('Current frequency in MHz'),
	sweepConfig: z
		.object({
			startFreq: z.number().nullable(),
			stopFreq: z.number().nullable(),
			binWidth: z.number().nullable()
		})
		.nullable(),
	status: z.record(z.unknown()).describe('Manager status object'),
	timestamp: z.number().int().positive().describe('Response timestamp'),
	error: z.string().optional().describe('Error message (if any)')
});

export const GET: RequestHandler = () => {
	try {
		const manager = getSweepManager();
		const status = manager.getStatus();

		const responseData = {
			connected: status.state !== SystemStatus.Idle,
			sweeping: status.state === SystemStatus.Running,
			deviceInfo: null, // Not available in current implementation
			currentFrequency: status.currentFrequency || null,
			sweepConfig: {
				startFreq: null,
				stopFreq: null,
				binWidth: null
			},
			status: status,
			timestamp: Date.now()
		};

		// Validate response with Zod (T025)
		const validated = HackRFStatusResponseSchema.parse(responseData);

		return json(validated);
	} catch (error: unknown) {
		console.error('Error getting HackRF status:', error);
		return json(
			{
				connected: false,
				sweeping: false,
				deviceInfo: null,
				currentFrequency: null,
				sweepConfig: null,
				status: { state: SystemStatus.Error },
				timestamp: Date.now(),
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 200 }
		); // Return 200 even on error to avoid breaking SSE
	}
};
