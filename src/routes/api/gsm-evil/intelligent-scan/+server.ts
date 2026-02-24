import { spawn } from 'child_process';

import { createHandler } from '$lib/server/api/create-handler';
import { execFileAsync } from '$lib/server/exec';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import type { FrequencyTestResult } from '$lib/types/gsm';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

const CHECK_FREQS = ['947.2', '950.0'];

/** Signal strength thresholds in descending order */
const STRENGTH_THRESHOLDS: [number, string][] = [
	[-25, 'Excellent'],
	[-30, 'Very Strong'],
	[-35, 'Strong'],
	[-45, 'Good'],
	[-55, 'Moderate']
];

function categorizeStrength(power: number): string {
	const match = STRENGTH_THRESHOLDS.find(([threshold]) => power > threshold);
	return match ? match[1] : 'Weak';
}

async function performRfSweep(): Promise<string> {
	try {
		const { stdout } = await execFileAsync(
			'/usr/bin/timeout',
			['10', 'hackrf_sweep', '-f', '935:960', '-l', '32', '-g', '20'],
			{ timeout: 15000 }
		);
		const lines = stdout.split('\n').filter((l) => /^[0-9]/.test(l));
		lines.sort(
			(a, b) => parseFloat(a.split(',')[5] || '0') - parseFloat(b.split(',')[5] || '0')
		);
		return lines.slice(-20).join('\n');
	} catch (error: unknown) {
		logger.error('[gsm-evil-scan] HackRF sweep failed', { error: String(error) });
		return '';
	}
}

function isFrequencyInRange(
	freq: number,
	startFreq: number,
	endFreq: number,
	power: number
): boolean {
	return freq >= startFreq && freq <= endFreq && power > -60;
}

interface SweepBin {
	startFreq: number;
	endFreq: number;
	power: number;
}

function parseSweepLine(line: string): SweepBin | null {
	const parts = line.split(',').map((p) => p.trim());
	if (parts.length < 7) return null;
	return {
		startFreq: parseInt(parts[2]) / 1e6,
		endFreq: parseInt(parts[3]) / 1e6,
		power: parseFloat(parts[6])
	};
}

function updateFrequencyMap(bin: SweepBin, frequencies: Map<string, number>): void {
	for (const freq of CHECK_FREQS) {
		if (isFrequencyInRange(parseFloat(freq), bin.startFreq, bin.endFreq, bin.power)) {
			const existing = frequencies.get(freq) || -100;
			frequencies.set(freq, Math.max(existing, bin.power));
		}
	}
}

function parseStrongFrequencies(sweepData: string): Map<string, number> {
	const lines = sweepData.split('\n').filter((line) => line.trim());
	const strongFrequencies = new Map<string, number>();

	for (const line of lines) {
		const bin = parseSweepLine(line);
		if (bin) updateFrequencyMap(bin, strongFrequencies);
	}

	return strongFrequencies;
}

function extractFrameCountFromError(error: unknown): number {
	const execError = error as { stdout?: string };
	if (execError.stdout) {
		return execError.stdout.split('\n').filter((l: string) => l.trim()).length;
	}
	logger.warn('[gsm-evil-scan] tcpdump check failed', { error: String(error) });
	return 0;
}

async function countGsmtapFrames(): Promise<number> {
	try {
		const { stdout: packetData } = await execFileAsync(
			'/usr/bin/sudo',
			['timeout', '3', 'tcpdump', '-i', 'lo', '-nn', 'port', '4729'],
			{ timeout: 5000 }
		);
		return packetData.split('\n').filter((l) => l.trim()).length;
	} catch (error: unknown) {
		return extractFrameCountFromError(error);
	}
}

function spawnGrgsm(validFreq: number): number | undefined {
	const child = spawn(
		'/usr/bin/sudo',
		['grgsm_livemon_headless', '-f', `${validFreq}M`, '-g', '40'],
		{ detached: true, stdio: ['ignore', 'ignore', 'ignore'] }
	);
	child.unref();
	return child.pid;
}

async function killGrgsm(pid: number): Promise<void> {
	try {
		const validPid = validateNumericParam(pid, 'pid', 1, 4194304);
		await execFileAsync('/usr/bin/sudo', ['kill', String(validPid)]);
	} catch (error: unknown) {
		logger.warn('[gsm-evil] Cleanup: kill grgsm_livemon process failed', {
			error: String(error)
		});
	}
}

async function testFrequency(freq: string, power: number): Promise<FrequencyTestResult | null> {
	const validFreq = validateNumericParam(parseFloat(freq), 'frequency', 800, 1000);
	const pid = spawnGrgsm(validFreq);

	if (!pid) {
		logger.warn('[gsm-evil-scan] Failed to spawn grgsm_livemon_headless');
		return null;
	}

	await delay(2000);
	const frameCount = await countGsmtapFrames();
	await killGrgsm(pid);

	return {
		frequency: freq,
		power: power,
		frameCount: frameCount,
		hasGsmActivity: frameCount > 10,
		strength: categorizeStrength(power),
		channelType: frameCount > 0 ? 'BCCH/CCCH' : '',
		controlChannel: frameCount > 0
	};
}

async function testAllFrequencies(
	candidateFreqs: [string, number][]
): Promise<FrequencyTestResult[]> {
	const results: FrequencyTestResult[] = [];

	for (const [freq, power] of candidateFreqs) {
		logger.debug('Testing frequency', { freq });
		const result = await testFrequency(freq, power);
		if (result) results.push(result);
		await delay(500);
	}

	return results;
}

function buildScanResponse(results: FrequencyTestResult[]) {
	results.sort((a, b) => b.frameCount - a.frameCount);
	const bestFreq = results.find((r) => r.hasGsmActivity) || results[0];

	const summaryLines = results.map(
		(r) =>
			`${r.frequency} MHz: ${r.power.toFixed(1)} dB (${r.strength}) - ${r.frameCount} frames${r.hasGsmActivity ? ' [OK]' : ''}`
	);

	return {
		success: true,
		bestFrequency: bestFreq.frequency,
		bestFrequencyFrames: bestFreq.frameCount,
		message: `Intelligent scan complete!\n\nBest frequency: ${bestFreq.frequency} MHz with ${bestFreq.frameCount} GSM frames\n\nAll results:\n${summaryLines.join('\n')}`,
		scanResults: results,
		totalTested: results.length
	};
}

/** Perform RF sweep and extract candidate frequencies sorted by power. */
async function findCandidateFrequencies(): Promise<{
	candidates: [string, number][];
	error?: string;
}> {
	const sweepData = await performRfSweep();
	if (!sweepData) return { candidates: [], error: 'No signals detected during RF sweep' };

	const strongFrequencies = parseStrongFrequencies(sweepData);
	const candidates = Array.from(strongFrequencies.entries()).sort((a, b) => b[1] - a[1]);
	if (candidates.length === 0)
		return { candidates: [], error: 'No frequencies with sufficient signal strength found' };

	return { candidates };
}

export const POST = createHandler(async () => {
	logger.info('Starting intelligent GSM frequency scan');
	const { candidates, error } = await findCandidateFrequencies();
	if (error) return { success: false, message: error };

	logger.info('Testing frequencies for GSM activity', { count: candidates.length });
	const results = await testAllFrequencies(candidates);

	return buildScanResponse(results);
});
