import type { RequestHandler } from './$types';
import { resourceManager } from '$lib/server/hardware/resourceManager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { hostExec, isDockerContainer } from '$lib/server/hostExec';

interface FrequencyTestResult {
	frequency: string;
	power: number;
	frameCount: number;
	hasGsmActivity: boolean;
	strength: string;
	channelType?: string;
	controlChannel?: boolean;
	mcc?: string;
	mnc?: string;
	lac?: string;
	ci?: string;
}

export const POST: RequestHandler = async ({ request: _request }) => {
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const sendUpdate = (message: string) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message })}\n\n`));
			};

			const sendResult = (data: any) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ result: data })}\n\n`));
			};

			const sendError = (error: string) => {
				sendUpdate(`[ERROR] ${error}`);
				sendResult({
					type: 'scan_complete',
					success: false,
					message: error,
					scanResults: [],
					totalTested: 0
				});
			};

			let hackrfAcquired = false;

			try {
				// ============================================
				// PHASE 0: Prerequisite Checks
				// ============================================
				sendUpdate('[SCAN] Running prerequisite checks...');

				// Detect if running in Docker — RF tools live on the host
				const inDocker = await isDockerContainer();
				if (inDocker) {
					sendUpdate('[SCAN] Running in Docker — using nsenter to access host RF tools');
				}

				// Check grgsm_livemon_headless is installed
				try {
					await hostExec('which grgsm_livemon_headless');
					sendUpdate('[SCAN] grgsm_livemon_headless found');
				} catch {
					sendError(
						'grgsm_livemon_headless is not installed. Install the gr-gsm package to enable GSM scanning.'
					);
					return;
				}

				// Check tcpdump is available
				try {
					await hostExec('which tcpdump');
					sendUpdate('[SCAN] tcpdump found');
				} catch {
					sendUpdate('[SCAN] WARNING: tcpdump not found — packet counting may fail');
				}

				// Check HackRF is accessible
				try {
					const { stdout } = await hostExec('hackrf_info 2>&1');
					if (
						stdout.includes('No HackRF boards found') ||
						stdout.includes('hackrf_open')
					) {
						sendUpdate(
							'[SCAN] WARNING: hackrf_info reports no HackRF device — scan may fail'
						);
					} else {
						sendUpdate('[SCAN] HackRF detected');
					}
				} catch {
					sendUpdate(
						'[SCAN] WARNING: hackrf_info check failed — scan will attempt anyway'
					);
				}

				// ============================================
				// PHASE 1: Acquire HackRF Resource
				// ============================================
				sendUpdate('[SCAN] Acquiring SDR hardware...');
				let acquireResult = await resourceManager.acquire(
					'gsm-scan',
					HardwareDevice.HACKRF
				);
				if (!acquireResult.success) {
					// Check if the owning process is actually running — if not, force-release stale lock
					const owner = acquireResult.owner || 'unknown';
					sendUpdate(`[SCAN] HackRF held by "${owner}" — checking if still active...`);
					try {
						// Check for both grgsm_livemon_headless AND GsmEvil.py processes
						const { stdout: gsmProc } = await hostExec(
							'pgrep -f "grgsm_livemon_headless|GsmEvil" 2>/dev/null || true'
						);
						if (!gsmProc.trim()) {
							sendUpdate(
								`[SCAN] No active GSM/GsmEvil process found — releasing stale "${owner}" lock`
							);
							await resourceManager.forceRelease(HardwareDevice.HACKRF);
							acquireResult = await resourceManager.acquire(
								'gsm-scan',
								HardwareDevice.HACKRF
							);
						} else {
							// Processes are running — try to kill them before scanning
							sendUpdate(
								`[SCAN] Found running GSM processes — killing them to free HackRF...`
							);
							await hostExec(
								'sudo pkill -f grgsm_livemon_headless 2>/dev/null || true'
							);
							await hostExec('sudo pkill -f "GsmEvil" 2>/dev/null || true');
							await new Promise((resolve) => setTimeout(resolve, 1000));
							await resourceManager.forceRelease(HardwareDevice.HACKRF);
							acquireResult = await resourceManager.acquire(
								'gsm-scan',
								HardwareDevice.HACKRF
							);
						}
					} catch {
						// pgrep check failed — force release anyway
						sendUpdate('[SCAN] Process check failed — forcing resource release');
						await resourceManager.forceRelease(HardwareDevice.HACKRF);
						acquireResult = await resourceManager.acquire(
							'gsm-scan',
							HardwareDevice.HACKRF
						);
					}

					if (!acquireResult.success) {
						sendError(
							`HackRF is currently in use by "${acquireResult.owner}". Stop it first before scanning.`
						);
						return;
					}
				}
				hackrfAcquired = true;
				sendUpdate('[SCAN] SDR hardware acquired');

				// ============================================
				// PHASE 2: Scan GSM-900 downlink frequencies
				// ============================================
				// GSM-900 downlink: 935–960 MHz. Full band sweep to find BCCH channels.
				// BCCH channels carry System Information with MCC/MNC/LAC/CI.
				// Scanning every ~0.4-1.0 MHz across the band for comprehensive coverage.
				const checkFreqs: string[] = ['947.2', '950.0'];
				sendUpdate(`[SCAN] Scanning ${checkFreqs.length} target frequencies`);

				sendUpdate('[SCAN] ');
				sendUpdate('[SCAN] Phase 2: GSM Frame Detection & BCCH Channel Discovery');
				sendUpdate(
					`[SCAN] Testing ${checkFreqs.length} frequencies for 15 seconds each...`
				);
				const estimatedTime = checkFreqs.length * 20; // ~20 seconds per freq (init + 15s capture + cleanup)
				const estimatedMinutes = Math.ceil(estimatedTime / 60);
				sendUpdate(
					`[SCAN] Estimated time: ~${estimatedMinutes} minutes (${estimatedTime} seconds)`
				);
				sendUpdate(
					'[SCAN] This comprehensive scan will identify BCCH channels with complete cell tower data'
				);
				sendUpdate('[SCAN] ');

				// Test each frequency
				const results: FrequencyTestResult[] = [];

				for (let i = 0; i < checkFreqs.length; i++) {
					const freq = checkFreqs[i];
					let pid = '';
					const stderrLog = `/tmp/grgsm_scan_${Date.now()}_${i}.log`;

					try {
						const gain = 40;

						sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Testing ${freq} MHz...`);
						sendUpdate(`[DEVICE] Using HackRF`);

						let strength = 'No Signal';
						let power = -100;

						// Build grgsm command for HackRF
						const grgsm_base = `sudo grgsm_livemon_headless -f ${freq}M -g ${gain}`;

						sendUpdate(`[CMD] $ ${grgsm_base}`);

						// Start grgsm — capture stdout (hex frames) and stderr to temp file for diagnostics
						// Background the process and echo its PID
						const { stdout: gsmPid } = await hostExec(
							`${grgsm_base} >${stderrLog} 2>&1 & echo $!`
						);

						pid = String(gsmPid).trim();

						// Validate process started
						if (!pid || pid === '0') {
							throw new Error('Failed to start grgsm_livemon_headless');
						}

						sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] Process started (PID ${pid}), waiting for demodulator initialization...`
						);

						// Wait for HackRF initialization
						const initDelay = 2500;
						await new Promise((resolve) => setTimeout(resolve, initDelay));

						// Verify process is still running after init delay
						try {
							await hostExec(`sudo kill -0 ${pid} 2>/dev/null`);
						} catch {
							// Process died during init — read stderr for diagnostics
							let stderrContent = '';
							try {
								const { stdout: errLog } = await hostExec(
									`cat ${stderrLog} 2>/dev/null | tail -10`
								);
								stderrContent = String(errLog).trim();
							} catch {
								/* ignore */
							}

							const errorDetail = stderrContent
								? `grgsm_livemon_headless exited during init. Error: ${stderrContent}`
								: 'grgsm_livemon_headless exited during init with no error output. Check if HackRF is accessible.';
							sendUpdate(`[ERROR] ${errorDetail}`);
							throw new Error(errorDetail);
						}

						const captureTime = 15;
						sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] Capturing GSMTAP packets for ${captureTime}s (extended for System Information)...`
						);

						// Run tcpdump (frame count) and tshark (cell identity) IN PARALLEL
						// tshark must run concurrently to capture SI3 messages as they arrive.
						let frameCount = 0;
						let cellMcc = '';
						let cellMnc = '';
						let cellLac = '';
						let cellCi = '';

						const tcpdumpPromise = hostExec(
							`sudo timeout ${captureTime} tcpdump -i lo -nn port 4729 2>/dev/null | grep -c "127.0.0.1.4729" || true`
						).catch(() => ({ stdout: '0', stderr: '' }));

						// Capture cell identity from SI3/SI4 messages via tshark
						// Fields: e212.lai.mcc/mnc (from LAI in SI3/SI4), gsm_a.lac, gsm_a.bssmap.cell_ci (from SI3)
						const tsharkPromise = hostExec(
							`sudo timeout ${captureTime} tshark -i lo -f 'udp port 4729' -T fields -e e212.lai.mcc -e e212.lai.mnc -e gsm_a.lac -e gsm_a.bssmap.cell_ci -E separator=, -c 300 2>/dev/null | grep -v '^,*$' | grep -E '[0-9]' | head -30`,
							{ timeout: captureTime * 1000 + 3000 }
						).catch(() => ({ stdout: '', stderr: '' }));

						const [tcpdumpResult, tsharkResult] = await Promise.all([
							tcpdumpPromise,
							tsharkPromise
						]);

						frameCount = parseInt(String(tcpdumpResult.stdout).trim()) || 0;

						// Parse tshark cell identity output (4 fields: MCC, MNC, LAC, CI)
						// LAC and CI are returned as hex (0x1065, 0x9dca) — convert to decimal
						if (tsharkResult.stdout) {
							const cellLines = String(tsharkResult.stdout)
								.trim()
								.split('\n')
								.filter((l: string) => l.trim() && !/^,*$/.test(l));
							sendUpdate(
								`[FREQ ${i + 1}/${checkFreqs.length}] Found ${cellLines.length} packets with cell/identity data`
							);

							// Accumulate data from SI3/SI4 packets
							for (const line of cellLines) {
								const parts = line.split(',');
								if (parts[0] && parts[0].trim()) cellMcc = parts[0].trim();
								if (parts[1] && parts[1].trim()) cellMnc = parts[1].trim();
								if (parts[2] && parts[2].trim()) {
									const raw = parts[2].trim();
									cellLac = raw.startsWith('0x')
										? String(parseInt(raw, 16))
										: raw;
								}
								if (parts[3] && parts[3].trim()) {
									const raw = parts[3].trim();
									cellCi = raw.startsWith('0x') ? String(parseInt(raw, 16)) : raw;
								}
							}

							// Check what we captured
							if (cellMcc && cellLac && cellCi) {
								sendUpdate(
									`[FREQ ${i + 1}/${checkFreqs.length}] ✓ Complete cell identity captured!`
								);
							} else if (cellLac && cellCi) {
								sendUpdate(
									`[FREQ ${i + 1}/${checkFreqs.length}] ⚠ Partial: LAC/CI captured but no MCC/MNC (need IMSI packet)`
								);
							} else if (cellMcc) {
								sendUpdate(
									`[FREQ ${i + 1}/${checkFreqs.length}] ⚠ Partial: MCC/MNC captured but no LAC/CI (need Cell Identity packet)`
								);
							} else {
								sendUpdate(
									`[FREQ ${i + 1}/${checkFreqs.length}] ⚠ Cell identity incomplete (MCC=${cellMcc || 'missing'}, LAC=${cellLac || 'missing'}, CI=${cellCi || 'missing'})`
								);
							}
						} else {
							sendUpdate(
								`[FREQ ${i + 1}/${checkFreqs.length}] ⚠ No cell identity data captured`
							);
						}

						// Analyze channel types from actual frame content and tshark cell identity
						let channelType = '';
						let controlChannel = false;

						if (frameCount > 0) {
							// If tshark decoded MCC/LAC/CI, those come from SI3/SI4 → guaranteed BCCH
							if (cellMcc && cellLac && cellCi) {
								channelType = 'BCCH/CCCH';
								controlChannel = true;
							} else {
								// Parse hex frame data from the log file
								try {
									const { stdout: recentLines } = await hostExec(
										`grep -E "^\\s*[0-9a-f]{2}\\s" ${stderrLog} 2>/dev/null | tail -30`
									);
									const lines = String(recentLines)
										.split('\n')
										.filter((l: string) => l.trim());
									let hasSI = false;
									let hasPaging = false;

									for (const line of lines) {
										const bytes = line.trim().split(/\s+/);
										if (bytes.length >= 3 && bytes[1] === '06') {
											const msgType = parseInt(bytes[2], 16);
											if (
												[
													0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x02, 0x03,
													0x07
												].includes(msgType)
											) {
												hasSI = true;
											}
											if ([0x21, 0x22, 0x24, 0x3e, 0x3f].includes(msgType)) {
												hasPaging = true;
											}
										}
									}

									if (hasSI) {
										channelType = 'BCCH/CCCH';
										controlChannel = true;
									} else if (hasPaging) {
										channelType = 'CCCH';
										controlChannel = true;
									} else if (frameCount > 100) {
										channelType = 'TCH';
										controlChannel = false;
									} else {
										channelType = 'SDCCH';
										controlChannel = false;
									}
								} catch {
									channelType = frameCount > 10 ? 'BCCH/CCCH' : 'SDCCH';
									controlChannel = frameCount > 10;
								}
							}
						}

						if (cellMcc && cellLac && cellCi) {
							sendUpdate(
								`[FREQ ${i + 1}/${checkFreqs.length}] 📡 Cell Tower Identified: MCC=${cellMcc} MNC=${cellMnc || 'N/A'} LAC=${cellLac} CI=${cellCi}`
							);
						} else if (frameCount > 0) {
							sendUpdate(
								`[FREQ ${i + 1}/${checkFreqs.length}] ⚠ ${channelType || 'Unknown'} channel detected but no cell identity captured`
							);
							sendUpdate(
								`[FREQ ${i + 1}/${checkFreqs.length}] 💡 TIP: Cell identity (MCC/LAC/CI) requires BCCH channel with System Information messages`
							);
						}

						// Determine signal strength based on actual power
						if (power > -40) {
							strength = 'Excellent';
						} else if (power > -50) {
							strength = 'Very Strong';
						} else if (power > -60) {
							strength = 'Strong';
						} else if (power > -70) {
							strength = 'Good';
						} else if (power > -80) {
							strength = 'Moderate';
						} else if (power > -90) {
							strength = 'Weak';
						}

						// If no power measurement available, fall back to frame count
						if (power === -100 && frameCount > 0) {
							if (frameCount > 200) {
								strength = 'Excellent';
							} else if (frameCount > 150) {
								strength = 'Very Strong';
							} else if (frameCount > 100) {
								strength = 'Strong';
							} else if (frameCount > 50) {
								strength = 'Good';
							} else if (frameCount > 10) {
								strength = 'Moderate';
							} else if (frameCount > 0) {
								strength = 'Weak';
							}
						}

						const hasActivity = frameCount > 10;

						sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] Result: ${frameCount} GSM frames detected ${hasActivity ? '(active)' : '(no activity)'}`
						);
						sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] Signal: ${frameCount} frames (${strength})`
						);
						if (channelType) {
							sendUpdate(
								`[FREQ ${i + 1}/${checkFreqs.length}] Channel: ${channelType}${controlChannel ? ' (Control Channel - Good for IMSI)' : ''}`
							);
						}
						sendUpdate('[SCAN] ');

						const frequencyResult = {
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
						sendResult({
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
						sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] Error testing ${freq} MHz: ${(freqError as Error).message}`
						);
						sendUpdate(
							`[FREQ ${i + 1}/${checkFreqs.length}] Skipping to next frequency...`
						);
						sendUpdate('[SCAN] ');

						// Add failed frequency result to maintain count
						const failedResult = {
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
						sendResult({
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
								sendUpdate(
									`[FREQ ${i + 1}/${checkFreqs.length}] Cleaned up process ${pid}`
								);
							} catch {
								try {
									await hostExec(`sudo kill -9 ${pid} 2>/dev/null`);
								} catch {
									// Process already exited — that's fine
								}
							}
							// Also clean up any orphaned grgsm processes matching this frequency
							await hostExec(
								`sudo pkill -f "grgsm_livemon_headless.*-f ${freq}M" 2>/dev/null`
							).catch(() => {});
						}
						// Clean up temp stderr log
						await hostExec(`rm -f ${stderrLog} 2>/dev/null`).catch(() => {});
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

				sendUpdate('[SCAN] ');
				sendUpdate('[SCAN] ========== SCAN COMPLETE ==========');
				sendUpdate(`[SCAN] Tested ${results.length} frequencies`);
				// Only show active results to avoid flooding the console
				const activeResults = results.filter((r) => r.frameCount > 0);
				sendUpdate('[SCAN] ');
				sendUpdate(
					`[SCAN] ACTIVE FREQUENCIES (${activeResults.length} of ${results.length} tested):`
				);
				activeResults.forEach((result, index) => {
					const cellInfo = result.mcc
						? ` [MCC=${result.mcc} MNC=${result.mnc} LAC=${result.lac} CI=${result.ci}]`
						: '';
					sendUpdate(
						`[SCAN] ${index + 1}. ${result.frequency} MHz: ${result.frameCount} frames (${result.strength}) ${result.channelType || ''}${cellInfo}`
					);
				});
				if (activeResults.length === 0) {
					sendUpdate('[SCAN] No active GSM frequencies found');
				}
				sendUpdate('[SCAN] ');
				sendUpdate(`[SCAN] BEST FREQUENCY: ${bestFreq.frequency} MHz`);
				sendUpdate(`[SCAN] GSM frames detected: ${bestFreq.frameCount}`);
				// HackRF doesn't provide real power measurement — show frame-based strength
				const signalDisplay =
					bestFreq.power > -100
						? `${bestFreq.power.toFixed(1)} dBm`
						: `${bestFreq.frameCount} frames`;
				sendUpdate(`[SCAN] Signal: ${signalDisplay} (${bestFreq.strength})`);
				if (bestFreq.channelType) {
					sendUpdate(
						`[SCAN] Channel type: ${bestFreq.channelType}${bestFreq.controlChannel ? ' (Control Channel)' : ''}`
					);
				}
				sendUpdate('[SCAN] ==================================');

				// Send final result
				sendResult({
					type: 'scan_complete',
					success: true,
					bestFrequency: bestFreq.frequency,
					bestFrequencyFrames: bestFreq.frameCount,
					scanResults: results,
					totalTested: results.length
				});
			} catch (error: unknown) {
				sendUpdate(`[ERROR] Scan failed: ${(error as Error).message}`);
				sendResult({
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
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
