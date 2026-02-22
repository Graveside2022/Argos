import { execFile, spawn } from 'child_process';
import { closeSync, openSync } from 'fs';
import { readFile } from 'fs/promises';
import { promisify } from 'util';

import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

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

interface ChannelClassification {
	channelType: string;
	controlChannel: boolean;
}

const GSM_LOG_PATH = '/tmp/grgsm_scan.log';
const DEFAULT_GAIN = 40;
const HACKRF_INIT_DELAY_MS = 2000;
const CAPTURE_TIME_SECONDS = 3;
const INTER_FREQ_DELAY_MS = 500;
const TARGET_FREQUENCIES: string[] = ['947.2', '950.0'];

/** Build the grgsm_livemon_headless command arguments. */
function buildGsmArgs(freq: string, gain: number): string[] {
	return [
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
}

/** Run a quick GRGSM test to verify the SDR device is reachable. */
async function testGrgsm(gsmArgs: string[]): Promise<string> {
	let gsmTestOutput = '';
	try {
		const testResult = await execFileAsync('/usr/bin/timeout', [
			'4',
			'/usr/bin/sudo',
			...gsmArgs
		]);
		gsmTestOutput = testResult.stdout + testResult.stderr;
		logger.debug('[gsm-scan] GRGSM test output', {
			output: gsmTestOutput.substring(0, 300)
		});
	} catch (testError: unknown) {
		const error = testError as { stdout?: string; stderr?: string };
		gsmTestOutput = (error.stdout || '') + (error.stderr || '');
	}
	logger.debug('[gsm-scan] GRGSM test output (extended)', {
		output: gsmTestOutput.substring(0, 500)
	});
	return gsmTestOutput;
}

/** Check GRGSM test output for known hardware failure patterns. */
function checkHardwareErrors(output: string): void {
	const hasGsmFrameData = /^\s*[0-9a-f]{2}\s+[0-9a-f]{2}\s/m.test(output);
	if (hasGsmFrameData) {
		return;
	}

	const noDevices = output.includes('No supported devices found');
	const runtimeNoDevices = output.includes('RuntimeError: No supported devices found');
	const sdrplayFail =
		output.includes('[ERROR] sdrplay_api_Open() Error: sdrplay_api_Fail') &&
		!output.includes('Detected Device:');
	const soapyNoDevice =
		output.includes('SoapySDR::Device::enumerate') && !output.includes('Detected Device:');

	if (noDevices || runtimeNoDevices || sdrplayFail || soapyNoDevice) {
		throw new Error(
			'Hardware not available: SDR device connection failed. ' +
				'GRGSM cannot connect to HackRF. Check device connection, drivers, and permissions.'
		);
	}
}

/** Spawn grgsm_livemon_headless in the background and return its PID. */
function spawnGrgsm(gsmArgs: string[]): string {
	const logFd = openSync(GSM_LOG_PATH, 'a');
	const child = spawn('/usr/bin/sudo', gsmArgs, {
		detached: true,
		stdio: ['ignore', logFd, logFd]
	});
	child.unref();
	closeSync(logFd);

	const spawnedPid = child.pid;
	if (!spawnedPid) {
		throw new Error('Failed to start grgsm_livemon_headless - check hardware connection');
	}
	const pid = String(spawnedPid);
	validateNumericParam(pid, 'pid', 1, 4194304);

	if (!pid || pid === '0') {
		throw new Error('Failed to start grgsm_livemon_headless - check hardware connection');
	}
	return pid;
}

/** Read the current line count of the GRGSM log file. */
async function countLogLines(logPath: string): Promise<number> {
	try {
		const content = await readFile(logPath, 'utf-8');
		return content.split('\n').length;
	} catch {
		return 0;
	}
}

/** Count new GSM frames by comparing log lines before and after a capture period. */
async function countFramesFromLog(logPath: string, startLines: number): Promise<number> {
	try {
		const content = await readFile(logPath, 'utf-8');
		const allLines = content.split('\n');
		if (allLines.length > startLines) {
			const newLines = allLines.slice(startLines);
			return newLines.filter((l) => /^\s*[0-9a-f]{2}\s/.test(l)).length;
		}
	} catch {
		// File may have been removed
	}
	return 0;
}

/** Count GSMTAP packets via tcpdump on loopback port 4729. */
async function countFramesFromTcpdump(captureTime: number): Promise<number> {
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
		return tcpOut.split('\n').filter((l) => l.includes('127.0.0.1.4729')).length;
	} catch (tcpError: unknown) {
		const error = tcpError as { stdout?: string };
		if (error.stdout) {
			return error.stdout.split('\n').filter((l) => l.includes('127.0.0.1.4729')).length;
		}
	}
	return 0;
}

