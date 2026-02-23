import * as fs from 'fs/promises';
import * as os from 'os';

import { createHandler } from '$lib/server/api/create-handler';
import { execFileAsync } from '$lib/server/exec';

export const GET = createHandler(async () => {
	return await getSystemMetrics();
});

async function getSystemMetrics() {
	const [cpu, memory, disk, temperature, network] = await Promise.all([
		getCPUUsage(),
		getMemoryUsage(),
		getDiskUsage(),
		getCPUTemperature(),
		getNetworkStats()
	]);

	return {
		cpu: {
			usage: cpu,
			temperature
		},
		memory,
		disk,
		network,
		timestamp: Date.now()
	};
}

async function getCPUUsage(): Promise<number> {
	const cpus = os.cpus();
	let totalIdle = 0;
	let totalTick = 0;

	cpus.forEach((cpu) => {
		for (const type in cpu.times) {
			totalTick += cpu.times[type as keyof typeof cpu.times];
		}
		totalIdle += cpu.times.idle;
	});

	const idle = totalIdle / cpus.length;
	const total = totalTick / cpus.length;
	const usage = 100 - ~~((100 * idle) / total);

	return usage;
}

function getMemoryUsage() {
	const totalMem = os.totalmem();
	const freeMem = os.freemem();
	const usedMem = totalMem - freeMem;

	return {
		total: totalMem,
		used: usedMem,
		free: freeMem,
		percentage: (usedMem / totalMem) * 100
	};
}

async function getDiskUsage() {
	try {
		const { stdout } = await execFileAsync('/usr/bin/df', ['-B1', '/']);
		const lines = stdout.trim().split('\n');
		if (lines.length < 2) return { total: 0, used: 0, available: 0, percentage: 0 };
		const [total, used, available] = lines[1].split(/\s+/).slice(1, 4).map(Number);

		return {
			total,
			used,
			available,
			percentage: (used / total) * 100
		};
	} catch (_error: unknown) {
		return {
			total: 0,
			used: 0,
			available: 0,
			percentage: 0
		};
	}
}

async function getCPUTemperature(): Promise<number | undefined> {
	try {
		// Try Raspberry Pi temperature
		const { stdout } = await execFileAsync('/usr/bin/vcgencmd', ['measure_temp']);
		const match = stdout.match(/temp=(\d+\.?\d*)/);
		if (match) {
			return parseFloat(match[1]);
		}
	} catch (_error: unknown) {
		try {
			// Try thermal zone (works on many Linux systems)
			const temp = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf-8');
			return parseInt(temp) / 1000;
		} catch (_error: unknown) {
			return undefined;
		}
	}
}

/** Default network stats returned when no data is available */
const EMPTY_NETWORK_STATS = { rx: 0, tx: 0, errors: 0 };

/** Parse a /proc/net/dev line into rx/tx/errors stats */
function parseNetDevLine(parts: string[]): { rx: number; tx: number; errors: number } {
	return {
		rx: parseInt(parts[1]) || 0,
		tx: parseInt(parts[9]) || 0,
		errors: (parseInt(parts[2]) || 0) + (parseInt(parts[10]) || 0)
	};
}

async function getNetworkStats() {
	try {
		const content = await fs.readFile('/proc/net/dev', 'utf-8');
		const ifaceLine = content.split('\n').find((line) => /wlan|eth/.test(line)) || '';
		const parts = ifaceLine.trim().split(/\s+/);

		return parts.length >= 10 ? parseNetDevLine(parts) : EMPTY_NETWORK_STATS;
	} catch (_error: unknown) {
		return EMPTY_NETWORK_STATS;
	}
}
