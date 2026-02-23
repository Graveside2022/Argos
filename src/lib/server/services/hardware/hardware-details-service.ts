/**
 * Hardware details service — enumerates WiFi, SDR, and GPS devices
 * via sysfs, iw commands, and gpsd queries.
 */
import { z } from 'zod';

import { validateInterfaceName, validateNumericParam } from '$lib/server/security/input-sanitizer';
import { safeJsonParse } from '$lib/server/security/safe-json';
import { logger } from '$lib/utils/logger';

import {
	CHANNEL_REGEX,
	extractGpsdDevice,
	findUsbDevice,
	formatChannel,
	type InterfaceInfo,
	isWifiDriver,
	mapDriverToChipset,
	parseBands,
	parseInterfaceBlock,
	queryGpsd,
	readSdrAttributes,
	readUsbIdentity,
	run,
	sysLink,
	sysRead
} from './hardware-details-helpers';

// Zod schema for gpsd JSON messages (VERSION, DEVICES, etc.)
const GpsdDeviceMessageSchema = z
	.object({
		class: z.string(),
		release: z.string().optional(),
		devices: z
			.array(
				z
					.object({
						path: z.string().optional(),
						driver: z.string().optional(),
						bps: z.number().optional()
					})
					.passthrough()
			)
			.optional()
	})
	.passthrough();

export interface WifiDetails {
	interface: string;
	monitorInterface: string;
	mac: string;
	driver: string;
	chipset: string;
	usbManufacturer: string;
	usbProduct: string;
	mode: string;
	channel: string;
	bands: string[];
}

export interface SdrDetails {
	serial: string;
	product: string;
	manufacturer: string;
	usbVersion: string;
	firmwareApi: string;
	usbSpeed: string;
	maxPower: string;
	configuration: string;
}

export interface GpsDetails {
	device: string;
	protocol: string;
	baudRate: number;
	usbAdapter: string;
	usbSerial: string;
	gpsdVersion: string;
}

export interface HardwareDetails {
	wifi: WifiDetails | null;
	sdr: SdrDetails | null;
	gps: GpsDetails | null;
}

// ── WiFi detection ──

interface WifiIfaceState {
	iface: string;
	monIface: string;
	mac: string;
	channel: string;
}

function applyMonitorInfo(state: WifiIfaceState, info: InterfaceInfo): void {
	state.monIface = info.name;
	if (!state.mac && info.mac) state.mac = info.mac;
	if (!state.channel && info.channel) state.channel = info.channel;
}

function applyManagedInfo(state: WifiIfaceState, info: InterfaceInfo): void {
	state.iface = info.name;
	if (info.mac) state.mac = info.mac;
	if (info.channel) state.channel = info.channel;
}

function applyInterfaceInfo(state: WifiIfaceState, info: InterfaceInfo | null): void {
	if (!info) return;
	if (info.isMonitor) applyMonitorInfo(state, info);
	else applyManagedInfo(state, info);
}

