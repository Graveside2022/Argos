/**
 * GSM Intelligent Scan — packet capture and process lifecycle helpers
 *
 * Low-level functions for running tcpdump / tshark captures, formatting
 * cell-identity event messages, and cleaning up child processes.
 * All functions are consumed exclusively by gsm-scan-frequency-analysis.ts.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import type { FrequencyTestResult } from '$lib/types/gsm';
import { logger } from '$lib/utils/logger';

import type { ScanEvent } from './gsm-scan-types';
import { createUpdateEvent } from './gsm-scan-types';

const execFileAsync = promisify(execFile);

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

/**
 * Append cell-identity status events to the events array.
 *
 * Inspects which identity fields were captured and pushes
 * corresponding PASS / WARN messages.
 *
 * @param events - Mutable array to push events into
 * @param label - Frequency progress label (e.g. "[FREQ 1/2]")
 * @param tsharkOutput - Raw tshark output
 * @param cellMcc - Parsed MCC value
 * @param _cellMnc - Parsed MNC value (unused in messages but kept for signature symmetry)
 * @param cellLac - Parsed LAC value
 * @param cellCi - Parsed CI value
 */
export function appendCellIdentityEvents(
	events: ScanEvent[],
	label: string,
	tsharkOutput: string,
	cellMcc: string,
	_cellMnc: string,
	cellLac: string,
	cellCi: string
): void {
	if (tsharkOutput) {
		const cellLineCount = tsharkOutput
			.trim()
			.split('\n')
			.filter((l: string) => l.trim() && !/^,*$/.test(l)).length;
		events.push(
			createUpdateEvent(`${label} Found ${cellLineCount} packets with cell/identity data`)
		);
		if (cellMcc && cellLac && cellCi) {
			events.push(createUpdateEvent(`${label} [PASS] Complete cell identity captured!`));
		} else if (cellLac && cellCi) {
			events.push(
				createUpdateEvent(
					`${label} [WARN] Partial: LAC/CI captured but no MCC/MNC (need IMSI packet)`
				)
			);
		} else if (cellMcc) {
			events.push(
				createUpdateEvent(
					`${label} [WARN] Partial: MCC/MNC captured but no LAC/CI (need Cell Identity packet)`
				)
			);
		} else {
			events.push(
				createUpdateEvent(
					`${label} [WARN] Cell identity incomplete (MCC=${cellMcc || 'missing'}, LAC=${cellLac || 'missing'}, CI=${cellCi || 'missing'})`
				)
			);
		}
	} else {
		events.push(createUpdateEvent(`${label} [WARN] No cell identity data captured`));
	}
}

/**
 * Append channel-type status events to the events array.
 *
 * Reports identified cell towers or warns about incomplete captures.
 *
 * @param events - Mutable array to push events into
 * @param label - Frequency progress label
 * @param cellMcc - Parsed MCC value
 * @param cellMnc - Parsed MNC value
 * @param cellLac - Parsed LAC value
 * @param cellCi - Parsed CI value
 * @param frameCount - Number of GSM frames detected
 * @param channelType - Determined channel type string
 */
export function appendChannelEvents(
	events: ScanEvent[],
	label: string,
	cellMcc: string,
	cellMnc: string | undefined,
	cellLac: string,
	cellCi: string,
	frameCount: number,
	channelType: string
): void {
	if (cellMcc && cellLac && cellCi) {
		events.push(
			createUpdateEvent(
				`${label} [RF] Cell Tower Identified: MCC=${cellMcc} MNC=${cellMnc || 'N/A'} LAC=${cellLac} CI=${cellCi}`
			)
		);
	} else if (frameCount > 0) {
		events.push(
			createUpdateEvent(
				`${label} [WARN] ${channelType || 'Unknown'} channel detected but no cell identity captured`
			)
		);
		events.push(
			createUpdateEvent(
				`${label} [TIP] TIP: Cell identity (MCC/LAC/CI) requires BCCH channel with System Information messages`
			)
		);
	}
}

/**
 * Kill the grgsm_livemon_headless process and any orphans for a given frequency.
 *
 * Attempts SIGTERM first, falls back to SIGKILL, then runs pkill
 * to catch orphaned processes matching the frequency.
 *
 * @param pid - PID string of the spawned process
 * @param freq - Frequency being tested (for orphan cleanup)
 * @param index - Zero-based frequency index
 * @param total - Total frequency count
 * @param events - Mutable array to push cleanup events into
 */
export async function cleanupProcess(
	pid: string,
	freq: string,
	index: number,
	total: number,
	events: ScanEvent[]
): Promise<void> {
	const label = `[FREQ ${index + 1}/${total}]`;
	if (pid && pid !== '0') {
		const validKillPid = validateNumericParam(parseInt(pid), 'pid', 1, 4194304);
		try {
			await execFileAsync('/usr/bin/sudo', ['/usr/bin/kill', String(validKillPid)]);
			events.push(createUpdateEvent(`${label} Cleaned up process ${pid}`));
		} catch (_error: unknown) {
			try {
				await execFileAsync('/usr/bin/sudo', ['/usr/bin/kill', '-9', String(validKillPid)]);
			} catch (_error: unknown) {
				// Process already exited — that's fine
			}
		}
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
}
