import type { KismetDevice } from '$lib/kismet/types';
import { KismetControlResponseSchema, KismetDevicesResponseSchema } from '$lib/schemas/rf';
import {
	addKismetDevice,
	clearAllKismetDevices,
	kismetStore,
	removeKismetDevice,
	setKismetStatus,
	updateDistributions
} from '$lib/stores/tactical-map/kismet-store';
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

	async checkKismetStatus(): Promise<void> {
		try {
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'status' })
			});

			if (response.ok) {
				const rawData = await response.json();
				const data = safeParseWithHandling(
					KismetControlResponseSchema,
					rawData,
					'background'
				);
				if (!data) {
					console.error('Invalid Kismet status response');
					return;
				}

				// Get current status
				let currentStatus: string = 'stopped';
				const unsubscribe = kismetStore.subscribe(
					(state) => (currentStatus = state.status)
				);
				unsubscribe();

				if (data.running && currentStatus === 'stopped') {
					setKismetStatus('running');
				} else if (!data.running && currentStatus === 'running') {
					setKismetStatus('stopped');
				}
			}
		} catch (error) {
			console.error('Error checking Kismet status:', error);
		}
	}

	async startKismet(): Promise<void> {
		let currentStatus: string = 'stopped';
		const unsubscribe = kismetStore.subscribe((state) => (currentStatus = state.status));
		unsubscribe();

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
			console.error('Error starting Kismet:', error);
			setKismetStatus('stopped');
		}
	}

	async stopKismet(): Promise<void> {
		let currentStatus: string = 'stopped';
		const unsubscribe = kismetStore.subscribe((state) => (currentStatus = state.status));
		unsubscribe();

		if (currentStatus === 'starting' || currentStatus === 'stopping') return;

		setKismetStatus('stopping');

		try {
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'stop' })
			});

			if (response.ok) {
				setTimeout(() => {
					setKismetStatus('stopped');
					clearAllKismetDevices(); // Clear all devices and signals from the map
				}, 2000);
			} else {
				const rawData = await response.json();
				const data = safeParseWithHandling(
					KismetControlResponseSchema,
					rawData,
					'background'
				);
				throw new Error(data?.message || 'Failed to stop Kismet');
			}
		} catch (error: unknown) {
			console.error('Error stopping Kismet:', error);
			setKismetStatus('running');
		}
	}

	async toggleKismet(): Promise<void> {
		let currentStatus: string = 'stopped';
		const unsubscribe = kismetStore.subscribe((state) => (currentStatus = state.status));
		unsubscribe();

		if (currentStatus === 'running') {
			await this.stopKismet();
		} else if (currentStatus === 'stopped') {
			await this.startKismet();
		}
	}

	async fetchKismetDevices(): Promise<KismetDevice[]> {
		let currentState: { status: string; devices: Map<string, KismetDevice> } | undefined;
		const unsubscribe = kismetStore.subscribe((state) => (currentState = state));
		unsubscribe();

		if (currentState?.status !== 'running') return [];

		try {
			const response = await fetch('/api/kismet/devices');
			if (response.ok) {
				const rawData = await response.json();
				const data = safeParseWithHandling(
					KismetDevicesResponseSchema,
					rawData,
					'background'
				);
				if (!data || !data.devices) {
					console.error('Invalid Kismet devices response');
					return [];
				}
				const devices = data.devices as unknown as KismetDevice[];

				// Track which devices we've seen this fetch
				const currentDeviceMACs = new Set(devices.map((d) => d.mac));

				// Remove devices that are no longer present
				currentState?.devices.forEach((device: KismetDevice, mac: string) => {
					if (!currentDeviceMACs.has(mac)) {
						removeKismetDevice(mac);
					}
				});

				// Add or update current devices
				devices.forEach((device: KismetDevice) => {
					addKismetDevice(device);
				});

				// Update distributions
				const deviceMap = new Map();
				devices.forEach((device) => {
					deviceMap.set(device.mac, device);
				});
				updateDistributions(deviceMap);

				return devices;
			}
		} catch (error) {
			console.error('Error fetching Kismet devices:', error);
		}

		return [];
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
