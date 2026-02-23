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
/** Count valid cell-identity lines in tshark output */
function countCellLines(tsharkOutput: string): number {
	return tsharkOutput
		.trim()
		.split('\n')
		.filter((l: string) => l.trim() && !/^,*$/.test(l)).length;
}

/** Encode cell identity presence as a 3-bit key: mcc|lac|ci */
function cellPresenceKey(cellMcc: string, cellLac: string, cellCi: string): number {
	return (cellMcc ? 4 : 0) | (cellLac ? 2 : 0) | (cellCi ? 1 : 0);
}

/** Map presence bitmask to completeness label */
const COMPLETENESS_MAP: Record<number, string> = {
	7: 'complete', // mcc + lac + ci
	3: 'missing-mcc', // lac + ci
	4: 'missing-lac-ci', // mcc only
	6: 'missing-lac-ci', // mcc + lac (no ci)
	5: 'missing-lac-ci' // mcc + ci (no lac — treat as partial)
};

/** Classify the completeness of parsed cell identity fields */
function classifyCellCompleteness(cellMcc: string, cellLac: string, cellCi: string): string {
	return COMPLETENESS_MAP[cellPresenceKey(cellMcc, cellLac, cellCi)] ?? 'incomplete';
}

/** Map cell completeness to a user-facing message */
function cellCompletenessMessage(
	label: string,
	completeness: string,
	cellMcc: string,
	cellLac: string,
	cellCi: string
): string {
	const messages: Record<string, string> = {
		complete: `${label} [PASS] Complete cell identity captured!`,
		'missing-mcc': `${label} [WARN] Partial: LAC/CI captured but no MCC/MNC (need IMSI packet)`,
		'missing-lac-ci': `${label} [WARN] Partial: MCC/MNC captured but no LAC/CI (need Cell Identity packet)`
	};
	return (
		messages[completeness] ??
		`${label} [WARN] Cell identity incomplete (MCC=${cellMcc || 'missing'}, LAC=${cellLac || 'missing'}, CI=${cellCi || 'missing'})`
	);
}

export function appendCellIdentityEvents(
	events: ScanEvent[],
	label: string,
	tsharkOutput: string,
	cellMcc: string,
	_cellMnc: string,
	cellLac: string,
	cellCi: string
): void {
	if (!tsharkOutput) {
		events.push(createUpdateEvent(`${label} [WARN] No cell identity data captured`));
		return;
	}
	events.push(
		createUpdateEvent(
			`${label} Found ${countCellLines(tsharkOutput)} packets with cell/identity data`
		)
	);
	const completeness = classifyCellCompleteness(cellMcc, cellLac, cellCi);
	events.push(
		createUpdateEvent(cellCompletenessMessage(label, completeness, cellMcc, cellLac, cellCi))
	);
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
/** Emit cell tower identification or channel warning events */
function emitTowerIdentified(
	events: ScanEvent[],
	label: string,
	cellMcc: string,
	cellMnc: string | undefined,
	cellLac: string,
	cellCi: string
): void {
	events.push(
		createUpdateEvent(
			`${label} [RF] Cell Tower Identified: MCC=${cellMcc} MNC=${cellMnc || 'N/A'} LAC=${cellLac} CI=${cellCi}`
		)
	);
}

/** Emit channel-detected-without-identity warning events */
function emitChannelWarning(events: ScanEvent[], label: string, channelType: string): void {
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
		emitTowerIdentified(events, label, cellMcc, cellMnc, cellLac, cellCi);
	} else if (frameCount > 0) {
		emitChannelWarning(events, label, channelType);
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
