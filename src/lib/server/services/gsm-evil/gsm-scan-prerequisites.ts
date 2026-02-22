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
export async function checkPrerequisites(): Promise<PrerequisiteResult> {
	const events: ScanEvent[] = [];
	events.push(createUpdateEvent('[SCAN] Running prerequisite checks...'));

	// Check grgsm_livemon_headless is installed
	try {
		await execFileAsync('/usr/bin/which', ['grgsm_livemon_headless']);
		events.push(createUpdateEvent('[SCAN] grgsm_livemon_headless found'));
	} catch (_error: unknown) {
		events.push(
			createErrorEvent(
				'grgsm_livemon_headless is not installed. Install the gr-gsm package to enable GSM scanning.'
			)
		);
		return { success: false, events };
	}

	// Check tcpdump is available
	try {
		await execFileAsync('/usr/bin/which', ['tcpdump']);
		events.push(createUpdateEvent('[SCAN] tcpdump found'));
	} catch (_error: unknown) {
		events.push(
			createUpdateEvent('[SCAN] WARNING: tcpdump not found — packet counting may fail')
		);
	}

	// Check HackRF is accessible
	try {
		const result = await execFileAsync('/usr/bin/hackrf_info');
		const output = result.stdout + result.stderr;
		if (output.includes('No HackRF boards found') || output.includes('hackrf_open')) {
			events.push(
				createUpdateEvent(
					'[SCAN] WARNING: hackrf_info reports no HackRF device — scan may fail'
				)
			);
		} else {
			events.push(createUpdateEvent('[SCAN] HackRF detected'));
		}
	} catch (_error: unknown) {
		events.push(
			createUpdateEvent('[SCAN] WARNING: hackrf_info check failed — scan will attempt anyway')
		);
	}

	return { success: true, events };
}

/**
 * Acquire the HackRF resource, recovering stale locks when the owning
 * process is no longer running.
 *
 * @returns PrerequisiteResult — success indicates whether the HackRF is now held
 */
export async function acquireHackrf(): Promise<PrerequisiteResult> {
	const events: ScanEvent[] = [];
	events.push(createUpdateEvent('[SCAN] Acquiring SDR hardware...'));

	let acquireResult = await resourceManager.acquire('gsm-scan', HardwareDevice.HACKRF);

	if (!acquireResult.success) {
		const owner = acquireResult.owner || 'unknown';
		events.push(
			createUpdateEvent(`[SCAN] HackRF held by "${owner}" — checking if still active...`)
		);

		try {
			let gsmProc = '';
			try {
				const { stdout } = await execFileAsync('/usr/bin/pgrep', [
					'-f',
					'grgsm_livemon_headless|GsmEvil'
				]);
				gsmProc = stdout;
			} catch {
				// pgrep returns non-zero when no match — treat as empty
			}

			if (!gsmProc.trim()) {
				events.push(
					createUpdateEvent(
						`[SCAN] No active GSM/GsmEvil process found — releasing stale "${owner}" lock`
					)
				);
				await resourceManager.forceRelease(HardwareDevice.HACKRF);
				acquireResult = await resourceManager.acquire('gsm-scan', HardwareDevice.HACKRF);
			} else {
				events.push(
					createUpdateEvent(
						`[SCAN] Found running GSM processes — killing them to free HackRF...`
					)
				);
				try {
					await execFileAsync('/usr/bin/sudo', [
						'/usr/bin/pkill',
						'-f',
						'grgsm_livemon_headless'
					]);
				} catch {
					/* no match is fine */
				}
				try {
					await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'GsmEvil']);
				} catch {
					/* no match is fine */
				}
				await new Promise((resolve) => setTimeout(resolve, 1000));
				await resourceManager.forceRelease(HardwareDevice.HACKRF);
				acquireResult = await resourceManager.acquire('gsm-scan', HardwareDevice.HACKRF);
			}
		} catch (_error: unknown) {
			events.push(
				createUpdateEvent('[SCAN] Process check failed — forcing resource release')
			);
			await resourceManager.forceRelease(HardwareDevice.HACKRF);
			acquireResult = await resourceManager.acquire('gsm-scan', HardwareDevice.HACKRF);
		}

		if (!acquireResult.success) {
			events.push(
				createErrorEvent(
					`HackRF is currently in use by "${acquireResult.owner}". Stop it first before scanning.`
				)
			);
			return { success: false, events };
		}
	}

	events.push(createUpdateEvent('[SCAN] SDR hardware acquired'));
	return { success: true, events };
}
