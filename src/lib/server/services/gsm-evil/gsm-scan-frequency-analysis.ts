/**
 * GSM Intelligent Scan — single-frequency test and capture
 *
 * Spawns grgsm_livemon_headless on one frequency, runs parallel
 * tcpdump + tshark captures, and returns a FrequencyTestResult
 * with cell identity and signal classification.
 */

import { spawn } from 'child_process';
import { closeSync, openSync } from 'fs';
import { readFile, unlink } from 'fs/promises';

import { validateNumericParam, validatePathWithinDir } from '$lib/server/security/input-sanitizer';
import type { FrequencyTestResult } from '$lib/types/gsm';
import { logger } from '$lib/utils/logger';
import { validateGain } from '$lib/validators/gsm';

import {
	appendCellIdentityEvents,
	appendChannelEvents,
	buildFailedResult,
	captureTcpdump,
	captureTshark,
	cleanupProcess
} from './gsm-scan-capture';
import type { ScanEvent } from './gsm-scan-types';
import { createResultEvent, createUpdateEvent } from './gsm-scan-types';
import {
	analyzeGsmFrames,
	classifySignalStrength,
	determineChannelType,
	parseCellIdentity
} from './protocol-parser';

/** Outcome of testing a single frequency */
export interface FrequencyTestOutcome {
	result: FrequencyTestResult;
	events: ScanEvent[];
}

/**
 * Test a single GSM frequency for activity and cell identity.
 *
 * Spawns grgsm_livemon_headless, waits for demodulator initialisation,
 * then runs parallel tcpdump (frame count) and tshark (cell identity)
 * captures.  Always cleans up the child process on exit.
 *
 * @param freq - Centre frequency in MHz (e.g. "947.2")
 * @param index - Zero-based index within the scan
 * @param total - Total number of frequencies being scanned
 * @returns FrequencyTestOutcome with the result and ordered events
 */
