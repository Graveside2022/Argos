import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { promisify } from 'util';

import type { SystemInfo } from '$lib/types/system';

import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

async function getSystemInfo(): Promise<SystemInfo> {
	try {
		const hostname = os.hostname();

		// Get all IPs via hostname -I (no shell pipe needed)
		const { stdout: allIps } = await execFileAsync('/usr/bin/hostname', ['-I']);
		const ips = allIps.trim().split(' ').filter(Boolean);
		const primaryIp = ips[0] || '';
		const tailscaleIp = ips.find((ip) => ip.startsWith('100.')) || null;

		// Get WiFi interfaces via ip command + JS parsing (replaces grep|awk|sed pipe)
		const wifiInterfaces = [];
		try {
			const { stdout: ifaceOutput } = await execFileAsync('/usr/sbin/ip', [
				'-o',
				'link',
				'show'
			]);
			const ifaces = ifaceOutput
				.split('\n')
				.filter((line) => /wlan|wlp/.test(line))
				.map((line) => {
					const match = line.match(/^\d+:\s+(\S+?):/);
					return match ? match[1] : '';
				})
				.filter(Boolean);

			for (const iface of ifaces) {
				try {
					const { stdout: addrOutput } = await execFileAsync('/usr/sbin/ip', [
						'addr',
						'show',
						iface
					]);
					const ipMatch = addrOutput.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
					const { stdout: linkOutput } = await execFileAsync('/usr/sbin/ip', [
						'link',
						'show',
						iface
					]);
					const macMatch = linkOutput.match(/link\/ether\s+([\da-f:]+)/);

					if (ipMatch) {
						wifiInterfaces.push({
							name: iface,
							ip: ipMatch[1],
							mac: macMatch ? macMatch[1] : ''
						});
					}
				} catch {
					// Interface might be down
				}
			}
		} catch (error: unknown) {
			console.error('Error getting WiFi interfaces:', error);
		}

		// CPU info from os module
		const cpuInfo = os.cpus();
		const cpuModel = cpuInfo[0].model;
		const cpuCores = cpuInfo.length;

		// CPU usage from load average (no shell pipe needed)
		const loadAvg = os.loadavg()[0];
		const cpuUsage = Math.min(100, (loadAvg / cpuCores) * 100);

		// Memory from os module
		const totalMem = os.totalmem();
		const freeMem = os.freemem();
		const usedMem = totalMem - freeMem;
		const memPercentage = (usedMem / totalMem) * 100;

		// Storage via df (replaces shell pipe with JS parsing)
		let storageInfo = { total: 0, used: 0, free: 0, percentage: 0 };
		try {
			const { stdout: dfOutput } = await execFileAsync('/usr/bin/df', ['-B1', '/']);
			const lines = dfOutput.trim().split('\n');
			if (lines.length >= 2) {
				const parts = lines[1].split(/\s+/);
				storageInfo = {
					total: parseInt(parts[1]),
					used: parseInt(parts[2]),
					free: parseInt(parts[3]),
					percentage: parseInt(parts[4])
				};
			}
		} catch (error: unknown) {
			console.error('Error getting storage info:', error);
		}

		// Temperature — read from sysfs first, fallback to vcgencmd
		let temperature = 0;
		try {
			const tempStr = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8');
			temperature = parseInt(tempStr.trim()) / 1000;
		} catch {
			try {
				const { stdout: tempOutput } = await execFileAsync('/usr/bin/vcgencmd', [
					'measure_temp'
				]);
				const match = tempOutput.match(/([\d.]+)/);
				if (match) temperature = parseFloat(match[1]);
			} catch (error: unknown) {
				console.error('Error getting temperature:', error);
			}
		}

		const uptime = os.uptime();

		// Battery (not typical on Pi, but check)
		let battery = undefined;
		try {
			const { stdout: batteryOutput } = await execFileAsync('/usr/bin/upower', [
				'-i',
				'/org/freedesktop/UPower/devices/battery_BAT0'
			]);
			if (batteryOutput) {
				const percentageMatch = batteryOutput.match(/percentage:\s*(\d+)%/);
				const stateMatch = batteryOutput.match(/state:\s*(\w+)/);
				if (percentageMatch) {
					battery = {
						level: parseInt(percentageMatch[1]),
						charging: stateMatch ? stateMatch[1] === 'charging' : false
					};
				}
			}
		} catch {
			// No battery — normal for Raspberry Pi
		}

		return {
			hostname,
			ip: primaryIp,
			tailscaleIp,
			wifiInterfaces,
			cpu: { usage: cpuUsage, model: cpuModel, cores: cpuCores },
			memory: { total: totalMem, used: usedMem, free: freeMem, percentage: memPercentage },
			storage: storageInfo,
			temperature,
			uptime,
			battery
		};
	} catch (error: unknown) {
		console.error('Error getting system info:', error);
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
