/**
 * Pure helpers for hardware-details-service.ts — USB sysfs readers,
 * regex parsers, and device-specific detection logic.
 */
import { readdir, readFile, readlink } from 'fs/promises';
import { createConnection } from 'net';

import { execFileAsync } from '$lib/server/exec';

/** Run a command safely via execFile — no shell interpretation */
export async function run(binary: string, args: string[]): Promise<string> {
	try {
		const { stdout } = await execFileAsync(binary, args, { timeout: 5000 });
		return stdout.trim();
	} catch {
		return '';
	}
}

/** Read a sysfs file */
export async function sysRead(path: string): Promise<string> {
	try {
		return (await readFile(path, 'utf-8')).trim();
	} catch {
		return '';
	}
}

/** Resolve a sysfs symlink and return the final component */
export async function sysLink(path: string): Promise<string> {
	try {
		const link = await readlink(path);
		return link.split('/').pop() || '';
	} catch {
		return '';
	}
}

/** List top-level USB device paths (e.g. /sys/bus/usb/devices/1-2) */
export async function listUsbDevices(): Promise<string[]> {
	try {
		const entries = await readdir('/sys/bus/usb/devices');
		return entries
			.filter((e) => /^\d+-\d+(\.\d+)*$/.test(e))
			.map((e) => `/sys/bus/usb/devices/${e}`);
	} catch {
		return [];
	}
}

/** Find a USB device path by vendor:product ID */
export async function findUsbDevice(vendorId: string, productId: string): Promise<string | null> {
	const devices = await listUsbDevices();
	for (const dev of devices) {
		const vendor = await sysRead(`${dev}/idVendor`);
		const product = await sysRead(`${dev}/idProduct`);
		if (vendor === vendorId && product === productId) return dev;
	}
	return null;
}

/** Read USB manufacturer and product strings from a device path */
export async function readUsbIdentity(
	devPath: string
): Promise<{ manufacturer: string; product: string }> {
	return {
		manufacturer: await sysRead(`${devPath}/manufacturer`),
		product: await sysRead(`${devPath}/product`)
	};
}

// ── WiFi helpers ──

/** Known WiFi adapter USB driver patterns */
const WIFI_DRIVER_PATTERN = /mt79|mt76|rtl8|ath9k/i;

export function isWifiDriver(driver: string): boolean {
	return WIFI_DRIVER_PATTERN.test(driver);
}

/** Map kernel driver name to human-readable chipset */
const DRIVER_CHIPSET_MAP: [RegExp, (d: string) => string][] = [
	[/^mt7921u$/, () => 'MediaTek MT7921AU'],
	[/^mt76/, (d) => `MediaTek ${d.toUpperCase()}`],
	[/^rtl/, (d) => `Realtek ${d.toUpperCase()}`]
];

export function mapDriverToChipset(driver: string): string {
	if (!driver) return '';
	for (const [pattern, formatter] of DRIVER_CHIPSET_MAP) {
		if (pattern.test(driver)) return formatter(driver);
	}
	return driver.toUpperCase();
}

/** Parse channel string from regex match groups */
export function formatChannel(match: RegExpMatchArray): string {
	return `Ch ${match[1]} (${match[2]} MHz, ${match[3]} MHz)`;
}

/** Channel regex used in iw output parsing */
export const CHANNEL_REGEX = /channel\s+(\d+)\s+\((\d+)\s+MHz\),\s+width:\s+(\d+)\s+MHz/;

export interface InterfaceInfo {
	name: string;
	isMonitor: boolean;
	mac: string;
	channel: string;
}

function extractMatchGroup(block: string, regex: RegExp): string {
	const m = block.match(regex);
	return m ? m[1] : '';
}

function extractChannel(block: string): string {
	const m = block.match(CHANNEL_REGEX);
	return m ? formatChannel(m) : '';
}

/** Parse a single interface block from iw dev output */
export function parseInterfaceBlock(
	block: string,
	validateName: (name: string) => string
): InterfaceInfo | null {
	const ifMatch = block.match(/Interface\s+(\S+)/);
	if (!ifMatch) return null;
	return {
		name: validateName(ifMatch[1]),
		isMonitor: extractMatchGroup(block, /type\s+(\S+)/) === 'monitor',
		mac: extractMatchGroup(block, /addr\s+([0-9a-f:]+)/i),
		channel: extractChannel(block)
	};
}

/** Determine supported bands from iw phy info output */
export function parseBands(phyInfo: string): string[] {
	const bands: string[] = [];
	if (phyInfo.includes('Band 1:')) bands.push('2.4 GHz');
	if (phyInfo.includes('Band 2:')) bands.push('5 GHz');
	if (phyInfo.includes('Band 4:')) bands.push('6 GHz');
	return bands;
}

// ── SDR helpers ──

/** Parse firmware API version from USB bcdDevice field */
export function parseFirmwareApi(bcd: string): string {
	if (bcd.length !== 4) return '';
	const major = parseInt(bcd.slice(0, 2), 10);
	return `${major}.${bcd.slice(2)}`;
}

/** Map USB bus speed to human-readable string */
const SPEED_MAP: Record<string, string> = {
	'480': '480 Mbps (USB 2.0)',
	'5000': '5 Gbps (USB 3.0)'
};

export function formatUsbSpeed(speed: string): string {
	if (!speed) return '';
	return SPEED_MAP[speed] || `${speed} Mbps`;
}

// ── GPS helpers ──

/** Extract fields from a DEVICES-class gpsd response */
export function extractGpsdDevice(dev: Record<string, unknown>): {
	device: string;
	protocol: string;
	baudRate: number;
} {
	return {
		device: (dev.path as string) || '',
		protocol: (dev.driver as string) || '',
		baudRate: (dev.bps as number) || 0
	};
}

/** Query GPSD via direct TCP socket (no nc dependency) */
export function queryGpsd(command: string, timeoutMs = 3000): Promise<string> {
	return new Promise((resolve) => {
		let data = '';
		const sock = createConnection({ host: '127.0.0.1', port: 2947 }, () => {
			sock.write(command + '\n');
		});
		sock.setEncoding('utf-8');
		sock.on('data', (chunk) => {
			data += chunk;
		});
		sock.on('error', () => resolve(''));
		const timer = setTimeout(() => {
			sock.destroy();
			resolve(data);
		}, timeoutMs);
		sock.on('end', () => {
			clearTimeout(timer);
			resolve(data);
		});
	});
}

/** Read all SDR attributes from a USB sysfs device path */
export async function readSdrAttributes(devPath: string): Promise<{
	serial: string;
	product: string;
	manufacturer: string;
	usbVersion: string;
	firmwareApi: string;
	usbSpeed: string;
	maxPower: string;
	configuration: string;
}> {
	const bcd = await sysRead(`${devPath}/bcdDevice`);
	const speed = await sysRead(`${devPath}/speed`);
	return {
		serial: await sysRead(`${devPath}/serial`),
		product: (await sysRead(`${devPath}/product`)) || 'HackRF One',
		manufacturer: (await sysRead(`${devPath}/manufacturer`)) || 'Great Scott Gadgets',
		usbVersion: (await sysRead(`${devPath}/version`)).trim(),
		firmwareApi: parseFirmwareApi(bcd),
		usbSpeed: formatUsbSpeed(speed),
		maxPower: await sysRead(`${devPath}/bMaxPower`),
		configuration: await sysRead(`${devPath}/configuration`)
	};
}