async function findWifiPhy(
	phySections: string[]
): Promise<{ phyIdx: string; section: string } | null> {
	for (const section of phySections) {
		const phyMatch = section.match(/phy#(\d+)/);
		if (!phyMatch) continue;
		const driver = await sysLink(`/sys/class/ieee80211/phy${phyMatch[1]}/device/driver`);
		if (!isWifiDriver(driver)) continue;
		const phyIdx = String(validateNumericParam(phyMatch[1], 'phyIdx', 0, 255));
		return { phyIdx, section };
	}
	return null;
}

function parsePhyInterfaces(section: string): WifiIfaceState {
	const state: WifiIfaceState = { iface: '', monIface: '', mac: '', channel: '' };
	const blocks = section.split(/(?=\tInterface )/);
	for (const block of blocks) {
		applyInterfaceInfo(state, parseInterfaceBlock(block, validateInterfaceName));
	}
	return state;
}

async function resolveChannel(state: WifiIfaceState): Promise<string> {
	if (state.channel) return state.channel;
	const devInfo = await run('/usr/sbin/iw', ['dev', state.monIface || state.iface, 'info']);
	const chanMatch = devInfo.match(CHANNEL_REGEX);
	return chanMatch ? formatChannel(chanMatch) : '';
}

async function resolveDriver(iface: string): Promise<string> {
	const uevent = await sysRead(`/sys/class/net/${iface}/device/uevent`);
	const driverMatch = uevent.match(/DRIVER=(\S+)/);
	return driverMatch ? driverMatch[1] : '';
}

async function resolveAlfaUsb(): Promise<{ manufacturer: string; product: string }> {
	const devPath = await findUsbDevice('0e8d', '7961');
	if (!devPath) return { manufacturer: '', product: '' };
	return readUsbIdentity(devPath);
}

function assembleWifiDetails(
	state: WifiIfaceState,
	channel: string,
	driver: string,
	usb: { manufacturer: string; product: string },
	bands: string[]
): WifiDetails {
	return {
		interface: state.iface,
		monitorInterface: state.monIface,
		mac: state.mac.toUpperCase(),
		driver,
		chipset: mapDriverToChipset(driver),
		usbManufacturer: usb.manufacturer,
		usbProduct: usb.product,
		mode: state.monIface ? 'monitor' : 'managed',
		channel,
		bands
	};
}

function hasAnyInterface(state: WifiIfaceState): boolean {
	return state.iface !== '' || state.monIface !== '';
}

function primaryInterface(state: WifiIfaceState): string {
	return state.iface || state.monIface;
}

async function getWifiDetails(): Promise<WifiDetails | null> {
	const iwDev = await run('/usr/sbin/iw', ['dev']);
	if (!iwDev) return null;

	const phy = await findWifiPhy(iwDev.split(/(?=phy#\d+)/));
	if (!phy) return null;

	const state = parsePhyInterfaces(phy.section);
	if (!hasAnyInterface(state)) return null;

	const channel = await resolveChannel(state);
	const driver = await resolveDriver(primaryInterface(state));
	const usb = await resolveAlfaUsb();
	const phyInfo = await run('/usr/sbin/iw', ['phy', `phy${phy.phyIdx}`, 'info']);

	return assembleWifiDetails(state, channel, driver, usb, parseBands(phyInfo));
}

// ── SDR detection ──

async function getSdrDetails(): Promise<SdrDetails | null> {
	const devPath = await findUsbDevice('1d50', '6089');
	if (!devPath) return null;
	return readSdrAttributes(devPath);
}

// ── GPS detection ──

interface GpsdState {
	device: string;
	protocol: string;
	baudRate: number;
	gpsdVersion: string;
}

function processGpsdVersion(parsed: { release?: string }, state: GpsdState): void {
	state.gpsdVersion = (parsed.release as string) || '';
}

function processGpsdDevices(
	devices: Record<string, unknown>[] | undefined,
	state: GpsdState
): void {
	if (!Array.isArray(devices)) return;
	const dev = devices[0] as Record<string, unknown> | undefined;
	if (!dev) return;
	const extracted = extractGpsdDevice(dev);
	state.device = extracted.device;
	state.protocol = extracted.protocol;
	state.baudRate = extracted.baudRate;
}

function processGpsdLine(line: string, state: GpsdState): void {
	const result = safeJsonParse(line, GpsdDeviceMessageSchema, 'hardware-details-gpsd');
	if (!result.success) {
		logger.warn('[hardware-details] Malformed gpsd data, skipping line');
		return;
	}
	const parsed = result.data;
	if (parsed.class === 'VERSION') processGpsdVersion(parsed, state);
	if (parsed.class === 'DEVICES') processGpsdDevices(parsed.devices, state);
}

function parseGpsdOutput(output: string): GpsdState {
	const state: GpsdState = { device: '', protocol: '', baudRate: 0, gpsdVersion: '' };
	for (const line of output.trim().split('\n')) {
		processGpsdLine(line, state);
	}
	return state;
}

async function resolveGpsUsb(): Promise<{ adapter: string; serial: string }> {
	const devPath = await findUsbDevice('067b', '23a3');
	if (!devPath) return { adapter: '', serial: '' };
	const identity = await readUsbIdentity(devPath);
	const adapter = identity.manufacturer
		? `${identity.manufacturer} ${identity.product}`.trim()
		: identity.product;
	return { adapter, serial: await sysRead(`${devPath}/serial`) };
}

async function getGpsDetails(): Promise<GpsDetails | null> {
	const gpsdOutput = await queryGpsd('?DEVICES;');
	if (!gpsdOutput) return null;

	const state = parseGpsdOutput(gpsdOutput);
	if (!state.device && !state.gpsdVersion) return null;

	const usb = await resolveGpsUsb();
	return {
		device: state.device,
		protocol: state.protocol,
		baudRate: state.baudRate,
		usbAdapter: usb.adapter,
		usbSerial: usb.serial,
		gpsdVersion: state.gpsdVersion
	};
}

// ── Public API ──

/**
 * Get comprehensive hardware details for WiFi, SDR, and GPS devices.
 * Uses sysfs, iw commands, and gpsd queries to enumerate USB devices.
 */
export async function getAllHardwareDetails(): Promise<HardwareDetails> {
	const [wifi, sdr, gps] = await Promise.all([
		getWifiDetails(),
		getSdrDetails(),
		getGpsDetails()
	]);
	return { wifi, sdr, gps };
}
