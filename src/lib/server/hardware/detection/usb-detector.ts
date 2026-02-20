/**
 * USB Hardware Detector
 * Detects SDRs, WiFi adapters, Bluetooth adapters, and other USB devices
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

import { DetectedHardwareSchema } from '$lib/schemas/hardware.js';
import type {
	BluetoothCapabilities,
	DetectedHardware,
	HardwareCategory,
	SDRCapabilities,
	WiFiCapabilities
} from '$lib/server/hardware/detection-types';
import { logger } from '$lib/utils/logger';

const execFileAsync = promisify(execFile);

/**
 * Known USB device signatures
 */
// Safe: String literal narrowing to HardwareCategory union type — values are known constants matching the union
const _USB_DEVICE_DATABASE = {
	// SDR Devices
	'1d50:604b': { name: 'HackRF One', category: 'sdr' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'1d50:6089': { name: 'HackRF One', category: 'sdr' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'2500:0020': { name: 'USRP B200', category: 'sdr' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'2500:0021': { name: 'USRP B210', category: 'sdr' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'0bda:2832': { name: 'RTL-SDR', category: 'sdr' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'0bda:2838': { name: 'RTL-SDR', category: 'sdr' as HardwareCategory }, // Safe: string literal matches HardwareCategory union

	// WiFi Adapters
	'0cf3:9271': { name: 'Atheros AR9271', category: 'wifi' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'148f:7601': { name: 'Ralink RT5370', category: 'wifi' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'148f:5370': { name: 'Ralink RT5370', category: 'wifi' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'0bda:8187': { name: 'Realtek RTL8187', category: 'wifi' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'0bda:8812': { name: 'Realtek RTL8812AU', category: 'wifi' as HardwareCategory }, // Safe: string literal matches HardwareCategory union

	// Bluetooth Adapters
	'0a12:0001': { name: 'CSR Bluetooth', category: 'bluetooth' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'0cf3:e300': { name: 'Qualcomm Atheros Bluetooth', category: 'bluetooth' as HardwareCategory }, // Safe: string literal matches HardwareCategory union
	'8087:0025': { name: 'Intel Bluetooth', category: 'bluetooth' as HardwareCategory } // Safe: string literal matches HardwareCategory union
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
		// Format: Bus 001 Device 004: ID 1d50:604b Great Scott Gadgets HackRF One SDR
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

/**
 * Detect HackRF devices
 */
async function detectHackRF(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/hackrf_info', []);
		const hardware: DetectedHardware[] = [];

		// Parse hackrf_info output
		const serialMatch = stdout.match(/Serial number: ([0-9a-f]+)/i);
		const firmwareMatch = stdout.match(/Firmware Version: ([^\n]+)/i);
		const partIdMatch = stdout.match(/Part ID Number: ([^\n]+)/i);

		if (serialMatch) {
			const capabilities: SDRCapabilities = {
				minFrequency: 1_000_000, // 1 MHz
				maxFrequency: 6_000_000_000, // 6 GHz
				sampleRate: 20_000_000, // 20 Msps
				bandwidth: 20_000_000,
				canTransmit: true,
				canReceive: true,
				fullDuplex: false
			};

			hardware.push({
				id: `hackrf-${serialMatch[1]}`,
				name: 'HackRF One',
				category: 'sdr',
				connectionType: 'usb',
				status: 'connected',
				capabilities,
				serial: serialMatch[1],
				manufacturer: 'Great Scott Gadgets',
				model: 'HackRF One',
				firmwareVersion: firmwareMatch?.[1],
				vendorId: '1d50',
				productId: partIdMatch?.[1]?.includes('604b') ? '604b' : '6089',
				lastSeen: Date.now(),
				firstSeen: Date.now(),
				compatibleTools: [
					'spectrum.analysis.hackrf',
					'wifi.analysis.hackrf',
					'cellular.analysis.hackrf'
				]
			});
		}

		return hardware;
	} catch (_error) {
		// HackRF not detected or hackrf_info not installed
		return [];
	}
}

/**
 * Detect USRP devices
 */
async function detectUSRP(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/uhd_find_devices', []);
		const hardware: DetectedHardware[] = [];

		// Parse uhd_find_devices output
		const lines = stdout.split('\n');
		let currentDevice: Partial<DetectedHardware> | null = null;

		for (const line of lines) {
			if (line.includes('Device Address')) {
				if (currentDevice && currentDevice.serial) {
					// Runtime validation with Zod (replaces unsafe type assertion)
					const result = DetectedHardwareSchema.safeParse(currentDevice);
					if (result.success) {
						hardware.push(result.data);
					} else {
						logger.error('[usb-detector] Invalid USRP device data, skipping', {
							device: currentDevice,
							errors: result.error.format()
						});
					}
				}
				currentDevice = {
					category: 'sdr',
					connectionType: 'usb',
					status: 'connected',
					lastSeen: Date.now(),
					firstSeen: Date.now()
				};
			} else if (currentDevice) {
				const serialMatch = line.match(/serial:\s*([A-F0-9]+)/i);
				const typeMatch = line.match(/type:\s*([^\n,]+)/i);
				const nameMatch = line.match(/name:\s*([^\n,]+)/i);

				if (serialMatch) currentDevice.serial = serialMatch[1];
				if (typeMatch) currentDevice.model = typeMatch[1];
				if (nameMatch) currentDevice.name = nameMatch[1];
			}
		}

		// Add last device
		if (currentDevice && currentDevice.serial) {
			currentDevice.id = `usrp-${currentDevice.serial}`;
			currentDevice.name = currentDevice.name || 'USRP Device';
			currentDevice.manufacturer = 'Ettus Research';
			currentDevice.capabilities = {
				minFrequency: 70_000_000, // Varies by model
				maxFrequency: 6_000_000_000,
				sampleRate: 61_440_000, // Varies by model
				canTransmit: true,
				canReceive: true,
				fullDuplex: true
			};
			currentDevice.compatibleTools = ['spectrum.analysis.usrp', 'cellular.analysis.usrp'];

			// Runtime validation with Zod (replaces unsafe type assertion)
			const result = DetectedHardwareSchema.safeParse(currentDevice);
			if (result.success) {
				hardware.push(result.data);
			} else {
				logger.error('[usb-detector] Invalid USRP device data (last device), skipping', {
					device: currentDevice,
					errors: result.error.format()
				});
			}
		}

		return hardware;
	} catch (_error) {
		return [];
	}
}

/**
 * Detect RTL-SDR devices
 */
async function detectRTLSDR(): Promise<DetectedHardware[]> {
	try {
		const { stdout: rawOutput } = await execFileAsync('/usr/bin/rtl_test', ['-t'], {
			timeout: 5000
		});
		const stdout = rawOutput.split('\n').slice(0, 20).join('\n');
		const hardware: DetectedHardware[] = [];

		const _indexMatch = stdout.matchAll(/Found \d+ device\(s\):/g);
		const deviceMatches = stdout.matchAll(/(\d+):\s+([^,]+),\s+([^,]+),\s+SN:\s*([^\n]+)/g);

		for (const match of deviceMatches) {
			const capabilities: SDRCapabilities = {
				minFrequency: 24_000_000, // 24 MHz
				maxFrequency: 1_766_000_000, // 1.766 GHz
				sampleRate: 2_400_000, // 2.4 Msps
				canTransmit: false,
				canReceive: true
			};

			hardware.push({
				id: `rtlsdr-${match[4]}`,
				name: `RTL-SDR ${match[2]}`,
				category: 'sdr',
				connectionType: 'usb',
				status: 'connected',
				capabilities,
				serial: match[4],
				manufacturer: match[2],
				model: match[3],
				lastSeen: Date.now(),
				firstSeen: Date.now(),
				compatibleTools: ['spectrum.analysis.rtlsdr', 'adsb.analysis.rtlsdr']
			});
		}

		return hardware;
	} catch (_error) {
		return [];
	}
}

/**
 * Detect WiFi adapters with monitor mode capability
 */
async function detectWiFiAdapters(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/sbin/iw', ['dev']);
		const hardware: DetectedHardware[] = [];

		// Parse iw dev output
		const interfaceMatches = stdout.matchAll(/Interface\s+(\w+)/g);

		for (const match of interfaceMatches) {
			const iface = match[1];

			try {
				// Check if interface supports monitor mode
				const { stdout: _infoOut } = await execFileAsync('/usr/sbin/iw', [iface, 'info']);
				const { stdout: rawPhyOut } = await execFileAsync('/usr/sbin/iw', [
					`phy${iface}`,
					'info'
				]);
				const phyOut = rawPhyOut.split('\n').slice(0, 50).join('\n');

				// Check for monitor mode support
				const monitorMode = phyOut.includes('monitor');
				const injection = phyOut.includes('TX frame');

				// Get frequency bands
				const bands: string[] = [];
				if (phyOut.includes('2.4 GHz') || phyOut.includes('2400 MHz')) bands.push('2.4GHz');
				if (phyOut.includes('5 GHz') || phyOut.includes('5000 MHz')) bands.push('5GHz');

				const capabilities: WiFiCapabilities = {
					interface: iface,
					hasMonitorMode: monitorMode,
					canInject: injection,
					frequencyBands: bands,
					channels: [] // Would need to parse channels from phy info
				};

				hardware.push({
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
				});
			} catch {
				// Interface info failed, skip
			}
		}

		return hardware;
	} catch (_error) {
		return [];
	}
}

/**
 * Detect Bluetooth adapters
 */
async function detectBluetoothAdapters(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/hciconfig', []);
		const hardware: DetectedHardware[] = [];

		// Parse hciconfig output
		const deviceMatches = stdout.matchAll(/(hci\d+):\s+Type: ([^\n]+)/g);

		for (const match of deviceMatches) {
			const iface = match[1];

			try {
				// Get more details with bluetoothctl
				const { stdout: btOut } = await execFileAsync('/usr/bin/bluetoothctl', ['show']);

				const bleSupport = btOut.includes('LE') || btOut.includes('Low Energy');
				const classicSupport = btOut.includes('BR/EDR');

				const capabilities: BluetoothCapabilities = {
					interface: iface,
					hasBleSupport: bleSupport,
					hasClassicSupport: classicSupport
				};

				hardware.push({
					id: `bluetooth-${iface}`,
					name: `Bluetooth Adapter ${iface}`,
					category: 'bluetooth',
					connectionType: 'usb',
					status: 'connected',
					capabilities,
					lastSeen: Date.now(),
					firstSeen: Date.now(),
					compatibleTools: ['bluetooth.scan.bluing', 'bluetooth.recon.bluez']
				});
			} catch {
				// bluetoothctl failed, use basic info
				hardware.push({
					id: `bluetooth-${iface}`,
					name: `Bluetooth Adapter ${iface}`,
					category: 'bluetooth',
					connectionType: 'usb',
					status: 'connected',
					// Safe: Object literal satisfies BluetoothCapabilities — all required fields provided
					capabilities: {
						interface: iface,
						hasBleSupport: true,
						hasClassicSupport: true
						// Safe: Object literal satisfies BluetoothCapabilities — all required fields provided
					} as BluetoothCapabilities,
					lastSeen: Date.now(),
					firstSeen: Date.now()
				});
			}
		}

		return hardware;
	} catch (_error) {
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
