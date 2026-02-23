/**
 * USB Hardware Detector
 * Detects SDRs, WiFi adapters, Bluetooth adapters, and other USB devices
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

import type {
	BluetoothCapabilities,
	DetectedHardware,
	HardwareCategory,
	WiFiCapabilities
} from '$lib/server/hardware/detection-types';
import { logger } from '$lib/utils/logger';

import { detectHackRF, detectRTLSDR, detectUSRP } from './usb-sdr-detectors';

const execFileAsync = promisify(execFile);

/**
 * Known USB device signatures
 */
// Safe: String literal narrowing to HardwareCategory union type — values are known constants matching the union
const _USB_DEVICE_DATABASE = {
	// SDR Devices
	'1d50:604b': { name: 'HackRF One', category: 'sdr' as HardwareCategory },
	'1d50:6089': { name: 'HackRF One', category: 'sdr' as HardwareCategory },
	'2500:0020': { name: 'USRP B200', category: 'sdr' as HardwareCategory },
	'2500:0021': { name: 'USRP B210', category: 'sdr' as HardwareCategory },
	'0bda:2832': { name: 'RTL-SDR', category: 'sdr' as HardwareCategory },
	'0bda:2838': { name: 'RTL-SDR', category: 'sdr' as HardwareCategory },
	// WiFi Adapters
	'0cf3:9271': { name: 'Atheros AR9271', category: 'wifi' as HardwareCategory },
	'148f:7601': { name: 'Ralink RT5370', category: 'wifi' as HardwareCategory },
	'148f:5370': { name: 'Ralink RT5370', category: 'wifi' as HardwareCategory },
	'0bda:8187': { name: 'Realtek RTL8187', category: 'wifi' as HardwareCategory },
	'0bda:8812': { name: 'Realtek RTL8812AU', category: 'wifi' as HardwareCategory },
	// Bluetooth Adapters
	'0a12:0001': { name: 'CSR Bluetooth', category: 'bluetooth' as HardwareCategory },
	'0cf3:e300': { name: 'Qualcomm Atheros Bluetooth', category: 'bluetooth' as HardwareCategory },
	'8087:0025': { name: 'Intel Bluetooth', category: 'bluetooth' as HardwareCategory }
};

/**
 * Parse lsusb output
 */
interface USBDevice {
	bus: string;
	device: string;
	vendorId: string;
	productId: string;
	description: string;
}

function _parseLsusb(output: string): USBDevice[] {
	const devices: USBDevice[] = [];
	const lines = output.trim().split('\n');

	for (const line of lines) {
		const match = line.match(/Bus (\d+) Device (\d+): ID ([0-9a-f]{4}):([0-9a-f]{4})\s*(.*)/i);
		if (match) {
			devices.push({
				bus: match[1],
				device: match[2],
				vendorId: match[3],
				productId: match[4],
				description: match[5] || ''
			});
		}
	}

	return devices;
}

// ── WiFi adapter detection ──

function parseWifiBands(phyOut: string): string[] {
	const bands: string[] = [];
	if (phyOut.includes('2.4 GHz') || phyOut.includes('2400 MHz')) bands.push('2.4GHz');
	if (phyOut.includes('5 GHz') || phyOut.includes('5000 MHz')) bands.push('5GHz');
	return bands;
}

function buildWifiDevice(iface: string, phyOut: string): DetectedHardware {
	const monitorMode = phyOut.includes('monitor');
	const capabilities: WiFiCapabilities = {
		interface: iface,
		hasMonitorMode: monitorMode,
		canInject: phyOut.includes('TX frame'),
		frequencyBands: parseWifiBands(phyOut),
		channels: []
	};
	return {
		id: `wifi-${iface}`,
		name: `WiFi Adapter ${iface}`,
		category: 'wifi',
		connectionType: 'usb',
		status: 'connected',
		capabilities,
		lastSeen: Date.now(),
		firstSeen: Date.now(),
		compatibleTools: monitorMode
			? ['wifi.scan.kismet', 'wifi.attack.wifite', 'wifi.recon.airodump']
			: []
	};
}

async function probeWifiInterface(iface: string): Promise<DetectedHardware | null> {
	try {
		await execFileAsync('/usr/sbin/iw', [iface, 'info']);
		const { stdout: rawPhyOut } = await execFileAsync('/usr/sbin/iw', [`phy${iface}`, 'info']);
		const phyOut = rawPhyOut.split('\n').slice(0, 50).join('\n');
		return buildWifiDevice(iface, phyOut);
	} catch {
		return null;
	}
}

/**
 * Detect WiFi adapters with monitor mode capability
 */
async function detectWiFiAdapters(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/sbin/iw', ['dev']);
		const hardware: DetectedHardware[] = [];
		const interfaceMatches = stdout.matchAll(/Interface\s+(\w+)/g);

		for (const match of interfaceMatches) {
			const device = await probeWifiInterface(match[1]);
			if (device) hardware.push(device);
		}
		return hardware;
	} catch {
		return [];
	}
}

// ── Bluetooth adapter detection ──

function buildBluetoothCapabilities(btOut: string, iface: string): BluetoothCapabilities {
	return {
		interface: iface,
		hasBleSupport: btOut.includes('LE') || btOut.includes('Low Energy'),
		hasClassicSupport: btOut.includes('BR/EDR')
	};
}

function buildDefaultBluetoothCaps(iface: string): BluetoothCapabilities {
	return { interface: iface, hasBleSupport: true, hasClassicSupport: true };
}

function buildBluetoothDevice(
	iface: string,
	capabilities: BluetoothCapabilities
): DetectedHardware {
	return {
		id: `bluetooth-${iface}`,
		name: `Bluetooth Adapter ${iface}`,
		category: 'bluetooth',
		connectionType: 'usb',
		status: 'connected',
		capabilities,
		lastSeen: Date.now(),
		firstSeen: Date.now(),
		compatibleTools: ['bluetooth.scan.bluing', 'bluetooth.recon.bluez']
	};
}

async function probeBluetoothInterface(iface: string): Promise<DetectedHardware> {
	try {
		const { stdout: btOut } = await execFileAsync('/usr/bin/bluetoothctl', ['show']);
		return buildBluetoothDevice(iface, buildBluetoothCapabilities(btOut, iface));
	} catch {
		return buildBluetoothDevice(iface, buildDefaultBluetoothCaps(iface));
	}
}

/**
 * Detect Bluetooth adapters
 */
async function detectBluetoothAdapters(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/hciconfig', []);
		const hardware: DetectedHardware[] = [];
		const deviceMatches = stdout.matchAll(/(hci\d+):\s+Type: ([^\n]+)/g);

		for (const match of deviceMatches) {
			hardware.push(await probeBluetoothInterface(match[1]));
		}
		return hardware;
	} catch {
		return [];
	}
}

/**
 * Main USB detection function
 */
export async function detectUSBDevices(): Promise<DetectedHardware[]> {
	logger.info('[USBDetector] Scanning for USB hardware...');

	const results = await Promise.allSettled([
		detectHackRF(),
		detectUSRP(),
		detectRTLSDR(),
		detectWiFiAdapters(),
		detectBluetoothAdapters()
	]);

	const allHardware: DetectedHardware[] = [];

	for (const result of results) {
		if (result.status === 'fulfilled') {
			allHardware.push(...result.value);
		}
	}

	logger.info('[USBDetector] Found USB devices', { count: allHardware.length });

	return allHardware;
}
