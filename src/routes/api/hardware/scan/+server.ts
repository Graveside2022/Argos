/**
 * Hardware Scan API Endpoint
 * Scans system for all hardware and returns detection status
 */

import { json } from '@sveltejs/kit';

import { scanAllHardware } from '$lib/server/hardware/detection/hardware-detector';

import type { RequestHandler } from './$types';

/**
 * GET /api/hardware/scan
 * Scan system and return all detected hardware
 */
export const GET: RequestHandler = async () => {
	try {
		console.warn('[API /hardware/scan] Scanning system hardware...');

		const scanResult = await scanAllHardware();

		// Build detailed response
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const hardwareByCategory: Record<string, any[]> = {};

		for (const hw of scanResult.detected) {
			if (!hardwareByCategory[hw.category]) {
				hardwareByCategory[hw.category] = [];
			}

			hardwareByCategory[hw.category].push({
				id: hw.id,
				name: hw.name,
				status: hw.status,
				connectionType: hw.connectionType,
				capabilities: hw.capabilities,
				manufacturer: hw.manufacturer,
				model: hw.model,
				compatibleTools: hw.compatibleTools
			});
		}

		return json({
			success: true,
			stats: scanResult.stats,
			hardware: hardwareByCategory,
			timestamp: scanResult.timestamp
		});
	} catch (error) {
		console.error('[API /hardware/scan] Error:', error);

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
