import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import { promisify } from 'util';

import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

export const GET: RequestHandler = async () => {
	try {
		const metrics = await getSystemMetrics();
		return json(metrics);
	} catch (error: unknown) {
		logger.error('Failed to get system metrics', {
			error: error instanceof Error ? error.message : String(error)
		});
		return json({ error: 'Failed to get system metrics' }, { status: 500 });
	}
};

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

async function getNetworkStats() {
	try {
		// Get network interface stats
		const content = await fs.readFile('/proc/net/dev', 'utf-8');
		const stdout = content.split('\n').find((line) => /wlan|eth/.test(line)) || '';
		const parts = stdout.trim().split(/\s+/);

		if (parts.length >= 10) {
			return {
				rx: parseInt(parts[1]) || 0, // Received bytes
				tx: parseInt(parts[9]) || 0, // Transmitted bytes
				errors: (parseInt(parts[2]) || 0) + (parseInt(parts[10]) || 0)
			};
		}
	} catch (_error: unknown) {
		// Fallback
	}

	return {
		rx: 0,
		tx: 0,
		errors: 0
	};
}
