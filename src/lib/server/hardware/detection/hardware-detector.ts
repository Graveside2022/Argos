/**
 * Hardware Detector - Main Orchestrator
 * Coordinates all hardware detection and registers devices
 */

import type {
	ConnectionType,
	DetectedHardware,
	HardwareCategory,
	HardwareScanResult
} from '$lib/server/hardware/detection-types';
import { globalHardwareRegistry } from '$lib/server/hardware/hardware-registry';
import { logger } from '$lib/utils/logger';

import { detectNetworkDevices } from './network-detector';
import { detectSerialDevices } from './serial-detector';
import { detectUSBDevices } from './usb-detector';

/**
 * Run all hardware detectors in parallel and collect successful results.
 * Logs errors for any detector that fails without blocking others.
 */
async function collectDetectionResults(): Promise<DetectedHardware[]> {
	const results = await Promise.allSettled([
		detectUSBDevices(),
		detectSerialDevices(),
		detectNetworkDevices()
	]);

	const allHardware: DetectedHardware[] = [];
	for (const result of results) {
		if (result.status === 'fulfilled') {
			allHardware.push(...result.value);
		} else {
			logger.error('[HardwareDetector] Detection error', { reason: String(result.reason) });
		}
	}
	return allHardware;
}

/**
 * Remove duplicate hardware entries, keeping the first occurrence by ID.
 */
function deduplicateHardware(hardware: DetectedHardware[]): DetectedHardware[] {
	const seen = new Set<string>();
	return hardware.filter((hw) => {
		if (seen.has(hw.id)) return false;
		seen.add(hw.id);
		return true;
	});
}

/**
 * Compute scan statistics from a list of detected hardware devices.
 * Returns category counts, connection type counts, and connected device count.
 */
function computeScanStatistics(devices: DetectedHardware[]): HardwareScanResult['stats'] {
	const byCategory: Record<HardwareCategory, number> = {
		sdr: 0,
		wifi: 0,
		bluetooth: 0,
		gps: 0,
		cellular: 0,
		serial: 0,
		network: 0,
		audio: 0,
		unknown: 0
	};
	const byConnectionType: Record<ConnectionType, number> = {
		usb: 0,
		network: 0,
		serial: 0,
		pci: 0,
		internal: 0,
		virtual: 0
	};
	let connected = 0;

	for (const hw of devices) {
		byCategory[hw.category]++;
		byConnectionType[hw.connectionType]++;
		if (hw.status === 'connected') connected++;
	}

	return { total: devices.length, connected, byCategory, byConnectionType };
}

/**
 * Scan system for all hardware
 */
export async function scanAllHardware(): Promise<HardwareScanResult> {
	logger.info('[HardwareDetector] Starting comprehensive hardware scan...');
	const startTime = Date.now();

	const allHardware = await collectDetectionResults();
	const deduplicated = deduplicateHardware(allHardware);

	globalHardwareRegistry.registerBulk(deduplicated);

	const stats = computeScanStatistics(deduplicated);
	const scanResult: HardwareScanResult = {
		detected: deduplicated,
		stats,
		timestamp: Date.now()
	};

	const duration = Date.now() - startTime;
	logger.info('[HardwareDetector] Scan complete', {
		duration,
		total: stats.total,
		connected: stats.connected,
		sdr: stats.byCategory.sdr,
		wifi: stats.byCategory.wifi,
		bluetooth: stats.byCategory.bluetooth,
		gps: stats.byCategory.gps,
		cellular: stats.byCategory.cellular
	});

	return scanResult;
}

/**
 * Detect specific hardware by ID
 */
export async function detectHardwareById(id: string): Promise<DetectedHardware | null> {
	// First check if already in registry
	const existing = globalHardwareRegistry.get(id);
	if (existing) return existing;

	// Run full scan and look for the hardware
	const scanResult = await scanAllHardware();
	return scanResult.detected.find((hw) => hw.id === id) || null;
}

/**
 * Check if specific hardware is available
 */
export async function isHardwareAvailable(id: string): Promise<boolean> {
	const hardware = await detectHardwareById(id);
	return hardware !== null && hardware.status === 'connected';
}

/**
 * Check if hardware category is available
 */
export async function isCategoryAvailable(category: HardwareCategory): Promise<boolean> {
	// Check registry first
	if (globalHardwareRegistry.hasCategory(category)) {
		return true;
	}

	// Run scan and check again
	await scanAllHardware();
	return globalHardwareRegistry.hasCategory(category);
}

/**
 * Get hardware compatible with a tool
 */
export function getCompatibleHardware(toolId: string): DetectedHardware[] {
	return globalHardwareRegistry.getCompatibleWith(toolId);
}

/**
 * Continuous hardware monitoring
 * Scans for hardware changes at regular intervals
 */
export class HardwareMonitor {
	private interval: NodeJS.Timeout | null = null;
	private _isRunning = false;

	/**
	 * Start monitoring hardware changes
	 */
	start(intervalMs: number = 30000): void {
		if (this._isRunning) {
			logger.warn('[HardwareMonitor] Already running');
			return;
		}

		logger.info('[HardwareMonitor] Starting', { intervalMs });
		this._isRunning = true;

		// Initial scan
		scanAllHardware().catch((error) => {
			logger.error('[HardwareMonitor] Initial scan failed', { error: String(error) });
		});

		// Periodic scans
		this.interval = setInterval(() => {
			scanAllHardware().catch((error) => {
				logger.error(
					'[HardwareMonitor] Scan failed',
					{ error: String(error) },
					'hw-monitor-scan'
				);
			});
		}, intervalMs);
	}

	/**
	 * Stop monitoring
	 */
	stop(): void {
		if (!this._isRunning) {
			return;
		}

		logger.info('[HardwareMonitor] Stopping');
		this._isRunning = false;

		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	/**
	 * Check if monitoring is active
	 */
	isRunning(): boolean {
		return this._isRunning;
	}
}

// Global hardware monitor instance
export const globalHardwareMonitor = new HardwareMonitor();
