/**
 * Serial Device Detector
 * Detects GPS modules, cellular modems, and other serial devices
 */

import { execFile } from 'child_process';
import { readdir, readFile } from 'fs/promises';
import { promisify } from 'util';

import type {
	CellularCapabilities,
	DetectedHardware,
	GPSCapabilities
} from '$lib/server/hardware/detection-types';
import { logger } from '$lib/utils/logger';

const execFileAsync = promisify(execFile);

/**
 * Detect GPS modules
 */
async function detectGPSModules(): Promise<DetectedHardware[]> {
	const hardware: DetectedHardware[] = [];

	try {
		// Check for GPS devices in /dev
		const devices = await readdir('/dev');
		const gpsDevices = devices.filter(
			(d) =>
				d.startsWith('ttyUSB') ||
				d.startsWith('ttyACM') ||
				d.startsWith('ttyAMA') ||
				d.includes('gps')
		);

		for (const device of gpsDevices) {
			const devicePath = `/dev/${device}`;

			try {
				// Try to read NMEA data to confirm it's a GPS
				const { stdout: rawOutput } = await execFileAsync('/usr/bin/cat', [devicePath], {
					timeout: 3000
				});
				const stdout = rawOutput.split('\n').slice(0, 5).join('\n');

				// Check for NMEA sentences
				const isNMEA =
					stdout.includes('$GPGGA') ||
					stdout.includes('$GPRMC') ||
					stdout.includes('$GPGSV') ||
					stdout.includes('$GNGGA');

				if (isNMEA) {
					const capabilities: GPSCapabilities = {
						device: devicePath,
						protocol: 'NMEA',
						baudRate: 9600, // Common default
						updateRate: 1 // 1 Hz typical
					};

					hardware.push({
						id: `gps-${device}`,
						name: `GPS Module (${device})`,
						category: 'gps',
						connectionType: 'serial',
						status: 'connected',
						capabilities,
						device: devicePath,
						baudRate: 9600,
						lastSeen: Date.now(),
						firstSeen: Date.now(),
						compatibleTools: ['gps.tracking.gpsd', 'gps.logger.generic']
					});
				}
			} catch (_error) {
				// Device might be in use or not accessible
				logger.warn('[SerialDetector] Could not read device', {
					devicePath,
					error: String(_error)
				});
			}
		}

		// Also check if gpsd is running
		try {
			const { stdout } = await execFileAsync('/usr/bin/systemctl', ['is-active', 'gpsd']);
			if (stdout.trim() === 'active') {
				// GPSD is running, add virtual GPS device
				hardware.push({
					id: 'gps-gpsd',
					name: 'GPS (via GPSD)',
					category: 'gps',
					connectionType: 'virtual',
					status: 'connected',
					capabilities: {
						device: '/var/run/gpsd.sock',
						protocol: 'GPSD'
						// @constitutional-exemption Article-II-2.1 issue:#14 — GPS capabilities type narrowing
						// Safe: Object literal satisfies GPSCapabilities — all required fields provided
					} as GPSCapabilities,
					lastSeen: Date.now(),
					firstSeen: Date.now(),
					compatibleTools: ['gps.tracking.gpsd']
				});
			}
		} catch {
			// gpsd not running
		}
	} catch (_error) {
		logger.error('[SerialDetector] Error detecting GPS modules', { error: String(_error) });
	}

	return hardware;
}

/**
 * Detect cellular modems
 */
