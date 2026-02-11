// Simplified Kismet controller — delegates to KismetProxy
import { KismetProxy } from './kismet-proxy';
import type { KismetDevice } from './types';
import type { KismetStatusResponse } from '$lib/types/service-responses';

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
			return (await KismetProxy.getSystemStatus()) as unknown as KismetStatusResponse;
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
