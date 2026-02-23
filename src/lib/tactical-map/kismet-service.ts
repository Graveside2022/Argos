import { get } from 'svelte/store';

import type { KismetDevice } from '$lib/kismet/types';
import { KismetControlResponseSchema, KismetDevicesResponseSchema } from '$lib/schemas/rf';
import {
	batchUpdateDevices,
	clearAllKismetDevices,
	kismetStore,
	setKismetStatus
} from '$lib/stores/tactical-map/kismet-store';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

export interface KismetDevicesResponse {
	devices: KismetDevice[];
}

export interface KismetControlResponse {
	running?: boolean;
	message?: string;
	success?: boolean;
}

export class KismetService {
	private statusCheckInterval: ReturnType<typeof setInterval> | null = null;
	private deviceFetchInterval: ReturnType<typeof setInterval> | null = null;

	/** Reconcile Kismet running state with the store */
	private reconcileStatus(isRunning: boolean): void {
		const currentStatus = get(kismetStore).status;
		if (isRunning && currentStatus === 'stopped') setKismetStatus('running');
		else if (!isRunning && currentStatus === 'running') setKismetStatus('stopped');
	}

	async checkKismetStatus(): Promise<void> {
		try {
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'status' })
			});

			if (!response.ok) return;

			const rawData = await response.json();
			const data = safeParseWithHandling(KismetControlResponseSchema, rawData, 'background');
			if (!data) {
				logger.error('Invalid Kismet status response');
				return;
			}
			this.reconcileStatus(data.isRunning ?? false);
		} catch (error) {
			logger.error('Error checking Kismet status', { error });
		}
	}

	async startKismet(): Promise<void> {
		const currentStatus = get(kismetStore).status;

		if (currentStatus === 'starting' || currentStatus === 'stopping') return;

		setKismetStatus('starting');

		try {
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'start' })
			});

			if (response.ok) {
				// Wait a bit for services to start
				setTimeout(() => {
					void this.checkKismetStatus();
					setKismetStatus('running');
					// Start fetching devices immediately when service starts
					void this.fetchKismetDevices();
				}, 2000);
			} else {
				const errorText = await response.text();
				throw new Error(`Failed to start Kismet: ${errorText}`);
			}
		} catch (error: unknown) {
			logger.error('Error starting Kismet', { error });
			setKismetStatus('stopped');
		}
	}

	/** Parse an error response from Kismet control API */
	private async parseControlError(response: Response): Promise<string> {
		const rawData = await response.json();
		const data = safeParseWithHandling(KismetControlResponseSchema, rawData, 'background');
		return data?.message || 'Failed to stop Kismet';
	}

	async stopKismet(): Promise<void> {
		const currentStatus = get(kismetStore).status;
		if (currentStatus === 'starting' || currentStatus === 'stopping') return;

		setKismetStatus('stopping');

		try {
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'stop' })
			});

			if (!response.ok) throw new Error(await this.parseControlError(response));

			setTimeout(() => {
				setKismetStatus('stopped');
				clearAllKismetDevices();
			}, 2000);
		} catch (error: unknown) {
			logger.error('Error stopping Kismet', { error });
			setKismetStatus('running');
		}
	}

	async toggleKismet(): Promise<void> {
		const currentStatus = get(kismetStore).status;

		if (currentStatus === 'running') {
			await this.stopKismet();
		} else if (currentStatus === 'stopped') {
			await this.startKismet();
		}
	}

	/** Parse and validate a devices API response, returning null on failure */
	private async parseDevicesResponse(response: Response): Promise<KismetDevice[] | null> {
		if (!response.ok) return null;
		const rawData = await response.json();
		const data = safeParseWithHandling(KismetDevicesResponseSchema, rawData, 'background');
		if (!data?.devices) {
			logger.error('Invalid Kismet devices response');
			return null;
		}
		return data.devices as unknown as KismetDevice[];
	}

	async fetchKismetDevices(): Promise<KismetDevice[]> {
		const currentState = get(kismetStore);
		if (currentState?.status !== 'running') return [];

		try {
			const response = await fetch('/api/kismet/devices');
			const devices = await this.parseDevicesResponse(response);
			if (!devices) return [];
			batchUpdateDevices(devices, currentState.devices);
			return devices;
		} catch (error) {
			logger.error('Error fetching Kismet devices', { error });
			return [];
		}
	}

	startPeriodicStatusCheck(): void {
		// Initial check
		void this.checkKismetStatus();

		// Set up more frequent initial status checks, then slower periodic checks
		let initialCheckCount = 0;
		const initialCheckInterval = setInterval(() => {
			void this.checkKismetStatus();
			initialCheckCount++;
			if (initialCheckCount >= 3) {
				clearInterval(initialCheckInterval);
				// Set up slower periodic status checks
				this.statusCheckInterval = setInterval(() => {
					void this.checkKismetStatus();
				}, 5000);
			}
		}, 1000);
	}

	startPeriodicDeviceFetch(): void {
		// Set up Kismet device fetching interval (will only fetch when running)
		this.deviceFetchInterval = setInterval(() => {
			void this.fetchKismetDevices();
		}, 10000);
	}

	stopPeriodicChecks(): void {
		if (this.statusCheckInterval) {
			clearInterval(this.statusCheckInterval);
			this.statusCheckInterval = null;
		}

		if (this.deviceFetchInterval) {
			clearInterval(this.deviceFetchInterval);
			this.deviceFetchInterval = null;
		}
	}

	// Helper method to clear all devices and markers
	clearDevices(): void {
		clearAllKismetDevices();
	}
}
