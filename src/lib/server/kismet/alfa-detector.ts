import { execFile } from 'child_process';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

import { logError, logInfo, logWarn } from '$lib/utils/logger';

const execFileAsync = promisify(execFile);

/**
 * Alfa adapter detection utilities
 */
export class AlfaDetector {
	// Common Alfa adapter USB IDs
	private static readonly ALFA_USB_IDS = {
		'0bda:8187': 'Alfa AWUS036H (RTL8187)',
		'148f:3070': 'Alfa AWUS036NH (RT3070)',
		'148f:5370': 'Alfa AWUS036NEH (RT5370)',
		'0bda:8812': 'Alfa AWUS036AC/ACH (RTL8812AU)',
		'0bda:8813': 'Alfa AWUS036ACS (RTL8813AU)',
		'2357:010c': 'Alfa AWUS036ACM (MT7612U)',
		'0e8d:7612': 'Generic MT7612U (Various brands)',
		'148f:7601': 'Alfa AWUS036N (MT7601U)',
		'148f:5572': 'Alfa AWUS052NHS (RT5572)',
		'0cf3:9271': 'Alfa AWUS036NHA (AR9271)',
		'0e8d:7961': 'MediaTek MT7921AU (WiFi 6E)',
		'0bda:a812': 'Realtek RTL8812AU (Generic)',
		'0bda:c812': 'Realtek RTL8812CU (Generic)'
	};

	/** Detect adapters via lsusb output */
	private static detectViaLsusb(): Promise<{ usbId: string; description: string }[]> {
		return execFileAsync('/usr/bin/lsusb', []).then(({ stdout }) => {
			const found: { usbId: string; description: string }[] = [];
			for (const [usbId, description] of Object.entries(this.ALFA_USB_IDS)) {
				if (stdout.includes(usbId)) {
					logInfo(`Detected Alfa adapter: ${description} (${usbId})`);
					found.push({ usbId, description });
				}
			}
			return found;
		});
	}

	/** Probe a single sysfs USB device for Alfa adapter match */
	private static async probeSysfsDevice(
		device: string
	): Promise<{ usbId: string; description: string } | null> {
		try {
			const vendor = (
				await readFile(join('/sys/bus/usb/devices/', device, 'idVendor'), 'utf-8')
			).trim();
			const product = (
				await readFile(join('/sys/bus/usb/devices/', device, 'idProduct'), 'utf-8')
			).trim();
			const usbId = `${vendor}:${product}`;
			// @constitutional-exemption Article-II-2.1 issue:#14 — USB ID dictionary lookup type narrowing
			const alfaDevice = this.ALFA_USB_IDS[usbId as keyof typeof this.ALFA_USB_IDS];
			if (!alfaDevice) return null;
			logInfo(`Detected Alfa adapter via sysfs: ${alfaDevice} (${usbId})`);
			return { usbId, description: alfaDevice };
		} catch {
			return null;
		}
	}

	/** Detect adapters via sysfs fallback */
	private static async detectViaSysfs(): Promise<{ usbId: string; description: string }[]> {
		const usbDevices = await readdir('/sys/bus/usb/devices/');
		const results = await Promise.all(usbDevices.map((d) => this.probeSysfsDevice(d)));
		return results.filter((r): r is NonNullable<typeof r> => r !== null);
	}

	/**
	 * Detect connected Alfa WiFi adapters
	 */
	static async detectAlfaAdapters(): Promise<
		{ usbId: string; description: string; interface?: string }[]
	> {
		try {
			let adapters: { usbId: string; description: string; interface?: string }[];
			try {
				adapters = await this.detectViaLsusb();
			} catch {
				logWarn('lsusb not available, trying sysfs method');
				adapters = await this.detectViaSysfs();
			}

			for (const adapter of adapters) {
				const iface = await this.findInterfaceForAdapter(adapter.usbId);
				if (iface) adapter.interface = iface;
			}
			return adapters;
		} catch (error) {
			logError('Error detecting Alfa adapters:', error as Record<string, unknown>);
			return [];
		}
	}

	/** Interfaces to skip when searching for external WiFi adapters */
	private static readonly SKIP_INTERFACES = new Set(['lo', 'eth0', 'wlan0']);

	/** Check if a network interface is wireless */
	private static async isWirelessInterface(iface: string): Promise<boolean> {
		const wirelessPath = join('/sys/class/net/', iface, 'wireless');
		const phy80211Path = join('/sys/class/net/', iface, 'phy80211');
		return Promise.any([
			readdir(wirelessPath).then(() => true),
			readdir(phy80211Path).then(() => true)
		]).catch(() => false);
	}

	/** List non-skipped network interfaces */
	private static async listCandidateInterfaces(): Promise<string[]> {
		try {
			const all = await readdir('/sys/class/net/');
			return all.filter((iface) => !this.SKIP_INTERFACES.has(iface));
		} catch (error) {
			logError('Error finding network interfaces:', error as Record<string, unknown>);
			return [];
		}
	}

	/**
	 * Find network interface for a USB adapter
	 */
	private static async findInterfaceForAdapter(_usbId: string): Promise<string | null> {
		const candidates = await this.listCandidateInterfaces();
		for (const iface of candidates) {
			if (await this.isWirelessInterface(iface)) {
				logInfo(`Found wireless interface: ${iface}`);
				return iface;
			}
		}
		return null;
	}

	/**
	 * Get the first available Alfa interface
	 */
	static async getAlfaInterface(): Promise<string | null> {
		const adapters = await this.detectAlfaAdapters();

		if (adapters.length === 0) {
			logWarn('No Alfa adapters detected');
			return null;
		}

		// Return the first adapter with an interface
		for (const adapter of adapters) {
			if (adapter.interface) {
				logInfo(`Selected Alfa interface: ${adapter.interface} (${adapter.description})`);
				return adapter.interface;
			}
		}

		logWarn('Alfa adapter detected but no interface found');
		return null;
	}

	/**
	 * Check if a specific interface is an Alfa adapter
	 */
	static async isAlfaInterface(iface: string): Promise<boolean> {
		const adapters = await this.detectAlfaAdapters();
		return adapters.some((adapter) => adapter.interface === iface);
	}
}
