import { KismetController } from './kismet-controller';
import { logInfo, logError, logWarn } from '$lib/utils/logger';
import type { KismetConfig } from './types';

/**
 * Singleton Kismet controller instance for Fusion integration
 */
class FusionKismetController {
	private static instance: FusionKismetController | null = null;
	private kismetController: KismetController | null = null;
	private isInitialized = false;

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	static getInstance(): FusionKismetController {
		if (!FusionKismetController.instance) {
			FusionKismetController.instance = new FusionKismetController();
		}
		return FusionKismetController.instance;
	}

	/**
	 * Initialize Kismet controller with configuration
	 */
	async initialize(config?: Partial<KismetConfig>): Promise<void> {
		if (this.isInitialized) {
			logWarn('Fusion Kismet controller already initialized');
			return;
		}

		try {
			// Try to detect any WiFi adapter (not just Alfa)
			const { WiFiAdapterDetector } = await import('./wifi-adapter-detector');
			const bestInterface = await WiFiAdapterDetector.getBestMonitorInterface();

			const defaultConfig: KismetConfig = {
				interface: bestInterface || 'wlan0', // Use best available adapter
				monitorMode: true,
				channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
				hopRate: 5,
				restPort: parseInt(process.env.KISMET_PORT || '2501', 10),
				restUser: process.env.KISMET_USER || 'admin',
				restPassword: process.env.KISMET_PASSWORD || 'password',
				logLevel: 'info',
				enableGPS: true,
				enableLogging: true,
				enableAlerts: true,
				deviceTimeout: 300
			};

			if (bestInterface) {
				logInfo(`Using detected WiFi interface: ${bestInterface}`);
			} else {
				logWarn('No suitable WiFi adapter detected, using default interface');
			}

			const mergedConfig = { ...defaultConfig, ...config };

			this.kismetController = new KismetController(mergedConfig);
			this.isInitialized = true;

			logInfo('Fusion Kismet controller initialized');
		} catch (error) {
			logError('Failed to initialize Fusion Kismet controller', {
				error: (error as Error).message
			});
			throw error;
		}
	}

	/**
	 * Get Kismet controller instance
	 */
	getController(): KismetController {
		if (!this.isInitialized || !this.kismetController) {
			throw new Error('Kismet controller not initialized');
		}
		return this.kismetController;
	}

	/**
	 * Start Kismet monitoring
	 */
	async start(): Promise<void> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		await this.kismetController!.startMonitoring();
	}

	/**
	 * Stop Kismet monitoring
	 */
	async stop(): Promise<void> {
		if (this.kismetController) {
			await this.kismetController.stopMonitoring();
		}
	}

	/**
	 * Get status
	 */
	getStatus(): any {
		if (!this.kismetController) {
			return {
				running: false,
				error: 'Controller not initialized'
			};
		}

		return this.kismetController.getStatus();
	}

	/**
	 * Get devices
	 */
	async getDevices(): Promise<any[]> {
		if (!this.kismetController) {
			return [];
		}

		return await this.kismetController.getDevices();
	}

	/**
	 * Check if initialized
	 */
	isReady(): boolean {
		return this.isInitialized && this.kismetController !== null;
	}
}

// Export singleton instance
export const fusionKismetController = FusionKismetController.getInstance();
