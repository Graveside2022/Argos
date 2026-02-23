/**
 * USB SDR Hardware Detectors
 * Detects HackRF, USRP, and RTL-SDR devices via native CLI tools
 */

import { DetectedHardwareSchema } from '$lib/schemas/hardware.js';
import { execFileAsync } from '$lib/server/exec';
import type { DetectedHardware, SDRCapabilities } from '$lib/server/hardware/detection-types';
import { logger } from '$lib/utils/logger';

// ── HackRF detection ──

const HACKRF_CAPABILITIES: SDRCapabilities = {
	minFrequency: 1_000_000,
	maxFrequency: 6_000_000_000,
	sampleRate: 20_000_000,
	bandwidth: 20_000_000,
	canTransmit: true,
	canReceive: true,
	fullDuplex: false
};

function resolveHackrfProductId(partIdMatch: RegExpMatchArray | null): string {
	const partId = partIdMatch?.[1] || '';
	return partId.includes('604b') ? '604b' : '6089';
}

function buildHackrfDevice(
	serial: string,
	firmware: RegExpMatchArray | null,
	partId: RegExpMatchArray | null
): DetectedHardware {
	return {
		id: `hackrf-${serial}`,
		name: 'HackRF One',
		category: 'sdr',
		connectionType: 'usb',
		status: 'connected',
		capabilities: HACKRF_CAPABILITIES,
		serial,
		manufacturer: 'Great Scott Gadgets',
		model: 'HackRF One',
		firmwareVersion: firmware?.[1],
		vendorId: '1d50',
		productId: resolveHackrfProductId(partId),
		lastSeen: Date.now(),
		firstSeen: Date.now(),
		compatibleTools: [
			'spectrum.analysis.hackrf',
			'wifi.analysis.hackrf',
			'cellular.analysis.hackrf'
		]
	};
}

/**
 * Detect HackRF devices via hackrf_info CLI
 */
export async function detectHackRF(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/hackrf_info', []);
		const serialMatch = stdout.match(/Serial number: ([0-9a-f]+)/i);
		if (!serialMatch) return [];

		const firmwareMatch = stdout.match(/Firmware Version: ([^\n]+)/i);
		const partIdMatch = stdout.match(/Part ID Number: ([^\n]+)/i);
		return [buildHackrfDevice(serialMatch[1], firmwareMatch, partIdMatch)];
	} catch {
		return [];
	}
}

// ── USRP detection ──

const USRP_CAPABILITIES: SDRCapabilities = {
	minFrequency: 70_000_000,
	maxFrequency: 6_000_000_000,
	sampleRate: 61_440_000,
	canTransmit: true,
	canReceive: true,
	fullDuplex: true
};

function parseUSRPLineFields(line: string, device: Partial<DetectedHardware>): void {
	const serialMatch = line.match(/serial:\s*([A-F0-9]+)/i);
	const typeMatch = line.match(/type:\s*([^\n,]+)/i);
	const nameMatch = line.match(/name:\s*([^\n,]+)/i);

	if (serialMatch) device.serial = serialMatch[1];
	if (typeMatch) device.model = typeMatch[1];
	if (nameMatch) device.name = nameMatch[1];
}

function finalizeUSRPDevice(device: Partial<DetectedHardware>): void {
	device.id = `usrp-${device.serial}`;
	device.name = device.name || 'USRP Device';
	device.manufacturer = 'Ettus Research';
	device.capabilities = USRP_CAPABILITIES;
	device.compatibleTools = ['spectrum.analysis.usrp', 'cellular.analysis.usrp'];
}

function validateAndPush(device: Partial<DetectedHardware>, hardware: DetectedHardware[]): void {
	const result = DetectedHardwareSchema.safeParse(device);
	if (result.success) {
		hardware.push(result.data);
	} else {
		logger.error('[usb-detector] Invalid USRP device data, skipping', {
			device,
			errors: result.error.format()
		});
	}
}

function createEmptyUSRPDevice(): Partial<DetectedHardware> {
	return {
		category: 'sdr',
		connectionType: 'usb',
		status: 'connected',
		lastSeen: Date.now(),
		firstSeen: Date.now()
	};
}

function processUSRPLine(
	line: string,
	current: Partial<DetectedHardware> | null,
	hardware: DetectedHardware[]
): Partial<DetectedHardware> | null {
	if (line.includes('Device Address')) {
		if (current?.serial) validateAndPush(current, hardware);
		return createEmptyUSRPDevice();
	}
	if (current) parseUSRPLineFields(line, current);
	return current;
}

function parseUSRPOutput(stdout: string): DetectedHardware[] {
	const hardware: DetectedHardware[] = [];
	let current: Partial<DetectedHardware> | null = null;

	for (const line of stdout.split('\n')) {
		current = processUSRPLine(line, current, hardware);
	}
	if (current?.serial) {
		finalizeUSRPDevice(current);
		validateAndPush(current, hardware);
	}
	return hardware;
}

/**
 * Detect USRP devices via uhd_find_devices CLI
 */
export async function detectUSRP(): Promise<DetectedHardware[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/uhd_find_devices', []);
		return parseUSRPOutput(stdout);
	} catch {
		return [];
	}
}

// ── RTL-SDR detection ──

const RTLSDR_CAPABILITIES: SDRCapabilities = {
	minFrequency: 24_000_000,
	maxFrequency: 1_766_000_000,
	sampleRate: 2_400_000,
	canTransmit: false,
	canReceive: true
};

function buildRtlsdrDevice(match: RegExpMatchArray): DetectedHardware {
	return {
		id: `rtlsdr-${match[4]}`,
		name: `RTL-SDR ${match[2]}`,
		category: 'sdr',
		connectionType: 'usb',
		status: 'connected',
		capabilities: RTLSDR_CAPABILITIES,
		serial: match[4],
		manufacturer: match[2],
		model: match[3],
		lastSeen: Date.now(),
		firstSeen: Date.now(),
		compatibleTools: ['spectrum.analysis.rtlsdr', 'adsb.analysis.rtlsdr']
	};
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
		const deviceMatches = stdout.matchAll(/(\d+):\s+([^,]+),\s+([^,]+),\s+SN:\s*([^\n]+)/g);
		return Array.from(deviceMatches).map(buildRtlsdrDevice);
	} catch {
		return [];
	}
}
