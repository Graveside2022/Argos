/**
 * Hardware Status API Endpoint
 * Check status of specific hardware device
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { globalHardwareRegistry, detectHardwareById } from '$lib/server/hardware';

/**
 * GET /api/hardware/status/:hardwareId
 * Get status of a specific hardware device
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const { hardwareId } = params;

		console.log(`[API /hardware/status] Checking status: ${hardwareId}`);

		// First check registry
		let hardware = globalHardwareRegistry.get(hardwareId);

		// If not in registry, try to detect it
		if (!hardware) {
			hardware = await detectHardwareById(hardwareId);
		}

		if (!hardware) {
			return json(
				{
					success: false,
					error: `Hardware not found: ${hardwareId}`,
					available: false
				},
				{ status: 404 }
			);
		}

		return json({
			success: true,
			hardware: {
				id: hardware.id,
				name: hardware.name,
				category: hardware.category,
				connectionType: hardware.connectionType,
				status: hardware.status,
				capabilities: hardware.capabilities,
				manufacturer: hardware.manufacturer,
				model: hardware.model,
				firmwareVersion: hardware.firmwareVersion,
				lastSeen: hardware.lastSeen,
				compatibleTools: hardware.compatibleTools
			},
			available: hardware.status === 'connected',
			timestamp: Date.now()
		});
	} catch (error) {
		console.error('[API /hardware/status] Error:', error);

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				timestamp: Date.now()
			},
			{ status: 500 }
		);
	}
};
