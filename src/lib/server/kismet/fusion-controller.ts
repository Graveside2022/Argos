// Simplified Kismet controller — delegates to KismetProxy
import { KismetStatusResponseSchema } from '$lib/schemas/kismet.js';
import type { KismetStatusResponse } from '$lib/types/service-responses';

import { KismetProxy } from './kismet-proxy';
import type { KismetDevice } from './types';

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

			// Runtime validation with Zod (replaces unsafe type assertion)
			const result = KismetStatusResponseSchema.safeParse(rawStatus);
			if (!result.success) {
				console.error(
					'[fusion-controller] Invalid Kismet status response, using fallback:',
					{
						errors: result.error.format()
					}
				);
				throw new Error('Invalid Kismet status response format');
			}

			return result.data;
		} catch {
			return {
				running: false,
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
