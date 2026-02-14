import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { hostExec, isDockerContainer } from '$lib/server/host-exec';
import { validateNumericParam, validatePathWithinDir } from '$lib/server/security/input-sanitizer';
import type { FrequencyTestResult } from '$lib/types/gsm';
import { sanitizeGainForShell, validateGain } from '$lib/validators/gsm';

import {
	analyzeGsmFrames,
	classifySignalStrength,
	determineChannelType,
	parseCellIdentity
} from './protocol-parser';

export type ScanEventType = 'update' | 'result' | 'error';

export interface ScanEvent {
	type: ScanEventType;
	message?: string;
	result?: Record<string, unknown>;
}

/**
 * Perform intelligent GSM frequency scan with live progress streaming
 * Yields progress updates and results as they arrive
 *
 * Features:
 * - Prerequisite checks (grgsm, tcpdump, HackRF availability)
 * - HackRF resource acquisition with stale lock recovery
 * - Multi-frequency scanning with BCCH channel detection
 * - Parallel tcpdump (frame count) + tshark (cell identity) capture
 * - Real-time progress updates for SSE streaming
 * - Automatic resource cleanup
 *
 * @yields ScanEvent objects containing progress updates and results
 */
export async function* performIntelligentScan(): AsyncGenerator<ScanEvent> {
	const sendUpdate = (message: string): ScanEvent => ({
		type: 'update',
		message
	});

	const sendResult = (data: Record<string, unknown>): ScanEvent => ({
		type: 'result',
		result: data
	});

	const sendError = (error: string): ScanEvent => ({
		type: 'error',
		message: `[ERROR] ${error}`,
		result: {
			type: 'scan_complete',
			success: false,
			message: error,
			scanResults: [],
			totalTested: 0
		}
	});

	let hackrfAcquired = false;

	try {
		// ============================================
		// PHASE 0: Prerequisite Checks
		// ============================================
		yield sendUpdate('[SCAN] Running prerequisite checks...');

		// Detect if running in Docker — RF tools live on the host
		const inDocker = await isDockerContainer();
		if (inDocker) {
			yield sendUpdate('[SCAN] Running in Docker — using nsenter to access host RF tools');
		}

		// Check grgsm_livemon_headless is installed
		try {
			await hostExec('which grgsm_livemon_headless');
			yield sendUpdate('[SCAN] grgsm_livemon_headless found');
		} catch (_error: unknown) {
			yield sendError(
				'grgsm_livemon_headless is not installed. Install the gr-gsm package to enable GSM scanning.'
			);
			return;
		}

		// Check tcpdump is available
		try {
			await hostExec('which tcpdump');
			yield sendUpdate('[SCAN] tcpdump found');
		} catch (_error: unknown) {
			yield sendUpdate('[SCAN] WARNING: tcpdump not found — packet counting may fail');
		}

		// Check HackRF is accessible
		try {
			const { stdout } = await hostExec('hackrf_info 2>&1');
			if (stdout.includes('No HackRF boards found') || stdout.includes('hackrf_open')) {
				yield sendUpdate(
					'[SCAN] WARNING: hackrf_info reports no HackRF device — scan may fail'
				);
			} else {
				yield sendUpdate('[SCAN] HackRF detected');
			}
		} catch (_error: unknown) {
			yield sendUpdate('[SCAN] WARNING: hackrf_info check failed — scan will attempt anyway');
		}

		// ============================================
		// PHASE 1: Acquire HackRF Resource
		// ============================================
		yield sendUpdate('[SCAN] Acquiring SDR hardware...');
		let acquireResult = await resourceManager.acquire('gsm-scan', HardwareDevice.HACKRF);
		if (!acquireResult.success) {
			// Check if the owning process is actually running — if not, force-release stale lock
			const owner = acquireResult.owner || 'unknown';
			yield sendUpdate(`[SCAN] HackRF held by "${owner}" — checking if still active...`);
			try {
				// Check for both grgsm_livemon_headless AND GsmEvil.py processes
				const { stdout: gsmProc } = await hostExec(
					'pgrep -f "grgsm_livemon_headless|GsmEvil" 2>/dev/null || true'
				);
				if (!gsmProc.trim()) {
					yield sendUpdate(
						`[SCAN] No active GSM/GsmEvil process found — releasing stale "${owner}" lock`
					);
					await resourceManager.forceRelease(HardwareDevice.HACKRF);
					acquireResult = await resourceManager.acquire(
						'gsm-scan',
						HardwareDevice.HACKRF
					);
				} else {
					// Processes are running — try to kill them before scanning
					yield sendUpdate(
						`[SCAN] Found running GSM processes — killing them to free HackRF...`
					);
					await hostExec('sudo pkill -f grgsm_livemon_headless 2>/dev/null || true');
					await hostExec('sudo pkill -f "GsmEvil" 2>/dev/null || true');
					await new Promise((resolve) => setTimeout(resolve, 1000));
					await resourceManager.forceRelease(HardwareDevice.HACKRF);
					acquireResult = await resourceManager.acquire(
						'gsm-scan',
						HardwareDevice.HACKRF
					);
				}
			} catch (_error: unknown) {
				// pgrep check failed — force release anyway
				yield sendUpdate('[SCAN] Process check failed — forcing resource release');
				await resourceManager.forceRelease(HardwareDevice.HACKRF);
				acquireResult = await resourceManager.acquire('gsm-scan', HardwareDevice.HACKRF);
			}

			if (!acquireResult.success) {
				yield sendError(
					`HackRF is currently in use by "${acquireResult.owner}". Stop it first before scanning.`
				);
				return;
			}
		}
		hackrfAcquired = true;
		yield sendUpdate('[SCAN] SDR hardware acquired');

		// ============================================
		// PHASE 2: Scan GSM-900 downlink frequencies
		// ============================================
		// GSM-900 downlink: 935–960 MHz. Full band sweep to find BCCH channels.
		// BCCH channels carry System Information with MCC/MNC/LAC/CI.
		// Scanning every ~0.4-1.0 MHz across the band for comprehensive coverage.
		const checkFreqs: string[] = ['947.2', '950.0'];
		yield sendUpdate(`[SCAN] Scanning ${checkFreqs.length} target frequencies`);

		yield sendUpdate('[SCAN] ');
		yield sendUpdate('[SCAN] Phase 2: GSM Frame Detection & BCCH Channel Discovery');
		yield sendUpdate(`[SCAN] Testing ${checkFreqs.length} frequencies for 15 seconds each...`);
		const estimatedTime = checkFreqs.length * 20; // ~20 seconds per freq (init + 15s capture + cleanup)
		const estimatedMinutes = Math.ceil(estimatedTime / 60);
		yield sendUpdate(
			`[SCAN] Estimated time: ~${estimatedMinutes} minutes (${estimatedTime} seconds)`
		);
		yield sendUpdate(
			'[SCAN] This comprehensive scan will identify BCCH channels with complete cell tower data'
		);
		yield sendUpdate('[SCAN] ');

		// Test each frequency
		const results: FrequencyTestResult[] = [];

		for (let i = 0; i < checkFreqs.length; i++) {
			const freq = checkFreqs[i];
			let pid = '';
			const stderrLog = `/tmp/grgsm_scan_${Date.now()}_${i}.log`;
			validatePathWithinDir(stderrLog, '/tmp');

			try {
				// Validate gain parameter (prevents command injection)
				let validatedGain: number;
				try {
					validatedGain = validateGain(40);
				} catch (validationError) {
					yield sendUpdate(
						`[ERROR] Invalid gain parameter: ${(validationError as Error).message}`
					);
					continue;
				}

				const safeGain = sanitizeGainForShell(validatedGain);

				yield sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Testing ${freq} MHz...`);
				yield sendUpdate(`[DEVICE] Using HackRF`);

				let strength = 'No Signal';
				let power = -100;

				// Build grgsm command for HackRF with sanitized parameters
				const grgsm_base = `sudo grgsm_livemon_headless -f ${freq}M -g ${safeGain}`;

				yield sendUpdate(`[CMD] $ ${grgsm_base}`);

				// Start grgsm — capture stdout (hex frames) and stderr to temp file for diagnostics
				// Background the process and echo its PID
				const { stdout: gsmPid } = await hostExec(
					`${grgsm_base} >${stderrLog} 2>&1 & echo $!`
				);

				pid = String(gsmPid).trim();
				validateNumericParam(pid, 'pid', 1, 4194304);

				// Validate process started
				if (!pid || pid === '0') {
					throw new Error('Failed to start grgsm_livemon_headless');
				}

				yield sendUpdate(
					`[FREQ ${i + 1}/${checkFreqs.length}] Process started (PID ${pid}), waiting for demodulator initialization...`
				);

				// Wait for HackRF initialization
				const initDelay = 2500;
				await new Promise((resolve) => setTimeout(resolve, initDelay));

				// Verify process is still running after init delay
				try {
					await hostExec(`sudo kill -0 ${pid} 2>/dev/null`);
				} catch (_error: unknown) {
					// Process died during init — read stderr for diagnostics
					let stderrContent = '';
					try {
						const { stdout: errLog } = await hostExec(
							`cat ${stderrLog} 2>/dev/null | tail -10`
						);
						stderrContent = String(errLog).trim();
					} catch (_error: unknown) {
						/* ignore */
					}

					const errorDetail = stderrContent
						? `grgsm_livemon_headless exited during init. Error: ${stderrContent}`
						: 'grgsm_livemon_headless exited during init with no error output. Check if HackRF is accessible.';
					yield sendUpdate(`[ERROR] ${errorDetail}`);
					throw new Error(errorDetail);
				}

				const captureTime = 15;
				yield sendUpdate(
					`[FREQ ${i + 1}/${checkFreqs.length}] Capturing GSMTAP packets for ${captureTime}s (extended for System Information)...`
				);

				// Run tcpdump (frame count) and tshark (cell identity) IN PARALLEL
				// tshark must run concurrently to capture SI3 messages as they arrive.
				const tcpdumpPromise = hostExec(
					`sudo timeout ${captureTime} tcpdump -i lo -nn port 4729 2>/dev/null | grep -c "127.0.0.1.4729" || true`
				).catch((error: unknown) => {
					console.warn('[gsm-evil-scan-stream] tcpdump failed', {
						error: String(error)
					});
					return { stdout: '0', stderr: '' };
				});

				// Capture cell identity from SI3/SI4 messages via tshark
				// Fields: e212.lai.mcc/mnc (from LAI in SI3/SI4), gsm_a.lac, gsm_a.bssmap.cell_ci (from SI3)
				const tsharkPromise = hostExec(
					`sudo timeout ${captureTime} tshark -i lo -f 'udp port 4729' -T fields -e e212.lai.mcc -e e212.lai.mnc -e gsm_a.lac -e gsm_a.bssmap.cell_ci -E separator=, -c 300 2>/dev/null | grep -v '^,*$' | grep -E '[0-9]' | head -30`,
					{ timeout: captureTime * 1000 + 3000 }
				).catch((error: unknown) => {
					console.warn('[gsm-evil-scan-stream] tshark failed', {
						error: String(error)
					});
					return { stdout: '', stderr: '' };
				});

				const [tcpdumpResult, tsharkResult] = await Promise.all([
					tcpdumpPromise,
					tsharkPromise
				]);

				const frameCount = parseInt(String(tcpdumpResult.stdout).trim()) || 0;

				// Parse tshark cell identity output using extracted pure function
				const cellId = parseCellIdentity(String(tsharkResult.stdout));
				const { mcc: cellMcc, mnc: cellMnc, lac: cellLac, ci: cellCi } = cellId;

				if (tsharkResult.stdout) {
					const cellLineCount = String(tsharkResult.stdout)
						.trim()
						.split('\n')
						.filter((l: string) => l.trim() && !/^,*$/.test(l)).length;
					yield sendUpdate(
						`[FREQ ${i + 1}/${checkFreqs.length}] Found ${cellLineCount} packets with cell/identity data`
					);

					// Report what we captured
					if (cellMcc && cellLac && cellCi) {
						yield sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] [PASS] Complete cell identity captured!`
						);
					} else if (cellLac && cellCi) {
						yield sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] [WARN] Partial: LAC/CI captured but no MCC/MNC (need IMSI packet)`
						);
					} else if (cellMcc) {
						yield sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] [WARN] Partial: MCC/MNC captured but no LAC/CI (need Cell Identity packet)`
						);
					} else {
						yield sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] [WARN] Cell identity incomplete (MCC=${cellMcc || 'missing'}, LAC=${cellLac || 'missing'}, CI=${cellCi || 'missing'})`
						);
					}
				} else {
					yield sendUpdate(
						`[FREQ ${i + 1}/${checkFreqs.length}] [WARN] No cell identity data captured`
					);
				}

				// Analyze channel types from actual frame content and tshark cell identity
				let frameAnalysis = null;
				if (frameCount > 0 && !(cellMcc && cellLac && cellCi)) {
					// Only read hex log when cell identity is incomplete
					try {
						const { stdout: recentLines } = await hostExec(
							`grep -E "^\\s*[0-9a-f]{2}\\s" ${stderrLog} 2>/dev/null | tail -30`
						);
						const hexLines = String(recentLines)
							.split('\n')
							.filter((l: string) => l.trim());
						frameAnalysis = analyzeGsmFrames(hexLines, frameCount);
					} catch (_error: unknown) {
						// Hex log unreadable — determineChannelType handles null
					}
				}

				const channelResult = determineChannelType(cellId, frameAnalysis, frameCount);
				const channelType = channelResult.channelType;
				const controlChannel = channelResult.controlChannel;

				if (cellMcc && cellLac && cellCi) {
					yield sendUpdate(
						`[FREQ ${i + 1}/${checkFreqs.length}] [RF] Cell Tower Identified: MCC=${cellMcc} MNC=${cellMnc || 'N/A'} LAC=${cellLac} CI=${cellCi}`
					);
				} else if (frameCount > 0) {
					yield sendUpdate(
						`[FREQ ${i + 1}/${checkFreqs.length}] [WARN] ${channelType || 'Unknown'} channel detected but no cell identity captured`
					);
					yield sendUpdate(
						`[FREQ ${i + 1}/${checkFreqs.length}] [TIP] TIP: Cell identity (MCC/LAC/CI) requires BCCH channel with System Information messages`
					);
				}

				// Classify signal strength using extracted pure function
				strength = classifySignalStrength(power, frameCount);

				const hasActivity = frameCount > 10;

				yield sendUpdate(
					`[FREQ ${i + 1}/${checkFreqs.length}] Result: ${frameCount} GSM frames detected ${hasActivity ? '(active)' : '(no activity)'}`
				);
				yield sendUpdate(
					`[FREQ ${i + 1}/${checkFreqs.length}] Signal: ${frameCount} frames (${strength})`
				);
				if (channelType) {
					yield sendUpdate(
						`[FREQ ${i + 1}/${checkFreqs.length}] Channel: ${channelType}${controlChannel ? ' (Control Channel - Good for IMSI)' : ''}`
					);
				}
				yield sendUpdate('[SCAN] ');

				const frequencyResult: FrequencyTestResult = {
					frequency: freq,
					power: power,
					frameCount: frameCount,
					hasGsmActivity: hasActivity,
					strength: strength,
					channelType: channelType,
					controlChannel: controlChannel,
					mcc: cellMcc,
					mnc: cellMnc,
					lac: cellLac,
					ci: cellCi
				};

				results.push(frequencyResult);

				// Send intermediate result for real-time UI updates
				yield sendResult({
					type: 'frequency_result',
					frequency: freq,
					result: frequencyResult,
					progress: {
						current: i + 1,
						total: checkFreqs.length,
						completed: i + 1
					}
				});
			} catch (freqError) {
				yield sendUpdate(
					`[FREQ ${i + 1}/${checkFreqs.length}] Error testing ${freq} MHz: ${(freqError as Error).message}`
				);
				yield sendUpdate(
					`[FREQ ${i + 1}/${checkFreqs.length}] Skipping to next frequency...`
				);
				yield sendUpdate('[SCAN] ');

				// Add failed frequency result to maintain count
				const failedResult: FrequencyTestResult = {
					frequency: freq,
					power: -100,
					frameCount: 0,
					hasGsmActivity: false,
					strength: 'Error',
					channelType: '',
					controlChannel: false
				};

				results.push(failedResult);

				// Send failed result for real-time UI updates
				yield sendResult({
					type: 'frequency_result',
					frequency: freq,
					result: failedResult,
					progress: {
						current: i + 1,
						total: checkFreqs.length,
						completed: i + 1
					}
				});
			} finally {
				// CRITICAL: Always kill grgsm_livemon process regardless of success/failure
				if (pid && pid !== '0') {
					try {
						await hostExec(`sudo kill ${pid} 2>/dev/null`);
						yield sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] Cleaned up process ${pid}`
						);
					} catch (_error: unknown) {
						try {
							await hostExec(`sudo kill -9 ${pid} 2>/dev/null`);
						} catch (_error: unknown) {
							// Process already exited — that's fine
						}
					}
					// Also clean up any orphaned grgsm processes matching this frequency
					await hostExec(
						`sudo pkill -f "grgsm_livemon_headless.*-f ${freq}M" 2>/dev/null`
					).catch((error: unknown) => {
						console.warn(
							`[gsm-evil] Cleanup: pkill orphaned grgsm process for ${freq}M failed`,
							{ error: String(error) }
						);
					});
				}
				// Clean up temp stderr log
				await hostExec(`rm -f ${stderrLog} 2>/dev/null`).catch((error: unknown) => {
					console.warn('[gsm-evil] Cleanup: rm stderr log failed (non-critical)', {
						error: String(error)
					});
				});
			}

			// Brief pause between frequencies
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		// Sort by frame count
		results.sort((a, b) => b.frameCount - a.frameCount);

		// Find best frequency
		const bestFreq = results.find((r) => r.hasGsmActivity) ||
			results[0] || {
				frequency: '947.2',
				frameCount: 0,
				power: -100,
				strength: 'No Signal',
				hasGsmActivity: false,
				channelType: '',
				controlChannel: false
			};

		yield sendUpdate('[SCAN] ');
		yield sendUpdate('[SCAN] ========== SCAN COMPLETE ==========');
		yield sendUpdate(`[SCAN] Tested ${results.length} frequencies`);
		// Only show active results to avoid flooding the console
		const activeResults = results.filter((r) => r.frameCount > 0);
		yield sendUpdate('[SCAN] ');
		yield sendUpdate(
			`[SCAN] ACTIVE FREQUENCIES (${activeResults.length} of ${results.length} tested):`
		);
		for (let index = 0; index < activeResults.length; index++) {
			const result = activeResults[index];
			const cellInfo = result.mcc
				? ` [MCC=${result.mcc} MNC=${result.mnc} LAC=${result.lac} CI=${result.ci}]`
				: '';
			yield sendUpdate(
				`[SCAN] ${index + 1}. ${result.frequency} MHz: ${result.frameCount} frames (${result.strength}) ${result.channelType || ''}${cellInfo}`
			);
		}
		if (activeResults.length === 0) {
			yield sendUpdate('[SCAN] No active GSM frequencies found');
		}
		yield sendUpdate('[SCAN] ');
		yield sendUpdate(`[SCAN] BEST FREQUENCY: ${bestFreq.frequency} MHz`);
		yield sendUpdate(`[SCAN] GSM frames detected: ${bestFreq.frameCount}`);
		// HackRF doesn't provide real power measurement — show frame-based strength
		const signalDisplay =
			bestFreq.power > -100
				? `${bestFreq.power.toFixed(1)} dBm`
				: `${bestFreq.frameCount} frames`;
		yield sendUpdate(`[SCAN] Signal: ${signalDisplay} (${bestFreq.strength})`);
		if (bestFreq.channelType) {
			yield sendUpdate(
				`[SCAN] Channel type: ${bestFreq.channelType}${bestFreq.controlChannel ? ' (Control Channel)' : ''}`
			);
		}
		yield sendUpdate('[SCAN] ==================================');

		// Send final result
		yield sendResult({
			type: 'scan_complete',
			success: true,
			bestFrequency: bestFreq.frequency,
			bestFrequencyFrames: bestFreq.frameCount,
			scanResults: results,
			totalTested: results.length
		});
	} catch (error: unknown) {
		yield sendUpdate(`[ERROR] Scan failed: ${(error as Error).message}`);
		yield sendResult({
			success: false,
			message: 'Scan failed',
			error: (error as Error).message
		});
	} finally {
		// Release HackRF resource if acquired
		if (hackrfAcquired) {
			try {
				await resourceManager.release('gsm-scan', HardwareDevice.HACKRF);
			} catch (releaseError) {
				console.error('[gsm-scan] Failed to release HackRF:', releaseError);
			}
		}
	}
}
