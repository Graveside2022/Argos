import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, readlink, readdir } from 'fs/promises';
import { createConnection } from 'net';

const execAsync = promisify(exec);

/** Run a shell command — uses iw which is available in the container */
async function run(cmd: string): Promise<string> {
	try {
		const { stdout } = await execAsync(cmd, { timeout: 5000 });
		return stdout.trim();
	} catch {
		return '';
	}
}

/** Read a sysfs file — works inside containers with host device access */
async function sysRead(path: string): Promise<string> {
	try {
		return (await readFile(path, 'utf-8')).trim();
	} catch {
		return '';
	}
}

/** Resolve a sysfs symlink and return the final component */
async function sysLink(path: string): Promise<string> {
	try {
		const link = await readlink(path);
		return link.split('/').pop() || '';
	} catch {
		return '';
	}
}

/** List top-level USB device paths (e.g. /sys/bus/usb/devices/1-2) */
async function listUsbDevices(): Promise<string[]> {
	try {
		const entries = await readdir('/sys/bus/usb/devices');
		return entries
			.filter((e) => /^\d+-\d+(\.\d+)*$/.test(e))
			.map((e) => `/sys/bus/usb/devices/${e}`);
	} catch {
		return [];
	}
}

interface WifiDetails {
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

interface SdrDetails {
	serial: string;
	product: string;
	manufacturer: string;
	usbVersion: string;
	firmwareApi: string;
	usbSpeed: string;
	maxPower: string;
	configuration: string;
}

interface GpsDetails {
	device: string;
	protocol: string;
	baudRate: number;
	usbAdapter: string;
	usbSerial: string;
	gpsdVersion: string;
}

async function getWifiDetails(): Promise<WifiDetails | null> {
	const iwDev = await run('iw dev');
	if (!iwDev) return null;

	let iface = '';
	let monIface = '';
	let mac = '';
	let channel = '';
	let phyIdx = '0';

	const phySections = iwDev.split(/(?=phy#\d+)/);
	for (const section of phySections) {
		const phyMatch = section.match(/phy#(\d+)/);
		if (!phyMatch) continue;
		const phyNum = phyMatch[1];

		// Check if this phy is the USB WiFi adapter via sysfs driver symlink
		const driver = await sysLink(`/sys/class/ieee80211/phy${phyNum}/device/driver`);
		if (!/mt79|mt76|rtl8|ath9k/i.test(driver)) continue;
		phyIdx = phyNum;

		const ifaceBlocks = section.split(/(?=\tInterface )/);
		for (const block of ifaceBlocks) {
			const ifMatch = block.match(/Interface\s+(\S+)/);
			if (!ifMatch) continue;
			const name = ifMatch[1];
			const typeMatch = block.match(/type\s+(\S+)/);
			const addrMatch = block.match(/addr\s+([0-9a-f:]+)/i);
			const chanMatch = block.match(
				/channel\s+(\d+)\s+\((\d+)\s+MHz\),\s+width:\s+(\d+)\s+MHz/
			);

			if (typeMatch?.[1] === 'monitor') {
				monIface = name;
				if (!mac && addrMatch) mac = addrMatch[1];
				if (!channel && chanMatch) {
					channel = `Ch ${chanMatch[1]} (${chanMatch[2]} MHz, ${chanMatch[3]} MHz)`;
				}
			} else {
				iface = name;
				if (addrMatch) mac = addrMatch[1];
				if (chanMatch) {
					channel = `Ch ${chanMatch[1]} (${chanMatch[2]} MHz, ${chanMatch[3]} MHz)`;
				}
			}
		}
		break;
	}

	if (!iface && !monIface) return null;

	// Get channel from iw dev info if not captured
	if (!channel) {
		const devInfo = await run(`iw dev ${monIface || iface} info`);
		const chanMatch = devInfo.match(
			/channel\s+(\d+)\s+\((\d+)\s+MHz\),\s+width:\s+(\d+)\s+MHz/
		);
		if (chanMatch) {
			channel = `Ch ${chanMatch[1]} (${chanMatch[2]} MHz, ${chanMatch[3]} MHz)`;
		}
	}

	// Get driver from sysfs uevent (works in containers without ethtool)
	const targetIface = iface || monIface;
	const uevent = await sysRead(`/sys/class/net/${targetIface}/device/uevent`);
	let driver = '';
	const driverMatch = uevent.match(/DRIVER=(\S+)/);
	if (driverMatch) driver = driverMatch[1];

	// Map driver to chipset name
	let chipset = '';
	if (driver === 'mt7921u') chipset = 'MediaTek MT7921AU';
	else if (driver.startsWith('mt76')) chipset = `MediaTek ${driver.toUpperCase()}`;
	else if (driver.startsWith('rtl')) chipset = `Realtek ${driver.toUpperCase()}`;
	else if (driver) chipset = driver.toUpperCase();

	// Get USB manufacturer/product from sysfs
	let usbManufacturer = '';
	let usbProduct = '';
	const usbDevices = await listUsbDevices();
	for (const dev of usbDevices) {
		const vendor = await sysRead(`${dev}/idVendor`);
		const product = await sysRead(`${dev}/idProduct`);
		// MediaTek MT7921 Alfa USB ID: 0e8d:7961
		if (vendor === '0e8d' && product === '7961') {
			usbManufacturer = await sysRead(`${dev}/manufacturer`);
			usbProduct = await sysRead(`${dev}/product`);
			break;
		}
	}

	// Determine bands from phy info
	const phyInfo = await run(`iw phy phy${phyIdx} info`);
	const bands: string[] = [];
	if (phyInfo.includes('Band 1:')) bands.push('2.4 GHz');
	if (phyInfo.includes('Band 2:')) bands.push('5 GHz');
	if (phyInfo.includes('Band 4:')) bands.push('6 GHz');

	return {
		interface: iface || '',
		monitorInterface: monIface,
		mac: mac.toUpperCase(),
		driver,
		chipset,
		usbManufacturer,
		usbProduct,
		mode: monIface ? 'monitor' : 'managed',
		channel,
		bands
	};
}

async function getSdrDetails(): Promise<SdrDetails | null> {
	// Read HackRF info from USB sysfs (works in containers)
	const usbDevices = await listUsbDevices();
	for (const dev of usbDevices) {
		const vendor = await sysRead(`${dev}/idVendor`);
		const product = await sysRead(`${dev}/idProduct`);

		// HackRF One USB ID: 1d50:6089
		if (vendor === '1d50' && product === '6089') {
			// bcdDevice encodes firmware API version (e.g. 0108 → 1.08)
			const bcd = await sysRead(`${dev}/bcdDevice`);
			let firmwareApi = '';
			if (bcd.length === 4) {
				const major = parseInt(bcd.slice(0, 2), 10);
				const minor = bcd.slice(2);
				firmwareApi = `${major}.${minor}`;
			}

			// USB bus speed in Mbps
			const speed = await sysRead(`${dev}/speed`);
			let usbSpeed = '';
			if (speed === '480') usbSpeed = '480 Mbps (USB 2.0)';
			else if (speed === '5000') usbSpeed = '5 Gbps (USB 3.0)';
			else if (speed) usbSpeed = `${speed} Mbps`;

			return {
				serial: await sysRead(`${dev}/serial`),
				product: (await sysRead(`${dev}/product`)) || 'HackRF One',
				manufacturer: (await sysRead(`${dev}/manufacturer`)) || 'Great Scott Gadgets',
				usbVersion: (await sysRead(`${dev}/version`)).trim(),
				firmwareApi,
				usbSpeed,
				maxPower: await sysRead(`${dev}/bMaxPower`),
				configuration: await sysRead(`${dev}/configuration`)
			};
		}
	}
	return null;
}

/** Query GPSD via direct TCP socket (no nc dependency) */
function queryGpsd(command: string, timeoutMs = 3000): Promise<string> {
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

async function getGpsDetails(): Promise<GpsDetails | null> {
	const gpsdOutput = await queryGpsd('?DEVICES;');
	if (!gpsdOutput) return null;

	let device = '';
	let protocol = '';
	let baudRate = 0;
	let gpsdVersion = '';

	for (const line of gpsdOutput.trim().split('\n')) {
		try {
			const parsed = JSON.parse(line) as Record<string, unknown>;
			if (parsed.class === 'VERSION') {
				gpsdVersion = (parsed.release as string) || '';
			}
			if (parsed.class === 'DEVICES' && Array.isArray(parsed.devices)) {
				const dev = parsed.devices[0] as Record<string, unknown> | undefined;
				if (dev) {
					device = (dev.path as string) || '';
					protocol = (dev.driver as string) || '';
					baudRate = (dev.bps as number) || 0;
				}
			}
		} catch {
			// Skip non-JSON
		}
	}

	if (!device && !gpsdVersion) return null;

	// Get USB adapter info from sysfs (Prolific USB-Serial: 067b:23a3)
	let usbAdapter = '';
	let usbSerial = '';
	const usbDevices = await listUsbDevices();
	for (const dev of usbDevices) {
		const vendor = await sysRead(`${dev}/idVendor`);
		const product = await sysRead(`${dev}/idProduct`);
		// Prolific USB-Serial (common GPS adapter chipset)
		if (vendor === '067b' && product === '23a3') {
			const mfr = await sysRead(`${dev}/manufacturer`);
			const prod = await sysRead(`${dev}/product`);
			usbAdapter = mfr ? `${mfr} ${prod}`.trim() : prod;
			usbSerial = await sysRead(`${dev}/serial`);
			break;
		}
	}

	return {
		device,
		protocol,
		baudRate,
		usbAdapter,
		usbSerial,
		gpsdVersion
	};
}

export const GET: RequestHandler = async () => {
	const [wifi, sdr, gps] = await Promise.all([
		getWifiDetails(),
		getSdrDetails(),
		getGpsDetails()
	]);

	return new Response(JSON.stringify({ wifi, sdr, gps }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
