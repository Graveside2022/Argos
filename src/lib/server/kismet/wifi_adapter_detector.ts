import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile, readlink } from 'fs/promises';
import { join } from 'path';
import { logInfo, logWarn, logError } from '$lib/utils/logger';

const execAsync = promisify(exec);

export interface WiFiAdapter {
	interface: string;
	macAddress?: string;
	state?: string;
	type: 'usb' | 'internal';
	usbId?: string;
	description?: string;
	monitorModeCapable?: boolean;
}

/**
 * Generic WiFi adapter detection utilities
 */
export class WiFiAdapterDetector {
	// Interfaces to protect (never use these)
	private static readonly PROTECTED_INTERFACES = ['wlan0'];

	// Known good USB WiFi chipsets for monitor mode
	private static readonly MONITOR_MODE_CHIPSETS = {
		// Realtek
		'0bda:8187': 'RTL8187',
		'0bda:8812': 'RTL8812AU',
		'0bda:8813': 'RTL8813AU',
		// Ralink/MediaTek
		'148f:3070': 'RT3070',
		'148f:5370': 'RT5370',
		'148f:5572': 'RT5572',
		'148f:7601': 'MT7601U',
		'0e8d:7612': 'MT7612U',
		'2357:010c': 'MT7612U',
		// Atheros
		'0cf3:9271': 'AR9271',
		'0cf3:7015': 'AR7015',
		// Intel (some support monitor mode)
		'8086:24fb': 'Intel Dual Band Wireless-AC',
		'8086:24fd': 'Intel Wireless 8265/8275'
	};

	/**
	 * Detect all WiFi adapters in the system
	 */
	static async detectAllWiFiAdapters(): Promise<WiFiAdapter[]> {
		const adapters: WiFiAdapter[] = [];

		try {
			const interfaces = await readdir('/sys/class/net/');

			for (const iface of interfaces) {
				// Skip non-network interfaces
				if (['lo', 'eth0'].includes(iface)) {
					continue;
				}

				const ifacePath = join('/sys/class/net/', iface);

				// Check if it's a wireless interface
				const isWireless = await this.isWirelessInterface(ifacePath);
				if (!isWireless) {
					continue;
				}

				// Skip protected interfaces
				if (this.PROTECTED_INTERFACES.includes(iface)) {
					logWarn(`Skipping protected interface: ${iface}`);
					continue;
				}

				// Get adapter details
				const adapter: WiFiAdapter = {
					interface: iface,
					type: 'internal'
				};

				// Get MAC address
				try {
					adapter.macAddress = (
						await readFile(join(ifacePath, 'address'), 'utf-8')
					).trim();
				} catch (_e) {
					/* expected */
				}

				// Get operational state
				try {
					adapter.state = (await readFile(join(ifacePath, 'operstate'), 'utf-8')).trim();
				} catch (_e) {
					/* expected */
				}

				// Check if it's a USB adapter
				try {
					const deviceLink = await readlink(ifacePath);
					if (deviceLink.includes('usb')) {
						adapter.type = 'usb';

						// Try to get USB ID
						const usbInfo = await this.getUSBInfo(ifacePath);
						if (usbInfo) {
							adapter.usbId = usbInfo.usbId;
							adapter.description = usbInfo.description;
							adapter.monitorModeCapable = usbInfo.monitorModeCapable;
						}
					}
				} catch (_e) {
					/* expected */
				}

				// Check monitor mode capability
				if (adapter.monitorModeCapable === undefined) {
					adapter.monitorModeCapable = await this.checkMonitorModeSupport(iface);
				}

				adapters.push(adapter);
				logInfo(
					`Detected WiFi adapter: ${iface} (${adapter.type}, MAC: ${adapter.macAddress})`
				);
			}
		} catch (error) {
			logError('Error detecting WiFi adapters:', error as Record<string, unknown>);
		}

		return adapters;
	}

	/**
	 * Check if a path represents a wireless interface
	 */
	private static async isWirelessInterface(ifacePath: string): Promise<boolean> {
		try {
			// Check for wireless or phy80211 directory
			await Promise.any([
				readdir(join(ifacePath, 'wireless')),
				readdir(join(ifacePath, 'phy80211'))
			]);
			return true;
		} catch (_error: unknown) {
			return false;
		}
	}

	/**
	 * Get USB information for an interface
	 */
	private static async getUSBInfo(
		ifacePath: string
	): Promise<{ usbId: string; description?: string; monitorModeCapable?: boolean } | null> {
		try {
			const devicePath = join(ifacePath, 'device');
			const deviceLink = await readlink(devicePath);

			// Navigate to USB device directory
			const usbPath = join(devicePath, deviceLink, '..');

			const vendor = (await readFile(join(usbPath, 'idVendor'), 'utf-8')).trim();
			const product = (await readFile(join(usbPath, 'idProduct'), 'utf-8')).trim();
			const usbId = `${vendor}:${product}`;

			// Check if it's a known good chipset
			const description =
				this.MONITOR_MODE_CHIPSETS[usbId as keyof typeof this.MONITOR_MODE_CHIPSETS];
			const monitorModeCapable = !!description;

			return { usbId, description, monitorModeCapable };
		} catch (_error: unknown) {
			return null;
		}
	}

	/**
	 * Check if an interface supports monitor mode
	 */
	private static async checkMonitorModeSupport(iface: string): Promise<boolean> {
		try {
			// Try using iw
			const { stdout } = await execAsync(
				`iw phy $(cat /sys/class/net/${iface}/phy80211/name) info 2>/dev/null`
			);
			if (stdout.includes('monitor')) {
				return true;
			}
		} catch (_error: unknown) {
			/* expected */
		}

		// If we can't determine, assume USB adapters might support it
		return true;
	}

	/**
	 * Get the best available WiFi interface for monitoring
	 */
	static async getBestMonitorInterface(): Promise<string | null> {
		const adapters = await this.detectAllWiFiAdapters();

		if (adapters.length === 0) {
			logWarn('No WiFi adapters available for monitoring');
			return null;
		}

		// Prefer USB adapters with known good chipsets
		const usbAdapters = adapters.filter((a) => a.type === 'usb' && a.monitorModeCapable);
		if (usbAdapters.length > 0) {
			logInfo(
				`Selected USB WiFi adapter: ${usbAdapters[0].interface} (${usbAdapters[0].description || 'Unknown chipset'})`
			);
			return usbAdapters[0].interface;
		}

		// Fall back to any USB adapter
		const anyUsbAdapter = adapters.find((a) => a.type === 'usb');
		if (anyUsbAdapter) {
			logInfo(`Selected USB WiFi adapter: ${anyUsbAdapter.interface}`);
			return anyUsbAdapter.interface;
		}

		// Last resort: any available adapter
		logInfo(`Selected WiFi adapter: ${adapters[0].interface}`);
		return adapters[0].interface;
	}

	/**
	 * List all available WiFi adapters (for user selection)
	 */
	static async listAvailableAdapters(): Promise<WiFiAdapter[]> {
		const adapters = await this.detectAllWiFiAdapters();
		return adapters.sort((a, b) => {
			// Sort by: USB first, then monitor-capable, then by name
			if (a.type !== b.type) return a.type === 'usb' ? -1 : 1;
			if (a.monitorModeCapable !== b.monitorModeCapable) return a.monitorModeCapable ? -1 : 1;
			return a.interface.localeCompare(b.interface);
		});
	}
}
