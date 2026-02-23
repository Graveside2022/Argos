/**
 * GSM scan helper utilities for frame capture, channel classification, and process management.
 * Extracted from gsm-scan-service.ts for constitutional compliance (Article 2.2).
 */

import { execFile, spawn } from 'child_process';
import { closeSync, openSync } from 'fs';
import { readFile } from 'fs/promises';
import { promisify } from 'util';

import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

const execFileAsync = promisify(execFile);

export interface ChannelClassification {
	channelType: string;
	controlChannel: boolean;
}

/** Build the grgsm_livemon_headless command arguments. */
export function buildGsmArgs(freq: string, gain: number): string[] {
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
export async function testGrgsm(gsmArgs: string[]): Promise<string> {
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

/** Hardware error patterns — if any matches, the device is unreachable */
const HARDWARE_FAILURE_PATTERNS = [
	(o: string) => o.includes('No supported devices found'),
	(o: string) => o.includes('RuntimeError: No supported devices found'),
	(o: string) =>
		o.includes('[ERROR] sdrplay_api_Open() Error: sdrplay_api_Fail') &&
		!o.includes('Detected Device:'),
	(o: string) => o.includes('SoapySDR::Device::enumerate') && !o.includes('Detected Device:')
];

/** Check if output contains actual GSM frame hex data */
function hasGsmFrameData(output: string): boolean {
	return /^\s*[0-9a-f]{2}\s+[0-9a-f]{2}\s/m.test(output);
}

/** Check GRGSM test output for known hardware failure patterns. */
export function checkHardwareErrors(output: string): void {
	if (hasGsmFrameData(output)) return;
	const hasFailure = HARDWARE_FAILURE_PATTERNS.some((check) => check(output));
	if (hasFailure) {
		throw new Error(
			'Hardware not available: SDR device connection failed. ' +
				'GRGSM cannot connect to HackRF. Check device connection, drivers, and permissions.'
		);
	}
}

/** Spawn grgsm_livemon_headless in the background and return its PID. */
export function spawnGrgsm(gsmArgs: string[]): string {
	const logFd = openSync('/tmp/grgsm_scan.log', 'a');
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

/** Read the current line count of a log file. */
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
 */
export async function captureFrameCount(logPath: string, captureTime: number): Promise<number> {
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

const SI_TYPES = new Set([0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x02, 0x03, 0x07]);
const PAGING_TYPES = new Set([0x21, 0x22, 0x24, 0x3e, 0x3f]);

/** Extract L3 RR message type from a hex line, or null */
function extractL3MsgType(line: string): number | null {
	const bytes = line.trim().split(/\s+/);
	if (bytes.length < 3 || bytes[1] !== '06') return null;
	return parseInt(bytes[2], 16);
}

/** Classify a single L3 message type as SI, paging, or neither */
function classifyL3MsgType(msgType: number): 'si' | 'paging' | null {
	if (SI_TYPES.has(msgType)) return 'si';
	if (PAGING_TYPES.has(msgType)) return 'paging';
	return null;
}

/** Extract classified L3 message kinds from log lines, filtering nulls */
function extractL3Kinds(lines: string[]): Array<'si' | 'paging'> {
	return lines
		.map(extractL3MsgType)
		.filter((t): t is number => t !== null)
		.map(classifyL3MsgType)
		.filter((k): k is 'si' | 'paging' => k !== null);
}

/** Parse GSM L3 message types from log lines to detect SI and paging messages. */
function parseL3MessageTypes(lines: string[]): { hasSI: boolean; hasPaging: boolean } {
	const kinds = extractL3Kinds(lines);
	return { hasSI: kinds.includes('si'), hasPaging: kinds.includes('paging') };
}

/** Determine channel type from L3 message analysis results and frame count. */
function determineChannelType(
	hasSI: boolean,
	hasPaging: boolean,
	frameCount: number
): ChannelClassification {
	if (hasSI) return { channelType: 'BCCH/CCCH', controlChannel: true };
	if (hasPaging) return { channelType: 'CCCH', controlChannel: true };
	if (frameCount > 100) return { channelType: 'TCH', controlChannel: false };
	return { channelType: 'SDCCH', controlChannel: false };
}

/**
 * Classify the GSM channel type by analyzing recent frame content.
 * Reads log lines, parses L3 message types, and classifies as
 * BCCH/CCCH, CCCH, TCH, or SDCCH.
 */
export async function classifyChannelType(
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

/** Frame-count signal thresholds — sorted descending */
const FRAME_SIGNAL_THRESHOLDS: [number, string][] = [
	[200, 'Excellent'],
	[150, 'Very Strong'],
	[100, 'Strong'],
	[50, 'Good'],
	[10, 'Moderate']
];

/** Map a GSM frame count to a human-readable signal strength label. */
export function classifySignalStrength(frameCount: number): string {
	if (frameCount <= 0) return 'No Signal';
	return FRAME_SIGNAL_THRESHOLDS.find(([min]) => frameCount > min)?.[1] ?? 'Weak';
}

/** Kill a background GRGSM process by PID, with force-kill fallback. */
export async function cleanupProcess(pid: string): Promise<void> {
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