/**
 * Capture GSM frame count using log analysis with tcpdump fallback.
 * Waits for the capture period, then analyzes the log file for new frames.
 * Falls back to tcpdump if log analysis yields zero frames.
 */
async function captureFrameCount(logPath: string, captureTime: number): Promise<number> {
	try {
		const startLines = await countLogLines(logPath);
		await new Promise((resolve) => setTimeout(resolve, captureTime * 1000));

		const frameCount = await countFramesFromLog(logPath, startLines);
		logger.debug('[gsm-scan] Direct log analysis', { frameCount });

		if (frameCount === 0) {
			logger.debug('[gsm-scan] Log analysis found no frames, trying tcpdump fallback');
			const tcpdumpFrames = await countFramesFromTcpdump(2);
			logger.debug('[gsm-scan] Tcpdump fallback result', { frameCount: tcpdumpFrames });
			return tcpdumpFrames;
		}
		return frameCount;
	} catch (logError: unknown) {
		logger.warn('[gsm-scan] Direct log analysis failed, using tcpdump fallback', {
			error: (logError as Error).message
		});
		return await countFramesFromTcpdump(captureTime);
	}
}

/** Parse GSM L3 message types from log lines to detect SI and paging messages. */
function parseL3MessageTypes(lines: string[]): { hasSI: boolean; hasPaging: boolean } {
	let hasSI = false;
	let hasPaging = false;

	const siTypes = [0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x02, 0x03, 0x07];
	const pagingTypes = [0x21, 0x22, 0x24, 0x3e, 0x3f];

	for (const line of lines) {
		const bytes = line.trim().split(/\s+/);
		if (bytes.length >= 3 && bytes[1] === '06') {
			const msgType = parseInt(bytes[2], 16);
			if (siTypes.includes(msgType)) {
				hasSI = true;
			}
			if (pagingTypes.includes(msgType)) {
				hasPaging = true;
			}
		}
	}
	return { hasSI, hasPaging };
}

/** Determine channel type from L3 message analysis results and frame count. */
function determineChannelType(
	hasSI: boolean,
	hasPaging: boolean,
	frameCount: number
): ChannelClassification {
	if (hasSI) {
		return { channelType: 'BCCH/CCCH', controlChannel: true };
	}
	if (hasPaging) {
		return { channelType: 'CCCH', controlChannel: true };
	}
	if (frameCount > 100) {
		return { channelType: 'TCH', controlChannel: false };
	}
	return { channelType: 'SDCCH', controlChannel: false };
}

/**
 * Classify the GSM channel type by analyzing recent frame content.
 * Reads log lines, parses L3 message types, and classifies as
 * BCCH/CCCH, CCCH, TCH, or SDCCH.
 */
async function classifyChannelType(
	frameCount: number,
	logPath: string
): Promise<ChannelClassification> {
	if (frameCount === 0) {
		return { channelType: '', controlChannel: false };
	}
	try {
		const logContent = await readFile(logPath, 'utf-8');
		const logLines = logContent.split('\n');
		const lines = logLines
			.slice(-50)
			.filter((l) => /^\s*[0-9a-f]{2}\s/.test(l))
			.slice(0, 30);

		const { hasSI, hasPaging } = parseL3MessageTypes(lines);
		return determineChannelType(hasSI, hasPaging, frameCount);
	} catch {
		return {
			channelType: frameCount > 10 ? 'BCCH/CCCH' : 'SDCCH',
			controlChannel: frameCount > 10
		};
	}
}

/** Map a GSM frame count to a human-readable signal strength label. */
function classifySignalStrength(frameCount: number): string {
	if (frameCount <= 0) return 'No Signal';
	if (frameCount > 200) return 'Excellent';
	if (frameCount > 150) return 'Very Strong';
	if (frameCount > 100) return 'Strong';
	if (frameCount > 50) return 'Good';
	if (frameCount > 10) return 'Moderate';
	return 'Weak';
}