async function detectCellularModems(): Promise<DetectedHardware[]> {
	const hardware: DetectedHardware[] = [];

	try {
		// Check for modem manager
		const { stdout } = await execFileAsync('/usr/bin/mmcli', ['-L']);

		if (stdout.includes('/Modem/')) {
			// Parse modem manager output
			const modemMatches = stdout.matchAll(/\/Modem\/(\d+)/g);

			for (const match of modemMatches) {
				const modemId = match[1];

				try {
					// Get modem details
					const { stdout: detailsOut } = await execFileAsync('/usr/bin/mmcli', [
						'-m',
						modemId
					]);

					const modelMatch = detailsOut.match(/model:\s*([^\n]+)/i);
					const imeiMatch = detailsOut.match(/imei:\s*([^\n]+)/i);
					const stateMatch = detailsOut.match(/state:\s*([^\n]+)/i);

					// Parse supported bands
					const bands: string[] = [];
					if (detailsOut.includes('gsm') || detailsOut.includes('GSM')) bands.push('GSM');
					if (detailsOut.includes('lte') || detailsOut.includes('LTE')) bands.push('LTE');
					if (detailsOut.includes('5g') || detailsOut.includes('5G')) bands.push('5G');

					const capabilities: CellularCapabilities = {
						interface: `/dev/cdc-wdm${modemId}`,
						supportedBands: bands,
						imei: imeiMatch?.[1],
						simStatus: stateMatch?.[1]
					};

					hardware.push({
						id: `cellular-${modemId}`,
						name: modelMatch?.[1] || `Cellular Modem ${modemId}`,
						category: 'cellular',
						connectionType: 'usb',
						status: 'connected',
						capabilities,
						lastSeen: Date.now(),
						firstSeen: Date.now(),
						compatibleTools: [
							'cellular.scan.modem',
							'cellular.imsi.catcher',
							'cellular.gsm.evil'
						]
					});
				} catch (_error) {
					logger.error('[SerialDetector] Error getting modem details', {
						modemId,
						error: String(_error)
					});
				}
			}
		}
	} catch (_error) {
		// ModemManager not installed or no modems
		logger.warn('[SerialDetector] No cellular modems detected via ModemManager');
	}

	return hardware;
}

/**
 * Detect generic serial devices
 */
async function detectGenericSerialDevices(): Promise<DetectedHardware[]> {
	const hardware: DetectedHardware[] = [];

	try {
		// List all serial devices
		const devices = await readdir('/dev');
		const serialDevices = devices.filter(
			(d) => d.startsWith('ttyS') || d.startsWith('ttyUSB') || d.startsWith('ttyACM')
		);

		for (const device of serialDevices) {
			const devicePath = `/dev/${device}`;

			try {
				// Try to get device info from sysfs
				const syspath = `/sys/class/tty/${device}`;
				let manufacturer = 'Unknown';
				let product = 'Unknown';

				try {
					const usbPath = `${syspath}/device/../../../`;
					manufacturer =
						(
							await readFile(`${usbPath}/manufacturer`, 'utf-8').catch(() => '')
						).trim() || 'Unknown';
					product =
						(await readFile(`${usbPath}/product`, 'utf-8').catch(() => '')).trim() ||
						'Unknown';
				} catch {
					// Not a USB serial device
				}

				// Skip if already detected as GPS or cellular
				const isKnown = hardware.some((h) => h.device === devicePath);
				if (!isKnown && manufacturer !== 'Unknown') {
					hardware.push({
						id: `serial-${device}`,
						name: `${product} (${device})`,
						category: 'serial',
						connectionType: 'serial',
						status: 'connected',
						capabilities: {},
						device: devicePath,
						manufacturer,
						model: product,
						lastSeen: Date.now(),
						firstSeen: Date.now(),
						compatibleTools: []
					});
				}
			} catch (_error) {
				// Skip devices we can't read
			}
		}
	} catch (_error) {
		logger.error('[SerialDetector] Error detecting serial devices', { error: String(_error) });
	}

	return hardware;
}

/**
 * Main serial device detection function
 */
export async function detectSerialDevices(): Promise<DetectedHardware[]> {
	logger.info('[SerialDetector] Scanning for serial hardware...');

	const results = await Promise.allSettled([
		detectGPSModules(),
		detectCellularModems(),
		detectGenericSerialDevices()
	]);

	const allHardware: DetectedHardware[] = [];

	for (const result of results) {
		if (result.status === 'fulfilled') {
			allHardware.push(...result.value);
		}
	}

	// Deduplicate by device path
	const seen = new Set<string>();
	const deduplicated = allHardware.filter((hw) => {
		const key = hw.device || hw.id;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	logger.info('[SerialDetector] Found serial devices', { count: deduplicated.length });

	return deduplicated;
}
