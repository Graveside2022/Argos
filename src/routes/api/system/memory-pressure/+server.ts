import os from 'os';

import { createHandler } from '$lib/server/api/create-handler';
import { execFileAsync } from '$lib/server/exec';

/** Heap limit configured via --max-old-space-size */
const HEAP_LIMIT_MB = 1024;

interface RiskAssessment {
	level: string;
	reasons: string[];
}

/** Determine memory risk level from system memory percentage */
function assessSystemMemoryRisk(memoryPercentage: number): RiskAssessment {
	if (memoryPercentage > 85) {
		return { level: 'CRITICAL', reasons: ['System memory >85%'] };
	}
	if (memoryPercentage > 75) {
		return { level: 'HIGH', reasons: ['System memory >75%'] };
	}
	if (memoryPercentage > 60) {
		return { level: 'MEDIUM', reasons: ['System memory >60%'] };
	}
	return { level: 'LOW', reasons: [] };
}

/** Escalate risk level based on Node.js heap usage */
function assessHeapRisk(risk: RiskAssessment, heapUsedMB: number): void {
	const heapRatio = heapUsedMB / HEAP_LIMIT_MB;
	if (heapRatio > 0.9) {
		risk.level = 'CRITICAL';
		risk.reasons.push('Node.js heap >90% of limit');
	} else if (heapRatio > 0.75) {
		if (risk.level === 'LOW') risk.level = 'HIGH';
		risk.reasons.push('Node.js heap >75% of limit');
	}
}

/** Escalate risk level based on protection status */
function assessProtectionRisk(
	risk: RiskAssessment,
	earlyoomRunning: boolean,
	zramEnabled: boolean
): void {
	if (!earlyoomRunning) {
		risk.reasons.push('earlyoom not running (no OOM protection)');
		if (risk.level === 'LOW') risk.level = 'MEDIUM';
	}
	if (!zramEnabled) {
		risk.reasons.push('zram not enabled (no compressed swap)');
	}
}

/** Check whether earlyoom process is currently running */
async function checkEarlyoom(): Promise<boolean> {
	try {
		await execFileAsync('/usr/bin/pgrep', ['earlyoom']);
		return true;
	} catch {
		return false;
	}
}

/** Check zram status and return whether enabled and its size */
async function checkZram(): Promise<{ enabled: boolean; size: string }> {
	try {
		const { stdout } = await execFileAsync('/usr/sbin/zramctl', [
			'--output',
			'NAME,DISKSIZE,DATA,COMPR'
		]);
		if (stdout.includes('/dev/zram')) {
			const match = stdout.match(/\/dev\/zram\d+\s+([0-9.]+[GMK])/);
			return { enabled: true, size: match ? match[1] : '0MB' };
		}
	} catch {
		// zramctl not available or no zram devices
	}
	return { enabled: false, size: '0MB' };
}

export const GET = createHandler(async () => {
	const totalMem = os.totalmem();
	const freeMem = os.freemem();
	const usedMem = totalMem - freeMem;
	const memoryPercentage = Math.round((usedMem / totalMem) * 100);

	const heapStats = process.memoryUsage();
	const heapUsedMB = Math.round(heapStats.heapUsed / 1024 / 1024);
	const heapTotalMB = Math.round(heapStats.heapTotal / 1024 / 1024);

	const [earlyoomRunning, zram] = await Promise.all([checkEarlyoom(), checkZram()]);

	const risk = assessSystemMemoryRisk(memoryPercentage);
	assessHeapRisk(risk, heapUsedMB);
	assessProtectionRisk(risk, earlyoomRunning, zram.enabled);

	return {
		success: true,
		risk_level: risk.level,
		risk_reasons: risk.reasons,
		system: {
			memory_used_mb: Math.round(usedMem / 1024 / 1024),
			memory_total_mb: Math.round(totalMem / 1024 / 1024),
			memory_percentage: memoryPercentage
		},
		nodejs: {
			heap_used_mb: heapUsedMB,
			heap_total_mb: heapTotalMB,
			heap_limit_mb: HEAP_LIMIT_MB,
			heap_percentage: Math.round((heapUsedMB / HEAP_LIMIT_MB) * 100)
		},
		protection: {
			earlyoom_running: earlyoomRunning,
			zram_enabled: zram.enabled,
			zram_size: zram.size
		}
	};
});
