/**
 * Hardware Registry
 * Central registry for detected hardware with query capabilities
 */

import { logger } from '$lib/utils/logger';

import type {
	ConnectionType,
	DetectedHardware,
	HardwareCategory,
	HardwareQueryOptions,
	HardwareStatus
} from './detection-types';

export class HardwareRegistry {
	private hardware: Map<string, DetectedHardware> = new Map();

	/**
	 * Register a hardware device
	 */
	register(hardware: DetectedHardware): void {
		this.hardware.set(hardware.id, hardware);
		logger.debug(
			'[HardwareRegistry] Registered',
			{ name: hardware.name, id: hardware.id },
			'hw-registry-register'
		);
	}

	/**
	 * Register multiple hardware devices
	 */
	registerBulk(hardwareList: DetectedHardware[]): void {
		for (const hw of hardwareList) {
			this.register(hw);
		}
	}

	/**
	 * Unregister a hardware device
	 */
	unregister(id: string): boolean {
		const result = this.hardware.delete(id);
		if (result) {
			logger.debug('[HardwareRegistry] Unregistered', { id });
		}
		return result;
	}

	/**
	 * Get hardware by ID
	 */
	get(id: string): DetectedHardware | undefined {
		return this.hardware.get(id);
	}

	/**
	 * Check if hardware exists
	 */
	has(id: string): boolean {
		return this.hardware.has(id);
	}

	/**
	 * Get all registered hardware
	 */
	getAll(): DetectedHardware[] {
		return Array.from(this.hardware.values());
	}

	/**
	 * Query hardware with filters
	 */
	query(options: HardwareQueryOptions = {}): DetectedHardware[] {
		let results = this.getAll();

		// Filter by category
		if (options.category) {
			results = results.filter((hw) => hw.category === options.category);
		}

		// Filter by connection type
		if (options.connectionType) {
			results = results.filter((hw) => hw.connectionType === options.connectionType);
		}

		// Filter by status
		if (options.status) {
			results = results.filter((hw) => hw.status === options.status);
		}

		// Filter by compatible tool
		if (options.compatibleWithTool) {
			const targetTool = options.compatibleWithTool;
			results = results.filter((hw) => hw.compatibleTools?.includes(targetTool));
		}

		// Search by name, manufacturer, or model
		if (options.search) {
			const searchLower = options.search.toLowerCase();
			results = results.filter(
				(hw) =>
					hw.name.toLowerCase().includes(searchLower) ||
					hw.manufacturer?.toLowerCase().includes(searchLower) ||
					hw.model?.toLowerCase().includes(searchLower) ||
					hw.id.toLowerCase().includes(searchLower)
			);
		}

		return results;
	}

	/**
	 * Get hardware organized by category
	 */
	getByCategory(): Record<HardwareCategory, DetectedHardware[]> {
		const byCategory: Partial<Record<HardwareCategory, DetectedHardware[]>> = {};

		for (const hw of this.hardware.values()) {
			if (!byCategory[hw.category]) {
				byCategory[hw.category] = [];
			}
			const category = byCategory[hw.category];
			if (category) {
				category.push(hw);
			}
		}

		// Safe: Object built from HardwareCategory enum keys — guaranteed complete
		return byCategory as Record<HardwareCategory, DetectedHardware[]>;
	}

	/**
	 * Get hardware organized by connection type
	 */
	getByConnectionType(): Record<ConnectionType, DetectedHardware[]> {
		const byConnection: Partial<Record<ConnectionType, DetectedHardware[]>> = {};

		for (const hw of this.hardware.values()) {
			if (!byConnection[hw.connectionType]) {
				byConnection[hw.connectionType] = [];
			}
			const connection = byConnection[hw.connectionType];
			if (connection) {
				connection.push(hw);
			}
		}

		// Safe: Object built from ConnectionType enum keys — guaranteed complete
		return byConnection as Record<ConnectionType, DetectedHardware[]>;
	}

	/**
	 * Get registry statistics
	 */
	getStats(): {
		total: number;
		connected: number;
		byCategory: Record<string, number>;
		byConnectionType: Record<string, number>;
		byStatus: Record<string, number>;
	} {
		const all = this.getAll();

		const byCategory: Record<string, number> = {};
		const byConnectionType: Record<string, number> = {};
		const byStatus: Record<string, number> = {};

		for (const hw of all) {
			byCategory[hw.category] = (byCategory[hw.category] || 0) + 1;
			byConnectionType[hw.connectionType] = (byConnectionType[hw.connectionType] || 0) + 1;
			byStatus[hw.status] = (byStatus[hw.status] || 0) + 1;
		}

		return {
			total: all.length,
			connected: all.filter((hw) => hw.status === 'connected').length,
			byCategory,
			byConnectionType,
			byStatus
		};
	}

	/**
	 * Update hardware status
	 */
	updateStatus(id: string, status: HardwareStatus): boolean {
		const hw = this.hardware.get(id);
		if (hw) {
			hw.status = status;
			hw.lastSeen = Date.now();
			return true;
		}
		return false;
	}

	/**
	 * Mark hardware as connected
	 */
	markConnected(id: string): boolean {
		return this.updateStatus(id, 'connected');
	}

	/**
	 * Mark hardware as disconnected
	 */
	markDisconnected(id: string): boolean {
		return this.updateStatus(id, 'disconnected');
	}

	/**
	 * Clear all hardware
	 */
	clear(): void {
		this.hardware.clear();
		logger.info('[HardwareRegistry] Cleared all hardware');
	}

	/**
	 * Get hardware compatible with a specific tool
	 */
	getCompatibleWith(toolId: string): DetectedHardware[] {
		return this.query({ compatibleWithTool: toolId });
	}

	/**
	 * Check if a specific hardware category is available
	 */
	hasCategory(category: HardwareCategory): boolean {
		return this.getAll().some((hw) => hw.category === category && hw.status === 'connected');
	}

	/**
	 * Get SDR devices only
	 */
	getSDRs(): DetectedHardware[] {
		return this.query({ category: 'sdr', status: 'connected' });
	}

	/**
	 * Get WiFi adapters only
	 */
	getWiFiAdapters(): DetectedHardware[] {
		return this.query({ category: 'wifi', status: 'connected' });
	}

	/**
	 * Get Bluetooth adapters only
	 */
	getBluetoothAdapters(): DetectedHardware[] {
		return this.query({ category: 'bluetooth', status: 'connected' });
	}

	/**
	 * Get GPS modules only
	 */
	getGPSModules(): DetectedHardware[] {
		return this.query({ category: 'gps', status: 'connected' });
	}
}

// Global hardware registry instance
export const globalHardwareRegistry = new HardwareRegistry();
