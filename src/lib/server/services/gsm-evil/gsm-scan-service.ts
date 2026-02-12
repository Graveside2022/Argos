import { hostExec } from '$lib/server/host-exec';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';

export interface GsmScanResult {
	frequency: string;
	power: number;
	strength: string;
	frameCount?: number;
	hasGsmActivity?: boolean;
	channelType?: string;
	controlChannel?: boolean;
}

export interface GsmScanResponse {
	success: boolean;
	strongestFrequency?: string;
	bestFrequencyFrames?: number;
	message: string;
	scanResults?: GsmScanResult[];
	totalFound?: number;
	error?: string;
}

/**
 * Perform GSM frequency scan to detect active towers
 * Tests multiple frequencies, counts GSM frames, analyzes channel types
 *
 * @param requestedFreq Optional specific frequency to test (unused in current implementation)
 * @returns Scan results with frequencies ranked by signal strength
 */
export async function performGsmScan(requestedFreq?: number | null): Promise<GsmScanResponse> {
	try {
		console.warn('Starting GSM frequency scan...');

		if (requestedFreq) {
			console.warn(`Requested frequency: ${requestedFreq} MHz`);
		}

		// Target GSM frequencies
		const checkFreqs: string[] = ['947.2', '950.0'];

		console.warn(`Testing ${checkFreqs.length} frequencies for GSM activity...`);

		const results: GsmScanResult[] = [];

		// Test each frequency for actual GSM frames
		for (const freq of checkFreqs) {
			console.warn(`Testing ${freq} MHz...`);
			let pid = '';

			try {
				const gain = 40;

				// HackRF via grgsm_livemon_headless — no device args needed
				const baseCommand = `sudo grgsm_livemon_headless -f ${freq}M -g ${gain} --collector localhost --collectorport 4729`;
				console.warn(`Running command: ${baseCommand}`);

				// Test if GRGSM can start at all
				let gsmTestOutput = '';
				try {
					const testResult = await hostExec(`timeout 4 ${baseCommand}`);
					gsmTestOutput = testResult.stdout + testResult.stderr;
					console.warn(`GRGSM test output: ${gsmTestOutput.substring(0, 300)}`);
				} catch (testError: any) {
					// eslint-disable-line @typescript-eslint/no-explicit-any
					gsmTestOutput = (testError.stdout || '') + (testError.stderr || '');
				}

				console.warn(`GRGSM test output: ${gsmTestOutput.substring(0, 500)}...`);

				// Check for known hardware failure patterns
				// If GSM frame data is present (hex lines), hardware is working regardless of other log messages
				const hasGsmFrameData = /^\s*[0-9a-f]{2}\s+[0-9a-f]{2}\s/m.test(gsmTestOutput);
				if (
					!hasGsmFrameData &&
					(gsmTestOutput.includes('No supported devices found') ||
						gsmTestOutput.includes('RuntimeError: No supported devices found') ||
						(gsmTestOutput.includes(
							'[ERROR] sdrplay_api_Open() Error: sdrplay_api_Fail'
						) &&
							!gsmTestOutput.includes('Detected Device:')) ||
						(gsmTestOutput.includes('SoapySDR::Device::enumerate') &&
							!gsmTestOutput.includes('Detected Device:')))
				) {
					throw new Error(
						'Hardware not available: SDR device connection failed. GRGSM cannot connect to HackRF. Check device connection, drivers, and permissions.'
					);
				}

				const { stdout: gsmPid } = await hostExec(
					`${baseCommand} >>/tmp/grgsm_scan.log 2>&1 & echo $!`
				);

				pid = gsmPid.trim();
				validateNumericParam(pid, 'pid', 1, 4194304);

				// Validate process started
				if (!pid || pid === '0') {
					throw new Error(
						'Failed to start grgsm_livemon_headless - check hardware connection'
					);
				}

				// Wait for HackRF initialization
				const initDelay = 2000;
				await new Promise((resolve) => setTimeout(resolve, initDelay));

				// Count GSMTAP packets
				const captureTime = 3;
				let frameCount = 0;

				console.warn(
					`Device: HackRF, Waiting ${initDelay}ms for init, capturing for ${captureTime}s`
				);

				const logPath = '/tmp/grgsm_scan.log';
				try {
					// DIRECT LOG ANALYSIS: Check grgsm.log for actual GSM frames instead of unreliable tcpdump

					// Get initial log size
					const { stdout: initialSize } = await hostExec(
						`wc -l < ${logPath} 2>/dev/null || echo 0`
					);
					const startLines = parseInt(initialSize.trim()) || 0;

					// Wait for data collection period
					await new Promise((resolve) => setTimeout(resolve, captureTime * 1000));

					// Get final log size and count new GSM frame lines
					const { stdout: finalSize } = await hostExec(
						`wc -l < ${logPath} 2>/dev/null || echo 0`
					);
					const endLines = parseInt(finalSize.trim()) || 0;

					// Count actual GSM data frames (hex patterns) added during collection
					if (endLines > startLines) {
						const { stdout: frameLines } = await hostExec(
							`tail -n ${endLines - startLines} ${logPath} | grep -E "^\\s*[0-9a-f]{2}\\s" | wc -l`
						);
						frameCount = parseInt(frameLines.trim()) || 0;
					}

					console.warn(
						`Direct log analysis: ${frameCount} GSM frames detected on ${freq} MHz`
					);

					// Fallback to tcpdump only if log analysis fails
					if (frameCount === 0) {
						console.warn('Log analysis found no frames, trying tcpdump fallback...');
						const tcpdumpCommand = `sudo timeout 2 tcpdump -i lo -nn port 4729 2>/dev/null | grep -c "127.0.0.1.4729" || echo 0`;
						const { stdout: packetCount } = await hostExec(tcpdumpCommand).catch(
							(error: unknown) => {
								console.warn('[gsm-evil-scan] tcpdump fallback failed', {
									error: String(error)
								});
								return { stdout: '0' };
							}
						);
						const tcpdumpFrames = parseInt(packetCount.trim()) || 0;
						console.warn(`Tcpdump fallback: ${tcpdumpFrames} packets`);
						frameCount = tcpdumpFrames;
					}
				} catch (logError: unknown) {
					console.warn(
						`Direct log analysis failed: ${(logError as Error).message}, using tcpdump fallback`
					);
					try {
						const tcpdumpCommand = `sudo timeout ${captureTime} tcpdump -i lo -nn port 4729 2>/dev/null | grep -c "127.0.0.1.4729"`;
						const { stdout: packetCount } = await hostExec(tcpdumpCommand);
						frameCount = parseInt(packetCount.trim()) || 0;
					} catch (_error: unknown) {
						frameCount = 0;
						console.warn(`Both log analysis and tcpdump failed for ${freq} MHz`);
					}
				}

				// Analyze channel types from actual frame content
				let channelType = '';
				let controlChannel = false;

				if (frameCount > 0) {
					// Read recent frame lines and classify by GSM L3 message type (byte[2] with byte[1]=0x06)
					try {
						const { stdout: recentLines } = await hostExec(
							`tail -50 ${logPath} | grep -E "^\\s*[0-9a-f]{2}\\s" | head -30`
						);
						const lines = recentLines.split('\n').filter((l: string) => l.trim());
						let hasSI = false;
						let hasPaging = false;

						for (const line of lines) {
							const bytes = line.trim().split(/\s+/);
							if (bytes.length >= 3 && bytes[1] === '06') {
								const msgType = parseInt(bytes[2], 16);
								// System Information messages (SI1-SI4, SI2bis/ter/quater)
								if (
									[0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x02, 0x03, 0x07].includes(
										msgType
									)
								) {
									hasSI = true;
								}
								// Paging and Immediate Assignment (CCCH)
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
					} catch (_error: unknown) {
						// Fallback to frame count heuristic if log parsing fails
						channelType = frameCount > 10 ? 'BCCH/CCCH' : 'SDCCH';
						controlChannel = frameCount > 10;
					}
				}

				// HackRF doesn't provide direct power measurement — use frame-based strength
				let strength = 'No Signal';
				const power = -100;

				if (frameCount > 0) {
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
					} else {
						strength = 'Weak';
					}
				}

				console.warn(
					`Final values for ${freq} MHz: strength=${strength}, frames=${frameCount}`
				);

				if (frameCount > 0) {
					results.push({
						frequency: freq,
						power: power,
						frameCount: frameCount,
						hasGsmActivity: frameCount > 10,
						strength: strength,
						channelType: channelType,
						controlChannel: controlChannel
					});
				}
			} catch (freqError) {
				console.warn(`Error testing ${freq} MHz: ${(freqError as Error).message}`);

				if ((freqError as Error).message.includes('Hardware not available')) {
					throw freqError;
				}
			} finally {
				if (pid && pid !== '0') {
					try {
						await hostExec(`sudo kill ${pid} 2>/dev/null`);
					} catch (_error: unknown) {
						console.warn(`Warning: Failed to clean up process ${pid}`);
						await hostExec(`sudo kill -9 ${pid} 2>/dev/null`).catch(
							(error: unknown) => {
								console.warn('[gsm-evil] Cleanup: kill -9 process failed', {
									error: String(error)
								});
							}
						);
					}
				}
			}

			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		results.sort((a, b) => (b.frameCount || 0) - (a.frameCount || 0));

		const bestFreq = results.find((r) => r.hasGsmActivity) || results[0];

		const summaryLines = results
			.slice(0, 10)
			.map(
				(r) =>
					`${r.frequency} MHz: ${r.frameCount} frames (${r.strength})${r.controlChannel ? ' - Control Channel' : ''}`
			);

		return {
			success: true,
			strongestFrequency: bestFreq ? bestFreq.frequency : '947.2',
			bestFrequencyFrames: bestFreq ? bestFreq.frameCount : 0,
			message: `Scan complete! Found ${results.length} active frequencies.\n\n${results.length > 0 ? `Top frequencies:\n${summaryLines.join('\n')}` : 'No GSM activity detected on any frequency.'}`,
			scanResults: results,
			totalFound: results.length
		};
	} catch (error: unknown) {
		console.error('Scan error:', error);
		return {
			success: false,
			message: 'Scan failed. Make sure GSM Evil is stopped first.',
			error: (error as Error).message
		};
	}
}
