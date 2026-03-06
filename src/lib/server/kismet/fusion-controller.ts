// Simplified Kismet controller — delegates to KismetProxy
import { KismetStatusResponseSchema } from '$lib/schemas/kismet.js';
import type { KismetStatusResponse } from '$lib/types/service-responses';
import { logger } from '$lib/utils/logger';

import { KismetProxy } from './kismet-proxy';
import type { KismetDevice } from './types';

/** Read a numeric field from raw Kismet status, defaulting to 0. */
function rawNum(raw: Record<string, unknown>, key: string): number {
	return (raw[key] as number) || 0;
}

/** Transform raw Kismet system status JSON into the app's KismetStatusResponse shape. */
function transformRawStatus(raw: Record<string, unknown>): Record<string, unknown> {
	const startSec = rawNum(raw, 'kismet.system.timestamp.start_sec');
	const deviceCount = rawNum(raw, 'kismet.system.devices.count');
	return {
		isRunning: true,
		uptime: rawNum(raw, 'kismet.system.timestamp.sec') - startSec,
		interface: '',
		deviceCount,
		metrics: {
			packetsProcessed: 0,
			devicesDetected: deviceCount,
			packetsPerSecond: 0,
			bytesPerSecond: 0
		},
		channels: [],
		monitorInterfaces: [],
		startTime: startSec || undefined
	};
}

class FusionKismetController {
	private static instance: FusionKismetController | null = null;

	static getInstance(): FusionKismetController {
		if (!FusionKismetController.instance) {
			FusionKismetController.instance = new FusionKismetController();
		}
		return FusionKismetController.instance;
	}

	isReady(): boolean {
		return true;
	}

	async getStatus(): Promise<KismetStatusResponse> {
		try {
			const rawStatus = await KismetProxy.getSystemStatus();

			// Transform raw Kismet fields into the app's expected shape before validation
			const transformed = transformRawStatus(rawStatus as Record<string, unknown>);

			// Runtime validation with Zod
			const result = KismetStatusResponseSchema.safeParse(transformed);
			if (!result.success) {
				logger.error('[fusion-controller] Invalid Kismet status response, using fallback', {
					errors: result.error.format()
				});
				throw new Error('Invalid Kismet status response format');
			}

			return result.data;
		} catch {
			return {
				isRunning: false,
				uptime: 0,
				interface: '',
				deviceCount: 0,
				metrics: {
					packetsProcessed: 0,
					devicesDetected: 0,
					packetsPerSecond: 0,
					bytesPerSecond: 0
				},
				channels: [],
				monitorInterfaces: []
				// Safe: Fallback status object constructed with all required KismetStatusResponse fields
			} as KismetStatusResponse;
		}
	}

	async getDevices(): Promise<KismetDevice[]> {
		try {
			return await KismetProxy.getDevices();
		} catch {
			return [];
		}
	}
}

export const fusionKismetController = FusionKismetController.getInstance();
