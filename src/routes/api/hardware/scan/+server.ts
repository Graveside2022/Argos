/**
 * Hardware Scan API Endpoint
 * Scans system for all hardware and returns detection status
 */

import { json } from '@sveltejs/kit';

import { scanAllHardware } from '$lib/server/hardware/detection/hardware-detector';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/**
 * GET /api/hardware/scan
 * Scan system and return all detected hardware
 */
/** Group detected hardware by category. */
function groupByCategory(detected: Awaited<ReturnType<typeof scanAllHardware>>['detected']) {
	const grouped: Record<string, Array<Record<string, unknown>>> = {};
	for (const hw of detected) {
		if (!grouped[hw.category]) grouped[hw.category] = [];
		grouped[hw.category].push({
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
	return grouped;
}

export const GET: RequestHandler = async () => {
	try {
		logger.info('Scanning system hardware', { endpoint: '/api/hardware/scan' });
		const scanResult = await scanAllHardware();
		return json({
			success: true,
			stats: scanResult.stats,
			hardware: groupByCategory(scanResult.detected),
			timestamp: scanResult.timestamp
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.error('Hardware scan error', { endpoint: '/api/hardware/scan', error: msg });
		return json(
			{ success: false, error: msg || 'Unknown error', timestamp: Date.now() },
			{ status: 500 }
		);
	}
};
