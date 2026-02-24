/**
 * Hardware Scan API Endpoint
 * Scans system for all hardware and returns detection status
 */

import { createHandler } from '$lib/server/api/create-handler';
import { scanAllHardware } from '$lib/server/hardware/detection/hardware-detector';
import { logger } from '$lib/utils/logger';

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

export const GET = createHandler(async () => {
	logger.info('Scanning system hardware', { endpoint: '/api/hardware/scan' });
	const scanResult = await scanAllHardware();
	return {
		success: true,
		stats: scanResult.stats,
		hardware: groupByCategory(scanResult.detected),
		timestamp: scanResult.timestamp
	};
});
