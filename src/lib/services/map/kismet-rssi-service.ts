/**
 * Kismet RSSI Localization Service
 * Integrates Coral TPU acceleration for real-time device localization
 */

import type { KismetDevice } from '$lib/types/kismet';
import { HybridRSSILocalizer } from '$lib/services/localization/hybrid-rssi-localizer';
import type { HeatmapPoint } from './heatmap-service';
import { get } from 'svelte/store';
import { gpsStore } from '$lib/stores/tactical-map/gps-store';

export interface RSSILocalizationConfig {
	enabled: boolean;
	minMeasurements: number;
	heatmapResolution: number;
	updateInterval: number;
	useCoralTPU: boolean;
}

export class KismetRSSIService {
	private localizer: HybridRSSILocalizer | null = null;
	private config: RSSILocalizationConfig = {
		enabled: false,
		minMeasurements: 5,
		heatmapResolution: 32,
		updateInterval: 5000,
		useCoralTPU: true
	};

	private measurementHistory = new Map<
		string,
		Array<{
			timestamp: number;
			position: { lat: number; lon: number; altitude: number };
			rssi: number;
		}>
	>();

	constructor() {}

	async initialize(): Promise<void> {
		if (this.config.useCoralTPU) {
			try {
				// Try to use Coral-accelerated localizer
				this.localizer = new HybridRSSILocalizer();
				await this.localizer.initialize();
				console.log('[OK] RSSI Localization initialized with Coral TPU acceleration');
			} catch (error) {
				console.warn('Failed to initialize Coral TPU, falling back to CPU:', error);
				this.config.useCoralTPU = false;
			}
		}
	}

	/**
	 * Process Kismet devices and add RSSI measurements
	 */
	processKismetDevices(devices: KismetDevice[]): void {
		if (!this.config.enabled || !this.localizer) return;

		const gps = get(gpsStore);
		if (!gps.position || gps.status.accuracy > 20) {
			// Need accurate GPS position for measurements
			return;
		}

		const currentTime = Date.now();

		devices.forEach((device) => {
			if (!device.signal?.last_signal) return;

			// Add measurement to localizer
			this.localizer?.addMeasurement({
				id: `${currentTime}-${device.mac}`,
				timestamp: currentTime,
				position: {
					lat: gps.position.lat,
					lon: gps.position.lon,
					altitude: 0, // GPS position doesn't include altitude
					accuracy: gps.status.accuracy
				},
				deviceId: device.mac,
				rssi: device.signal.last_signal,
				frequency: device.frequency || 2437
			});

			// Store in history for visualization
			if (!this.measurementHistory.has(device.mac)) {
				this.measurementHistory.set(device.mac, []);
			}

			const history = this.measurementHistory.get(device.mac)!;
			history.push({
				timestamp: currentTime,
				position: {
					lat: gps.position.lat,
					lon: gps.position.lon,
					altitude: 0 // GPS position doesn't include altitude
				},
				rssi: device.signal.last_signal
			});

			// Keep only recent measurements (last 5 minutes)
			const cutoffTime = currentTime - 5 * 60 * 1000;
			const filtered = history.filter((m) => m.timestamp > cutoffTime);
			this.measurementHistory.set(device.mac, filtered);
		});
	}

	/**
	 * Generate heatmap data for a specific device
	 */
	async generateHeatmapForDevice(
		deviceId: string,
		bounds: { north: number; south: number; east: number; west: number }
	): Promise<HeatmapPoint[]> {
		if (!this.localizer) return [];

		const measurements = this.measurementHistory.get(deviceId);
		if (!measurements || measurements.length < this.config.minMeasurements) {
			return [];
		}

		try {
			// Get prediction from localizer (uses Coral TPU if available)
			const prediction = await this.localizer.predictForDevice(deviceId, bounds);

			// Convert prediction to heatmap points
			const points: HeatmapPoint[] = [];
			const { mean, variance } = prediction;
			const gridSize = Math.sqrt(mean.length);

			for (let y = 0; y < gridSize; y++) {
				for (let x = 0; x < gridSize; x++) {
					const idx = y * gridSize + x;
					const rssi = mean[idx];

					// Convert RSSI to intensity (0-1)
					// -100 dBm = 0, -30 dBm = 1
					const intensity = Math.max(0, Math.min(1, (rssi + 100) / 70));

					// Skip very weak signals
					if (intensity < 0.1) continue;

					// Convert grid position to lat/lon
					const lat = bounds.south + (y / gridSize) * (bounds.north - bounds.south);
					const lon = bounds.west + (x / gridSize) * (bounds.east - bounds.west);

					// Use variance to modulate intensity (higher confidence = stronger display)
					const confidence = 1 / (1 + variance[idx] / 100);

					points.push({
						lat,
						lon,
						intensity: intensity * confidence,
						timestamp: Date.now()
					});
				}
			}

			return points;
		} catch (error) {
			console.error('Failed to generate heatmap:', error);
			return [];
		}
	}

	/**
	 * Get estimated position for a device
	 */
	async getDeviceLocation(deviceId: string): Promise<{
		position: { lat: number; lon: number };
		confidence: number;
		uncertaintyRadius: number;
	} | null> {
		if (!this.localizer) return null;

		const measurements = this.measurementHistory.get(deviceId);
		if (!measurements || measurements.length < this.config.minMeasurements) {
			return null;
		}

		try {
			return await this.localizer.estimateSourceLocation(deviceId);
		} catch (error) {
			console.error('Failed to estimate device location:', error);
			return null;
		}
	}

	/**
	 * Enable/disable RSSI localization
	 */
	setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		if (!enabled) {
			// Clear measurement history when disabled
			this.measurementHistory.clear();
		}
	}

	/**
	 * Get service status
	 */
	getStatus(): {
		enabled: boolean;
		usingCoralTPU: boolean;
		deviceCount: number;
		totalMeasurements: number;
	} {
		let totalMeasurements = 0;
		this.measurementHistory.forEach((history) => {
			totalMeasurements += history.length;
		});

		return {
			enabled: this.config.enabled,
			usingCoralTPU: this.config.useCoralTPU && !!this.localizer,
			deviceCount: this.measurementHistory.size,
			totalMeasurements
		};
	}

	/**
	 * Clear all measurements for a device
	 */
	clearDeviceMeasurements(deviceId: string): void {
		this.measurementHistory.delete(deviceId);
	}

	/**
	 * Clear all measurements
	 */
	clearAllMeasurements(): void {
		this.measurementHistory.clear();
	}

	/**
	 * Shutdown the service
	 */
	async shutdown(): Promise<void> {
		if (this.localizer) {
			await this.localizer.shutdown();
			this.localizer = null;
		}
		this.measurementHistory.clear();
	}
}

// Singleton instance
export const kismetRSSIService = new KismetRSSIService();
