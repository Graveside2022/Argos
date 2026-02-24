/**
 * GSM Intelligent Scan — packet capture and process lifecycle helpers
 *
 * Low-level functions for running tcpdump / tshark captures and cleaning
 * up child processes.  Cell-identity event formatting lives in
 * gsm-scan-events.ts.
 * All functions are consumed exclusively by gsm-scan-frequency-analysis.ts.
 */

import { execFileAsync } from '$lib/server/exec';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import type { FrequencyTestResult } from '$lib/types/gsm';
import { logger } from '$lib/utils/logger';

import type { ScanEvent } from './gsm-scan-types';
import { createUpdateEvent } from './gsm-scan-types';

/**
 * Build a default "failed" FrequencyTestResult for a given frequency.
 *
 * @param freq - The frequency that failed testing
 * @returns A zeroed-out result with strength "Error"
 */
export function buildFailedResult(freq: string): FrequencyTestResult {
	return {
		frequency: freq,
		power: -100,
		frameCount: 0,
		hasGsmActivity: false,
		strength: 'Error',
		channelType: '',
		controlChannel: false
	};
}

/**
 * Run tcpdump on the loopback interface for GSMTAP packets (port 4729).
 *
 * Returns the count of matching lines as a string.  The capture runs
 * for `captureTime` seconds via `/usr/bin/timeout`.
 *
 * @param captureTime - Duration in seconds
 * @returns String representation of the captured line count
 */
export async function captureTcpdump(captureTime: number): Promise<string> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/sudo', [
			'/usr/bin/timeout',
			String(captureTime),
			'/usr/sbin/tcpdump',
			'-i',
			'lo',
			'-nn',
			'port',
			'4729'
		]);
		return String(stdout.split('\n').filter((l) => l.includes('127.0.0.1.4729')).length);
	} catch (error: unknown) {
		const err = error as { stdout?: string };
		if (err.stdout) {
			return String(
				err.stdout.split('\n').filter((l) => l.includes('127.0.0.1.4729')).length
			);
		}
		return '0';
	}
}

/**
 * Run tshark on the loopback interface to extract GSM cell-identity fields
 * (MCC, MNC, LAC, CI) from GSMTAP packets.
 *
 * Returns filtered lines containing at least one digit.
 *
 * @param captureTime - Duration in seconds
 * @returns Newline-separated tshark output (max 30 lines)
 */
export async function captureTshark(captureTime: number): Promise<string> {
	try {
		const { stdout } = await execFileAsync(
			'/usr/bin/sudo',
			[
				'/usr/bin/timeout',
				String(captureTime),
				'/usr/bin/tshark',
				'-i',
				'lo',
				'-f',
				'udp port 4729',
				'-T',
				'fields',
				'-e',
				'e212.lai.mcc',
				'-e',
				'e212.lai.mnc',
				'-e',
				'gsm_a.lac',
				'-e',
				'gsm_a.bssmap.cell_ci',
				'-E',
				'separator=,',
				'-c',
				'300'
			],
			{ timeout: captureTime * 1000 + 3000 }
		);
		return stdout
			.split('\n')
			.filter((l) => l.trim() && !/^,*$/.test(l) && /[0-9]/.test(l))
			.slice(0, 30)
			.join('\n');
	} catch (error: unknown) {
		const err = error as { stdout?: string };
		if (err.stdout) {
			return err.stdout
				.split('\n')
				.filter((l) => l.trim() && !/^,*$/.test(l) && /[0-9]/.test(l))
				.slice(0, 30)
				.join('\n');
		}
		return '';
	}
}

/** Kill a process by PID with SIGTERM, falling back to SIGKILL */
async function killWithFallback(validPid: number): Promise<boolean> {
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/kill', String(validPid)]);
		return true;
	} catch {
		try {
			await execFileAsync('/usr/bin/sudo', ['/usr/bin/kill', '-9', String(validPid)]);
		} catch {
			// Process already exited
		}
		return false;
	}
}

/** Kill orphaned grgsm processes matching a frequency */
async function killOrphans(freq: string): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', [
			'/usr/bin/pkill',
			'-f',
			`grgsm_livemon_headless.*-f ${freq}M`
		]);
	} catch (error: unknown) {
		logger.warn('[gsm-evil] Cleanup: pkill orphaned grgsm process failed', {
			freq,
			error: String(error)
		});
	}
}

export async function cleanupProcess(
	pid: string,
	freq: string,
	index: number,
	total: number,
	events: ScanEvent[]
): Promise<void> {
	if (!pid || pid === '0') return;
	const validKillPid = validateNumericParam(parseInt(pid), 'pid', 1, 4194304);
	const label = `[FREQ ${index + 1}/${total}]`;
	const killed = await killWithFallback(validKillPid);
	if (killed) events.push(createUpdateEvent(`${label} Cleaned up process ${pid}`));
	await killOrphans(freq);
}
