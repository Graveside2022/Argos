/**
 * GSM Intelligent Scan — prerequisite checks and HackRF acquisition
 *
 * Phase 0: Verify grgsm_livemon_headless, tcpdump, and HackRF are accessible.
 * Phase 1: Acquire the HackRF resource via the resource manager, recovering
 *          stale locks when the owning process has already exited.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';

import type { ScanEvent } from './gsm-scan-types';
import { createErrorEvent, createUpdateEvent } from './gsm-scan-types';

const execFileAsync = promisify(execFile);

/** Outcome of prerequisite + acquisition phases */
export interface PrerequisiteResult {
	/** Whether the HackRF was successfully acquired */
	success: boolean;
	/** Ordered list of scan events generated during the phases */
	events: ScanEvent[];
}

/**
 * Run prerequisite checks for grgsm, tcpdump, and HackRF hardware.
 *
 * Yields progress events as each tool is verified. If
 * grgsm_livemon_headless is missing the returned result has
 * `success: false` and the caller should abort.
 *
 * @returns PrerequisiteResult with events and success flag
 */
/** Check if a binary is found via `which` and push an event */
async function checkBinary(
	events: ScanEvent[],
	binary: string,
	requiredMessage: string,
	warnMessage: string
): Promise<boolean> {
	try {
		await execFileAsync('/usr/bin/which', [binary]);
		events.push(createUpdateEvent(`[SCAN] ${binary} found`));
		return true;
	} catch {
		events.push(
			requiredMessage ? createErrorEvent(requiredMessage) : createUpdateEvent(warnMessage)
		);
		return false;
	}
}

/** Check HackRF availability via hackrf_info */
async function checkHackRfInfo(events: ScanEvent[]): Promise<void> {
	try {
		const result = await execFileAsync('/usr/bin/hackrf_info');
		const output = result.stdout + result.stderr;
		const noDevice =
			output.includes('No HackRF boards found') || output.includes('hackrf_open');
		events.push(
			createUpdateEvent(
				noDevice
					? '[SCAN] WARNING: hackrf_info reports no HackRF device — scan may fail'
					: '[SCAN] HackRF detected'
			)
		);
	} catch {
		events.push(
			createUpdateEvent('[SCAN] WARNING: hackrf_info check failed — scan will attempt anyway')
		);
	}
}

export async function checkPrerequisites(): Promise<PrerequisiteResult> {
	const events: ScanEvent[] = [];
	events.push(createUpdateEvent('[SCAN] Running prerequisite checks...'));

	const grgsmOk = await checkBinary(
		events,
		'grgsm_livemon_headless',
		'grgsm_livemon_headless is not installed. Install the gr-gsm package to enable GSM scanning.',
		''
	);
	if (!grgsmOk) return { success: false, events };

	await checkBinary(
		events,
		'tcpdump',
		'',
		'[SCAN] WARNING: tcpdump not found — packet counting may fail'
	);
	await checkHackRfInfo(events);

	return { success: true, events };
}

/**
 * Acquire the HackRF resource, recovering stale locks when the owning
 * process is no longer running.
 *
 * @returns PrerequisiteResult — success indicates whether the HackRF is now held
 */
/** Check for running GSM/GsmEvil processes via pgrep */
async function findGsmProcesses(): Promise<string> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', [
			'-f',
			'grgsm_livemon_headless|GsmEvil'
		]);
		return stdout;
	} catch {
		// pgrep returns non-zero when no match — treat as empty
		return '';
	}
}

/** Kill grgsm and GsmEvil processes (best-effort) */
async function killGsmProcesses(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'grgsm_livemon_headless']);
	} catch {
		/* no match is fine */
	}
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'GsmEvil']);
	} catch {
		/* no match is fine */
	}
	await new Promise((resolve) => setTimeout(resolve, 1000));
}

/** Force-release HackRF and re-acquire for gsm-scan */
async function forceReleaseAndReacquire(): Promise<{ success: boolean; owner?: string }> {
	await resourceManager.forceRelease(HardwareDevice.HACKRF);
	return resourceManager.acquire('gsm-scan', HardwareDevice.HACKRF);
}

/** Handle stale lock recovery when no GSM processes are running */
async function recoverStaleLock(
	events: ScanEvent[],
	owner: string
): Promise<{ success: boolean; owner?: string }> {
	events.push(
		createUpdateEvent(
			`[SCAN] No active GSM/GsmEvil process found — releasing stale "${owner}" lock`
		)
	);
	return forceReleaseAndReacquire();
}

/** Handle active process recovery by killing them first */
async function recoverActiveProcesses(
	events: ScanEvent[]
): Promise<{ success: boolean; owner?: string }> {
	events.push(
		createUpdateEvent('[SCAN] Found running GSM processes — killing them to free HackRF...')
	);
	await killGsmProcesses();
	return forceReleaseAndReacquire();
}

/** Attempt to recover HackRF from another owner */
async function attemptRecovery(
	events: ScanEvent[],
	owner: string
): Promise<{ success: boolean; owner?: string }> {
	try {
		const gsmProc = await findGsmProcesses();
		if (!gsmProc.trim()) return recoverStaleLock(events, owner);
		return recoverActiveProcesses(events);
	} catch {
		events.push(createUpdateEvent('[SCAN] Process check failed — forcing resource release'));
		return forceReleaseAndReacquire();
	}
}

export async function acquireHackrf(): Promise<PrerequisiteResult> {
	const events: ScanEvent[] = [];
	events.push(createUpdateEvent('[SCAN] Acquiring SDR hardware...'));

	let acquireResult = await resourceManager.acquire('gsm-scan', HardwareDevice.HACKRF);

	if (!acquireResult.success) {
		const owner = acquireResult.owner || 'unknown';
		events.push(
			createUpdateEvent(`[SCAN] HackRF held by "${owner}" — checking if still active...`)
		);
		acquireResult = await attemptRecovery(events, owner);
	}

	if (!acquireResult.success) {
		events.push(
			createErrorEvent(
				`HackRF is currently in use by "${acquireResult.owner}". Stop it first before scanning.`
			)
		);
		return { success: false, events };
	}

	events.push(createUpdateEvent('[SCAN] SDR hardware acquired'));
	return { success: true, events };
}
