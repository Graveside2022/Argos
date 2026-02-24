/**
 * Serial Device Detector
 * Detects GPS modules, cellular modems, and other serial devices
 */

import { readdir, readFile } from 'fs/promises';

import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import type {
	CellularCapabilities,
	DetectedHardware,
	GPSCapabilities
} from '$lib/server/hardware/detection-types';
import { logger } from '$lib/utils/logger';

// ── GPS detection helpers ──

function isGpsDeviceName(name: string): boolean {
	return (
		name.startsWith('ttyUSB') ||
		name.startsWith('ttyACM') ||
		name.startsWith('ttyAMA') ||
		name.includes('gps')
	);
}

function isNmeaOutput(stdout: string): boolean {
	return (
		stdout.includes('$GPGGA') ||
		stdout.includes('$GPRMC') ||
		stdout.includes('$GPGSV') ||
		stdout.includes('$GNGGA')
	);
}

function buildGpsDevice(device: string, devicePath: string): DetectedHardware {
	const capabilities: GPSCapabilities = {
		device: devicePath,
		protocol: 'NMEA',
		baudRate: 9600,
		updateRate: 1
	};
	return {
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
	};
}

async function probeGpsDevice(device: string): Promise<DetectedHardware | null> {
	const devicePath = `/dev/${device}`;
	try {
		const { stdout: rawOutput } = await execFileAsync('/usr/bin/cat', [devicePath], {
			timeout: 3000
		});
		const stdout = rawOutput.split('\n').slice(0, 5).join('\n');
		return isNmeaOutput(stdout) ? buildGpsDevice(device, devicePath) : null;
	} catch (_error) {
		logger.warn('[SerialDetector] Could not read device', {
			devicePath,
			error: String(_error)
		});
		return null;
	}
}

function buildGpsdVirtualDevice(): DetectedHardware {
	return {
		id: 'gps-gpsd',
		name: 'GPS (via GPSD)',
		category: 'gps',
		connectionType: 'virtual',
		status: 'connected',
		capabilities: {
			device: env.GPSD_SOCKET_PATH,
			protocol: 'GPSD'
			// @constitutional-exemption Article-II-2.1 issue:#14
		} as GPSCapabilities,
		lastSeen: Date.now(),
		firstSeen: Date.now(),
		compatibleTools: ['gps.tracking.gpsd']
	};
}

async function checkGpsdRunning(): Promise<DetectedHardware | null> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/systemctl', ['is-active', 'gpsd']);
		return stdout.trim() === 'active' ? buildGpsdVirtualDevice() : null;
	} catch {
		return null;
	}
}

async function detectGPSModules(): Promise<DetectedHardware[]> {
	const hardware: DetectedHardware[] = [];
	try {
		const devices = await readdir('/dev');
		const gpsDevices = devices.filter(isGpsDeviceName);

		for (const device of gpsDevices) {
			const result = await probeGpsDevice(device);
			if (result) hardware.push(result);
		}

		const gpsdDevice = await checkGpsdRunning();
		if (gpsdDevice) hardware.push(gpsdDevice);
	} catch (_error) {
		logger.error('[SerialDetector] Error detecting GPS modules', { error: String(_error) });
	}
	return hardware;
}

// ── Cellular modem detection helpers ──

function parseCellularBands(detailsOut: string): string[] {
	const bands: string[] = [];
	const lower = detailsOut.toLowerCase();
	if (lower.includes('gsm')) bands.push('GSM');
	if (lower.includes('lte')) bands.push('LTE');
	if (lower.includes('5g')) bands.push('5G');
	return bands;
}

function buildCellularDevice(modemId: string, detailsOut: string): DetectedHardware {
	const modelMatch = detailsOut.match(/model:\s*([^\n]+)/i);
	const imeiMatch = detailsOut.match(/imei:\s*([^\n]+)/i);
	const stateMatch = detailsOut.match(/state:\s*([^\n]+)/i);
	const capabilities: CellularCapabilities = {
		interface: `/dev/cdc-wdm${modemId}`,
		supportedBands: parseCellularBands(detailsOut),
		imei: imeiMatch?.[1],
		simStatus: stateMatch?.[1]
	};
	return {
		id: `cellular-${modemId}`,
		name: modelMatch?.[1] || `Cellular Modem ${modemId}`,
		category: 'cellular',
		connectionType: 'usb',
		status: 'connected',
		capabilities,
		lastSeen: Date.now(),
		firstSeen: Date.now(),
		compatibleTools: ['cellular.scan.modem', 'cellular.imsi.catcher', 'cellular.gsm.evil']
	};
}

async function probeModem(modemId: string): Promise<DetectedHardware | null> {
	try {
		const { stdout: detailsOut } = await execFileAsync('/usr/bin/mmcli', ['-m', modemId]);
		return buildCellularDevice(modemId, detailsOut);
	} catch (_error) {
		logger.error('[SerialDetector] Error getting modem details', {
			modemId,
			error: String(_error)
		});
		return null;
	}
}

async function detectCellularModems(): Promise<DetectedHardware[]> {
	const hardware: DetectedHardware[] = [];
	try {
		const { stdout } = await execFileAsync('/usr/bin/mmcli', ['-L']);
		if (!stdout.includes('/Modem/')) return hardware;

		const modemMatches = stdout.matchAll(/\/Modem\/(\d+)/g);
		for (const match of modemMatches) {
			const device = await probeModem(match[1]);
			if (device) hardware.push(device);
		}
	} catch {
		logger.warn('[SerialDetector] No cellular modems detected via ModemManager');
	}
	return hardware;
}

// ── Generic serial device detection helpers ──

async function readUsbInfo(syspath: string): Promise<{ manufacturer: string; product: string }> {
	const usbPath = `${syspath}/device/../../../`;
	const manufacturer =
		(await readFile(`${usbPath}/manufacturer`, 'utf-8').catch(() => '')).trim() || 'Unknown';
	const product =
		(await readFile(`${usbPath}/product`, 'utf-8').catch(() => '')).trim() || 'Unknown';
	return { manufacturer, product };
}

function isSerialDeviceName(name: string): boolean {
	return name.startsWith('ttyS') || name.startsWith('ttyUSB') || name.startsWith('ttyACM');
}

async function probeSerialDevice(device: string): Promise<DetectedHardware | null> {
	const devicePath = `/dev/${device}`;
	try {
		const info = await readUsbInfo(`/sys/class/tty/${device}`);
		if (info.manufacturer === 'Unknown') return null;
		return {
			id: `serial-${device}`,
			name: `${info.product} (${device})`,
			category: 'serial',
			connectionType: 'serial',
			status: 'connected',
			capabilities: {},
			device: devicePath,
			manufacturer: info.manufacturer,
			model: info.product,
			lastSeen: Date.now(),
			firstSeen: Date.now(),
			compatibleTools: []
		};
	} catch {
		return null;
	}
}

async function detectGenericSerialDevices(): Promise<DetectedHardware[]> {
	const hardware: DetectedHardware[] = [];
	try {
		const devices = await readdir('/dev');
		for (const device of devices.filter(isSerialDeviceName)) {
			const result = await probeSerialDevice(device);
			if (result) hardware.push(result);
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
