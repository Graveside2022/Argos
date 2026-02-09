// Simplified Kismet controller — delegates to KismetProxy
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

	async getStatus(): Promise<Record<string, unknown>> {
		try {
			return await KismetProxy.getSystemStatus();
		} catch {
			return { running: false, error: 'Cannot connect to Kismet' };
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
