import { execFile, spawn } from 'child_process';
import { closeSync, openSync } from 'fs';
import { readFile } from 'fs/promises';
import { promisify } from 'util';

import { validateNumericParam } from '$lib/server/security/input-sanitizer';

const execFileAsync = promisify(execFile);

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

				const gsmArgs = [
					'grgsm_livemon_headless',
					'-f',
					`${freq}M`,
					'-g',
					String(gain),
					'--collector',
					'localhost',
					'--collectorport',
					'4729'
				];
				console.warn(`Running command: sudo ${gsmArgs.join(' ')}`);

				// Test if GRGSM can start at all
				let gsmTestOutput = '';
				try {
					const testResult = await execFileAsync('/usr/bin/timeout', [
						'4',
						'/usr/bin/sudo',
						...gsmArgs
					]);
					gsmTestOutput = testResult.stdout + testResult.stderr;
					console.warn(`GRGSM test output: ${gsmTestOutput.substring(0, 300)}`);
				} catch (testError: unknown) {
					const error = testError as { stdout?: string; stderr?: string };
					gsmTestOutput = (error.stdout || '') + (error.stderr || '');
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

				// Background spawn with PID capture
				const logFd = openSync('/tmp/grgsm_scan.log', 'a');
				const child = spawn('/usr/bin/sudo', gsmArgs, {
					detached: true,
					stdio: ['ignore', logFd, logFd]
				});
				child.unref();
				closeSync(logFd);
				const spawnedPid = child.pid;
				if (!spawnedPid) {
					throw new Error(
						'Failed to start grgsm_livemon_headless - check hardware connection'
					);
				}
				pid = String(spawnedPid);
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

					// Get initial log line count
					let startLines = 0;
					try {
						const content = await readFile(logPath, 'utf-8');
						startLines = content.split('\n').length;
					} catch {
						startLines = 0;
					}

					// Wait for data collection period
					await new Promise((resolve) => setTimeout(resolve, captureTime * 1000));

					// Read final log and count new GSM frames
					try {
						const content = await readFile(logPath, 'utf-8');
						const allLines = content.split('\n');
						if (allLines.length > startLines) {
							const newLines = allLines.slice(startLines);
							frameCount = newLines.filter((l) => /^\s*[0-9a-f]{2}\s/.test(l)).length;
						}
					} catch {
						// File may have been removed — frameCount stays 0
					}

					console.warn(
						`Direct log analysis: ${frameCount} GSM frames detected on ${freq} MHz`
					);

					// Fallback to tcpdump only if log analysis fails
					if (frameCount === 0) {
						console.warn('Log analysis found no frames, trying tcpdump fallback...');
						try {
							const { stdout: tcpOut } = await execFileAsync('/usr/bin/sudo', [
								'/usr/bin/timeout',
								'2',
								'/usr/sbin/tcpdump',
								'-i',
								'lo',
								'-nn',
								'port',
								'4729'
							]);
							const tcpdumpFrames = tcpOut
								.split('\n')
								.filter((l) => l.includes('127.0.0.1.4729')).length;
							frameCount = tcpdumpFrames;
						} catch (tcpError: unknown) {
							const error = tcpError as { stdout?: string };
							if (error.stdout) {
								const tcpdumpFrames = error.stdout
									.split('\n')
									.filter((l) => l.includes('127.0.0.1.4729')).length;
								frameCount = tcpdumpFrames;
							}
						}
						console.warn(`Tcpdump fallback: ${frameCount} packets`);
					}
				} catch (logError: unknown) {
					console.warn(
						`Direct log analysis failed: ${(logError as Error).message}, using tcpdump fallback`
					);
					// tcpdump fallback in catch block
					try {
						const { stdout: tcpOut } = await execFileAsync('/usr/bin/sudo', [
							'/usr/bin/timeout',
							String(captureTime),
							'/usr/sbin/tcpdump',
							'-i',
							'lo',
							'-nn',
							'port',
							'4729'
						]);
						frameCount = tcpOut
							.split('\n')
							.filter((l) => l.includes('127.0.0.1.4729')).length;
					} catch (tcpError: unknown) {
						const error = tcpError as { stdout?: string };
						if (error.stdout) {
							frameCount = error.stdout
								.split('\n')
								.filter((l) => l.includes('127.0.0.1.4729')).length;
						} else {
							frameCount = 0;
							console.warn(`Both log analysis and tcpdump failed for ${freq} MHz`);
						}
					}
				}

				// Analyze channel types from actual frame content
				let channelType = '';
				let controlChannel = false;

				if (frameCount > 0) {
					// Read recent frame lines and classify by GSM L3 message type
					try {
						const logContent = await readFile(logPath, 'utf-8');
						const logLines = logContent.split('\n');
						const lines = logLines
							.slice(-50)
							.filter((l) => /^\s*[0-9a-f]{2}\s/.test(l))
							.slice(0, 30);

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
						// Kill background process
						const validKillPid = validateNumericParam(parseInt(pid), 'pid', 1, 4194304);
						await execFileAsync('/usr/bin/sudo', [
							'/usr/bin/kill',
							String(validKillPid)
						]);
					} catch (_error: unknown) {
						console.warn(`Warning: Failed to clean up process ${pid}`);
						// Force kill fallback
						try {
							const validKillPid = validateNumericParam(
								parseInt(pid),
								'pid',
								1,
								4194304
							);
							await execFileAsync('/usr/bin/sudo', [
								'/usr/bin/kill',
								'-9',
								String(validKillPid)
							]);
						} catch (killError: unknown) {
							console.warn('[gsm-evil] Cleanup: kill -9 process failed', {
								error: String(killError)
							});
						}
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
