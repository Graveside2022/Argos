/**
 * USB SDR Hardware Detectors
 * Detects HackRF, USRP, and RTL-SDR devices via native CLI tools
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

import { DetectedHardwareSchema } from '$lib/schemas/hardware.js';
import type { DetectedHardware, SDRCapabilities } from '$lib/server/hardware/detection-types';
import { logger } from '$lib/utils/logger';

const execFileAsync = promisify(execFile);

/**
 * Detect HackRF devices via hackrf_info CLI
 */
export async function detectHackRF(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/hackrf_info', []);
		const hardware: DetectedHardware[] = [];

		const serialMatch = stdout.match(/Serial number: ([0-9a-f]+)/i);
		const firmwareMatch = stdout.match(/Firmware Version: ([^\n]+)/i);
		const partIdMatch = stdout.match(/Part ID Number: ([^\n]+)/i);

		if (serialMatch) {
			const capabilities: SDRCapabilities = {
				minFrequency: 1_000_000,
				maxFrequency: 6_000_000_000,
				sampleRate: 20_000_000,
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
		return [];
	}
}

/**
 * Detect USRP devices via uhd_find_devices CLI
 */
export async function detectUSRP(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/uhd_find_devices', []);
		const hardware: DetectedHardware[] = [];

		const lines = stdout.split('\n');
		let currentDevice: Partial<DetectedHardware> | null = null;

		for (const line of lines) {
			if (line.includes('Device Address')) {
				if (currentDevice && currentDevice.serial) {
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

		if (currentDevice && currentDevice.serial) {
			currentDevice.id = `usrp-${currentDevice.serial}`;
			currentDevice.name = currentDevice.name || 'USRP Device';
			currentDevice.manufacturer = 'Ettus Research';
			currentDevice.capabilities = {
				minFrequency: 70_000_000,
				maxFrequency: 6_000_000_000,
				sampleRate: 61_440_000,
				canTransmit: true,
				canReceive: true,
				fullDuplex: true
			};
			currentDevice.compatibleTools = ['spectrum.analysis.usrp', 'cellular.analysis.usrp'];

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
 * Detect RTL-SDR devices via rtl_test CLI
 */
export async function detectRTLSDR(): Promise<DetectedHardware[]> {
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
				minFrequency: 24_000_000,
				maxFrequency: 1_766_000_000,
				sampleRate: 2_400_000,
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