export async function testFrequency(
	freq: string,
	index: number,
	total: number
): Promise<FrequencyTestOutcome> {
	const events: ScanEvent[] = [];
	const label = `[FREQ ${index + 1}/${total}]`;
	let pid = '';
	const stderrLog = `/tmp/grgsm_scan_${Date.now()}_${index}.log`;
	validatePathWithinDir(stderrLog, '/tmp');

	try {
		// Validate gain parameter
		let validatedGain: number;
		try {
			validatedGain = validateGain(40);
		} catch (validationError) {
			events.push(
				createUpdateEvent(
					`[ERROR] Invalid gain parameter: ${(validationError as Error).message}`
				)
			);
			return { result: buildFailedResult(freq), events };
		}

		events.push(createUpdateEvent(`${label} Testing ${freq} MHz...`));
		events.push(createUpdateEvent(`[DEVICE] Using HackRF`));

		const power = -100;

		// Build grgsm command args
		const gsmArgs = ['grgsm_livemon_headless', '-f', `${freq}M`, '-g', String(validatedGain)];
		events.push(createUpdateEvent(`[CMD] $ sudo ${gsmArgs.join(' ')}`));

		// Start grgsm — redirect stdout and stderr to temp file
		const logFd = openSync(stderrLog, 'a');
		const child = spawn('/usr/bin/sudo', gsmArgs, {
			detached: true,
			stdio: ['ignore', logFd, logFd]
		});
		child.unref();
		closeSync(logFd);
		const spawnedPid = child.pid;
		if (!spawnedPid) throw new Error('Failed to start grgsm_livemon_headless');
		pid = String(spawnedPid);
		validateNumericParam(pid, 'pid', 1, 4194304);

		if (!pid || pid === '0') {
			throw new Error('Failed to start grgsm_livemon_headless');
		}

		events.push(
			createUpdateEvent(
				`${label} Process started (PID ${pid}), waiting for demodulator initialization...`
			)
		);

		// Wait for HackRF initialization
		await new Promise((resolve) => setTimeout(resolve, 2500));

		// Verify process is still running
		try {
			const validPid = validateNumericParam(parseInt(pid), 'pid', 1, 4194304);
			process.kill(validPid, 0);
		} catch (_error: unknown) {
			let stderrContent = '';
			try {
				const logContent = await readFile(stderrLog, 'utf-8');
				stderrContent = logContent.split('\n').slice(-10).join('\n').trim();
			} catch {
				/* ignore */
			}
			const errorDetail = stderrContent
				? `grgsm_livemon_headless exited during init. Error: ${stderrContent}`
				: 'grgsm_livemon_headless exited during init with no error output. Check if HackRF is accessible.';
			events.push(createUpdateEvent(`[ERROR] ${errorDetail}`));
			throw new Error(errorDetail);
		}

		const captureTime = 15;
		events.push(
			createUpdateEvent(
				`${label} Capturing GSMTAP packets for ${captureTime}s (extended for System Information)...`
			)
		);

		// Run tcpdump + tshark in parallel
		const [tcpdumpResult, tsharkResult] = await Promise.all([
			captureTcpdump(captureTime),
			captureTshark(captureTime)
		]);

		const frameCount = parseInt(String(tcpdumpResult).trim()) || 0;
		const cellId = parseCellIdentity(String(tsharkResult));
		const { mcc: cellMcc, mnc: cellMnc, lac: cellLac, ci: cellCi } = cellId;

		// Report cell identity results
		appendCellIdentityEvents(events, label, tsharkResult, cellMcc, cellMnc, cellLac, cellCi);

		// Analyse channel types from frame content
		let frameAnalysis = null;
		if (frameCount > 0 && !(cellMcc && cellLac && cellCi)) {
			try {
				const logContent = await readFile(stderrLog, 'utf-8');
				const hexLines = logContent
					.split('\n')
					.filter((l) => /^\s*[0-9a-f]{2}\s/.test(l))
					.slice(-30);
				frameAnalysis = analyzeGsmFrames(hexLines, frameCount);
			} catch (_error: unknown) {
				// Hex log unreadable — determineChannelType handles null
			}
		}

		const channelResult = determineChannelType(cellId, frameAnalysis, frameCount);
		const channelType = channelResult.channelType;
		const controlChannel = channelResult.isControlChannel;

		appendChannelEvents(
			events,
			label,
			cellMcc,
			cellMnc,
			cellLac,
			cellCi,
			frameCount,
			channelType
		);

		const strength = classifySignalStrength(power, frameCount);
		const hasActivity = frameCount > 10;

		events.push(
			createUpdateEvent(
				`${label} Result: ${frameCount} GSM frames detected ${hasActivity ? '(active)' : '(no activity)'}`
			)
		);
		events.push(createUpdateEvent(`${label} Signal: ${frameCount} frames (${strength})`));
		if (channelType) {
			events.push(
				createUpdateEvent(
					`${label} Channel: ${channelType}${controlChannel ? ' (Control Channel - Good for IMSI)' : ''}`
				)
			);
		}
		events.push(createUpdateEvent('[SCAN] '));

		const frequencyResult: FrequencyTestResult = {
			frequency: freq,
			power,
			frameCount,
			hasGsmActivity: hasActivity,
			strength,
			channelType,
			controlChannel,
			mcc: cellMcc,
			mnc: cellMnc,
			lac: cellLac,
			ci: cellCi
		};

		events.push(
			createResultEvent({
				type: 'frequency_result',
				frequency: freq,
				result: frequencyResult,
				progress: { current: index + 1, total, completed: index + 1 }
			})
		);

		return { result: frequencyResult, events };
	} catch (freqError) {
		events.push(
			createUpdateEvent(`${label} Error testing ${freq} MHz: ${(freqError as Error).message}`)
		);
		events.push(createUpdateEvent(`${label} Skipping to next frequency...`));
		events.push(createUpdateEvent('[SCAN] '));

		const failedResult = buildFailedResult(freq);
		events.push(
			createResultEvent({
				type: 'frequency_result',
				frequency: freq,
				result: failedResult,
				progress: { current: index + 1, total, completed: index + 1 }
			})
		);

		return { result: failedResult, events };
	} finally {
		await cleanupProcess(pid, freq, index, total, events);
		try {
			await unlink(stderrLog);
		} catch (error: unknown) {
			logger.warn('[gsm-evil] Cleanup: rm stderr log failed (non-critical)', {
				error: String(error)
			});
		}
	}
}
