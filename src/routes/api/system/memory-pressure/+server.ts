import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import os from 'os';
import { promisify } from 'util';

import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
	try {
		const totalMem = os.totalmem();
		const freeMem = os.freemem();
		const usedMem = totalMem - freeMem;
		const memoryPercentage = Math.round((usedMem / totalMem) * 100);

		// Check Node.js heap usage
		const heapStats = process.memoryUsage();
		const heapUsedMB = Math.round(heapStats.heapUsed / 1024 / 1024);
		const heapTotalMB = Math.round(heapStats.heapTotal / 1024 / 1024);
		const heapLimitMB = 1024; // --max-old-space-size=1024

		// Check earlyoom status
		let earlyoomRunning = false;
		try {
			await execAsync('pgrep earlyoom');
			earlyoomRunning = true;
		} catch {
			earlyoomRunning = false;
		}

		// Check zram status
		let zramEnabled = false;
		let zramSize = '0MB';
		try {
			const { stdout } = await execAsync('zramctl --output NAME,DISKSIZE,DATA,COMPR 2>&1');
			if (stdout.includes('/dev/zram')) {
				zramEnabled = true;
				// Extract size from first zram device
				const match = stdout.match(/\/dev\/zram\d+\s+([0-9.]+[GMK])/);
				if (match) zramSize = match[1];
			}
		} catch {
			zramEnabled = false;
		}

		// Calculate risk level
		let riskLevel = 'LOW';
		let riskReasons = [];

		if (memoryPercentage > 85) {
			riskLevel = 'CRITICAL';
			riskReasons.push('System memory >85%');
		} else if (memoryPercentage > 75) {
			riskLevel = 'HIGH';
			riskReasons.push('System memory >75%');
		} else if (memoryPercentage > 60) {
			riskLevel = 'MEDIUM';
			riskReasons.push('System memory >60%');
		}

		if (heapUsedMB > heapLimitMB * 0.9) {
			riskLevel = 'CRITICAL';
			riskReasons.push('Node.js heap >90% of limit');
		} else if (heapUsedMB > heapLimitMB * 0.75) {
			if (riskLevel === 'LOW') riskLevel = 'HIGH';
			riskReasons.push('Node.js heap >75% of limit');
		}

		if (!earlyoomRunning) {
			riskReasons.push('earlyoom not running (no OOM protection)');
			if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
		}

		if (!zramEnabled) {
			riskReasons.push('zram not enabled (no compressed swap)');
		}

		return json({
			success: true,
			risk_level: riskLevel,
			risk_reasons: riskReasons,
			system: {
				memory_used_mb: Math.round(usedMem / 1024 / 1024),
				memory_total_mb: Math.round(totalMem / 1024 / 1024),
				memory_percentage: memoryPercentage
			},
			nodejs: {
				heap_used_mb: heapUsedMB,
				heap_total_mb: heapTotalMB,
				heap_limit_mb: heapLimitMB,
				heap_percentage: Math.round((heapUsedMB / heapLimitMB) * 100)
			},
			protection: {
				earlyoom_running: earlyoomRunning,
				zram_enabled: zramEnabled,
				zram_size: zramSize
			}
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return json({
			success: false,
			error: msg
		});
	}
};
