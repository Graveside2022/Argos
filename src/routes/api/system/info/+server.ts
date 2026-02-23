import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { promisify } from 'util';

import type { SystemInfo } from '$lib/types/system';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

/** Safe error message extraction. */
function errMsg(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Get all IPs and find primary + Tailscale. */
async function getNetworkIps(): Promise<{ primaryIp: string; tailscaleIp: string | null }> {
	const { stdout: allIps } = await execFileAsync('/usr/bin/hostname', ['-I']);
	const ips = allIps.trim().split(' ').filter(Boolean);
	return {
		primaryIp: ips[0] || '',
		tailscaleIp: ips.find((ip) => ip.startsWith('100.')) || null
	};
}

/** Extract WiFi interface names from ip link output. */
function parseWifiInterfaceNames(ifaceOutput: string): string[] {
	return ifaceOutput
		.split('\n')
		.filter((line) => /wlan|wlp/.test(line))
		.map((line) => {
			const match = line.match(/^\d+:\s+(\S+?):/);
			return match ? match[1] : '';
		})
		.filter(Boolean);
}

/** Get IP and MAC for a single interface. */
async function getInterfaceDetails(
	iface: string
): Promise<{ name: string; ip: string; mac: string } | null> {
	try {
		const { stdout: addrOutput } = await execFileAsync('/usr/sbin/ip', ['addr', 'show', iface]);
		const ipMatch = addrOutput.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
		if (!ipMatch) return null;
		const { stdout: linkOutput } = await execFileAsync('/usr/sbin/ip', ['link', 'show', iface]);
		const macMatch = linkOutput.match(/link\/ether\s+([\da-f:]+)/);
		return { name: iface, ip: ipMatch[1], mac: macMatch ? macMatch[1] : '' };
	} catch {
		return null;
	}
}

/** Detect all WiFi interfaces with their IP and MAC. */
async function getWifiInterfaces(): Promise<{ name: string; ip: string; mac: string }[]> {
	try {
		const { stdout: ifaceOutput } = await execFileAsync('/usr/sbin/ip', ['-o', 'link', 'show']);
		const ifaces = parseWifiInterfaceNames(ifaceOutput);
		const results = await Promise.all(ifaces.map(getInterfaceDetails));
		return results.filter((r): r is NonNullable<typeof r> => r !== null);
	} catch (error: unknown) {
		logger.error('Error getting WiFi interfaces', { error: errMsg(error) });
		return [];
	}
}

/** Get storage info from df. */
async function getStorageInfo(): Promise<{
	total: number;
	used: number;
	free: number;
	percentage: number;
}> {
	try {
		const { stdout: dfOutput } = await execFileAsync('/usr/bin/df', ['-B1', '/']);
		const lines = dfOutput.trim().split('\n');
		if (lines.length < 2) return { total: 0, used: 0, free: 0, percentage: 0 };
		const parts = lines[1].split(/\s+/);
		return {
			total: parseInt(parts[1]),
			used: parseInt(parts[2]),
			free: parseInt(parts[3]),
			percentage: parseInt(parts[4])
		};
	} catch (error: unknown) {
		logger.error('Error getting storage info', { error: errMsg(error) });
		return { total: 0, used: 0, free: 0, percentage: 0 };
	}
}

/** Read CPU temperature from sysfs, fallback to vcgencmd. */
async function getTemperature(): Promise<number> {
	try {
		const tempStr = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8');
		return parseInt(tempStr.trim()) / 1000;
	} catch {
		return getTemperatureVcgencmd();
	}
}

/** Fallback temperature reading via vcgencmd. */
async function getTemperatureVcgencmd(): Promise<number> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/vcgencmd', ['measure_temp']);
		const match = stdout.match(/([\d.]+)/);
		return match ? parseFloat(match[1]) : 0;
	} catch (error: unknown) {
		logger.error('Error getting temperature', { error: errMsg(error) });
		return 0;
	}
}

/** Detect battery status (optional on Pi). */
async function getBatteryInfo(): Promise<{ level: number; charging: boolean } | undefined> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/upower', [
			'-i',
			'/org/freedesktop/UPower/devices/battery_BAT0'
		]);
		if (!stdout) return undefined;
		const pctMatch = stdout.match(/percentage:\s*(\d+)%/);
		if (!pctMatch) return undefined;
		const stateMatch = stdout.match(/state:\s*(\w+)/);
		return {
			level: parseInt(pctMatch[1]),
			charging: stateMatch ? stateMatch[1] === 'charging' : false
		};
	} catch {
		return undefined;
	}
}

async function getSystemInfo(): Promise<SystemInfo> {
	try {
		const hostname = os.hostname();
		const { primaryIp, tailscaleIp } = await getNetworkIps();
		const wifiInterfaces = await getWifiInterfaces();

		const cpuInfo = os.cpus();
		const cpuCores = cpuInfo.length;
		const cpuUsage = Math.min(100, (os.loadavg()[0] / cpuCores) * 100);

		const totalMem = os.totalmem();
		const freeMem = os.freemem();
		const usedMem = totalMem - freeMem;

		const [storageInfo, temperature, battery] = await Promise.all([
			getStorageInfo(),
			getTemperature(),
			getBatteryInfo()
		]);

		return {
			hostname,
			ip: primaryIp,
			tailscaleIp,
			wifiInterfaces,
			cpu: { usage: cpuUsage, model: cpuInfo[0].model, cores: cpuCores },
			memory: {
				total: totalMem,
				used: usedMem,
				free: freeMem,
				percentage: (usedMem / totalMem) * 100
			},
			storage: storageInfo,
			temperature,
			uptime: os.uptime(),
			battery
		};
	} catch (error: unknown) {
		logger.error('Error getting system info', { error: errMsg(error) });
		throw error;
	}
}

export const GET: RequestHandler = async () => {
	try {
		const info = await getSystemInfo();
		return json(info);
	} catch (_error: unknown) {
		return json({ error: 'Failed to get system info' }, { status: 500 });
	}
};