/** Kill a background GRGSM process by PID, with force-kill fallback. */
async function cleanupProcess(pid: string): Promise<void> {
	if (!pid || pid === '0') return;
	try {
		const validPid = validateNumericParam(parseInt(pid), 'pid', 1, 4194304);
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/kill', String(validPid)]);
	} catch {
		logger.warn('[gsm-scan] Failed to clean up process', { pid });
		try {
			const validPid = validateNumericParam(parseInt(pid), 'pid', 1, 4194304);
			await execFileAsync('/usr/bin/sudo', ['/usr/bin/kill', '-9', String(validPid)]);
		} catch (killError: unknown) {
			logger.warn('[gsm-scan] Cleanup: kill -9 process failed', {
				error: String(killError)
			});
		}
	}
}

/** Analyze captured frames and build a scan result for a frequency. */
async function analyzeFrequency(freq: string, frameCount: number): Promise<GsmScanResult | null> {
	const { channelType, controlChannel } = await classifyChannelType(frameCount, GSM_LOG_PATH);
	const strength = classifySignalStrength(frameCount);

	logger.debug('[gsm-scan] Final values', { freq, strength, frameCount });

	if (frameCount > 0) {
		return {
			frequency: freq,
			power: -100,
			frameCount,
			hasGsmActivity: frameCount > 10,
			strength,
			channelType,
			controlChannel
		};
	}
	return null;
}

/**
 * Scan a single GSM frequency for activity.
 * Spawns grgsm_livemon_headless, captures frames, classifies channel
 * type and signal strength, then cleans up the background process.
 */
async function scanSingleFrequency(freq: string): Promise<GsmScanResult | null> {
	logger.debug('[gsm-scan] Testing frequency', { freq });
	let pid = '';

	try {
		const gsmArgs = buildGsmArgs(freq, DEFAULT_GAIN);
		logger.debug('[gsm-scan] Running command', {
			command: `sudo ${gsmArgs.join(' ')}`
		});

		const testOutput = await testGrgsm(gsmArgs);
		checkHardwareErrors(testOutput);

		pid = spawnGrgsm(gsmArgs);
		await new Promise((resolve) => setTimeout(resolve, HACKRF_INIT_DELAY_MS));

		logger.debug('[gsm-scan] Device init', {
			device: 'HackRF',
			initDelay: HACKRF_INIT_DELAY_MS,
			captureTime: CAPTURE_TIME_SECONDS
		});

		const frameCount = await captureFrameCount(GSM_LOG_PATH, CAPTURE_TIME_SECONDS);
		return await analyzeFrequency(freq, frameCount);
	} catch (freqError) {
		logger.warn('[gsm-scan] Error testing frequency', {
			freq,
			error: (freqError as Error).message
		});
		if ((freqError as Error).message.includes('Hardware not available')) {
			throw freqError;
		}
		return null;
	} finally {
		await cleanupProcess(pid);
	}
}

/** Build the final scan response from collected results. */
function buildScanResponse(results: GsmScanResult[]): GsmScanResponse {
	results.sort((a, b) => (b.frameCount || 0) - (a.frameCount || 0));

	const bestFreq = results.find((r) => r.hasGsmActivity) || results[0];
	const summaryLines = results
		.slice(0, 10)
		.map(
			(r) =>
				`${r.frequency} MHz: ${r.frameCount} frames (${r.strength})` +
				`${r.controlChannel ? ' - Control Channel' : ''}`
		);

	const detail =
		results.length > 0
			? `Top frequencies:\n${summaryLines.join('\n')}`
			: 'No GSM activity detected on any frequency.';

	return {
		success: true,
		strongestFrequency: bestFreq ? bestFreq.frequency : '947.2',
		bestFrequencyFrames: bestFreq ? bestFreq.frameCount : 0,
		message: `Scan complete! Found ${results.length} active frequencies.\n\n${detail}`,
		scanResults: results,
		totalFound: results.length
	};
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
		logger.info('[gsm-scan] Starting GSM frequency scan');
		if (requestedFreq) {
			logger.info('[gsm-scan] Requested frequency', { requestedFreq });
		}

		logger.info('[gsm-scan] Testing frequencies for GSM activity', {
			count: TARGET_FREQUENCIES.length
		});

		const results: GsmScanResult[] = [];

		for (const freq of TARGET_FREQUENCIES) {
			const result = await scanSingleFrequency(freq);
			if (result) {
				results.push(result);
			}
			await new Promise((resolve) => setTimeout(resolve, INTER_FREQ_DELAY_MS));
		}

		return buildScanResponse(results);
	} catch (error: unknown) {
		logger.error('[gsm-scan] Scan error', { error: (error as Error).message });
		return {
			success: false,
			message: 'Scan failed. Make sure GSM Evil is stopped first.',
			error: (error as Error).message
		};
	}
}
