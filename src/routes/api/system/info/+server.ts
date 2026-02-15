import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
	// Safe: System info data type assertion
import * as os from 'os';
import { promisify } from 'util';

import type { SystemInfo } from '$lib/types/system';

import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

async function getSystemInfo(): Promise<SystemInfo> {
	try {
		// Get hostname
		const hostname = os.hostname();

		// Get all IPs and extract primary + Tailscale
		const { stdout: allIps } = await execAsync('hostname -I');
		const ips = allIps.trim().split(' ').filter(Boolean);
		const primaryIp = ips[0] || '';
		const tailscaleIp = ips.find((ip) => ip.startsWith('100.')) || null;

		// Get WiFi interfaces
		const wifiInterfaces = [];
		try {
			const { stdout: ifaceOutput } = await execAsync(
				"ip -o link show | grep -E 'wlan|wlp' | awk '{print $2}' | sed 's/://'"
			);
			const ifaces = ifaceOutput.trim().split('\n').filter(Boolean);

			for (const iface of ifaces) {
				try {
					const { stdout: ipAddr } = await execAsync(
						`ip addr show ${iface} | grep 'inet ' | awk '{print $2}' | cut -d/ -f1`
					);
					const { stdout: macAddr } = await execAsync(
						`ip link show ${iface} | grep 'link/ether' | awk '{print $2}'`
					);

					if (ipAddr.trim()) {
						wifiInterfaces.push({
							name: iface,
							ip: ipAddr.trim(),
							mac: macAddr.trim()
						});
					}
				} catch (_error: unknown) {
					// Interface might be down
				}
			}
		} catch (error: unknown) {
			console.error('Error getting WiFi interfaces:', error);
		}

		// Get CPU usage
		const cpuInfo = os.cpus();
		const cpuModel = cpuInfo[0].model;
		const cpuCores = cpuInfo.length;

		// Calculate CPU usage percentage
		let cpuUsage = 0;
		try {
			const { stdout: cpuOutput } = await execAsync(
				"top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'"
			);
			cpuUsage = parseFloat(cpuOutput.trim()) || 0;
		} catch (_error: unknown) {
			// Fallback CPU calculation
			const loadAvg = os.loadavg()[0];
			cpuUsage = Math.min(100, (loadAvg / cpuCores) * 100);
		}

		// Get memory info
		const totalMem = os.totalmem();
		const freeMem = os.freemem();
		const usedMem = totalMem - freeMem;
		const memPercentage = (usedMem / totalMem) * 100;

		// Get storage info
		let storageInfo = {
			total: 0,
			used: 0,
			free: 0,
			percentage: 0
		};

		try {
			const { stdout: dfOutput } = await execAsync(
				"df -B1 / | tail -1 | awk '{print $2,$3,$4,$5}'"
			);
			const [total, used, free, percentage] = dfOutput.trim().split(' ');
			storageInfo = {
				total: parseInt(total),
				used: parseInt(used),
				free: parseInt(free),
				percentage: parseInt(percentage)
			};
		} catch (error: unknown) {
			console.error('Error getting storage info:', error);
		}

		// Get temperature (Raspberry Pi specific)
		let temperature = 0;
		try {
			const { stdout: tempOutput } = await execAsync(
				"vcgencmd measure_temp | sed 's/temp=//;s/°C//'"
			);
			temperature = parseFloat(tempOutput.trim());
		} catch (_error: unknown) {
			// Try alternative method
			try {
				const { stdout: tempAlt } = await execAsync(
					'cat /sys/class/thermal/thermal_zone0/temp'
				);
				temperature = parseInt(tempAlt.trim()) / 1000;
			} catch (error: unknown) {
				console.error('Error getting temperature:', error);
			}
		}

		// Get uptime
		const uptime = os.uptime();

		// Battery info (not typically available on Pi, but check anyway)
		let battery = undefined;
		try {
			const { stdout: batteryOutput } = await execAsync(
				"upower -i /org/freedesktop/UPower/devices/battery_BAT0 | grep -E 'percentage|state'"
			);
			if (batteryOutput) {
				// Parse battery info if available
				const percentageMatch = batteryOutput.match(/percentage:\s*(\d+)%/);
				const stateMatch = batteryOutput.match(/state:\s*(\w+)/);
				if (percentageMatch) {
					battery = {
						level: parseInt(percentageMatch[1]),
						charging: stateMatch ? stateMatch[1] === 'charging' : false
					};
				}
			}
		} catch (_error: unknown) {
			// No battery - this is normal for Raspberry Pi
		}

		return {
			hostname,
			ip: primaryIp,
			tailscaleIp,
			wifiInterfaces,
			cpu: {
				usage: cpuUsage,
				model: cpuModel,
				cores: cpuCores
			},
			memory: {
				total: totalMem,
				used: usedMem,
				free: freeMem,
				percentage: memPercentage
			},
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
