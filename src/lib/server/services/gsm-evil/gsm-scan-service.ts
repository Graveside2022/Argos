import path from 'path';

import { errMsg } from '$lib/server/api/error-utils';
import { env } from '$lib/server/env';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import {
	buildGsmArgs,
	captureFrameCount,
	checkHardwareErrors,
	classifyChannelType,
	classifySignalStrength,
	cleanupProcess,
	spawnGrgsm,
	testGrgsm
} from './gsm-scan-helpers';

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

const GSM_LOG_PATH = path.join(env.ARGOS_TEMP_DIR, 'grgsm_scan.log');
const DEFAULT_GAIN = 40;
const HACKRF_INIT_DELAY_MS = 2000;
const CAPTURE_TIME_SECONDS = 3;
const INTER_FREQ_DELAY_MS = 500;
const TARGET_FREQUENCIES: string[] = ['947.2', '950.0'];

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
		await delay(HACKRF_INIT_DELAY_MS);

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
			error: errMsg(freqError)
		});
		if (errMsg(freqError).includes('Hardware not available')) {
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
			await delay(INTER_FREQ_DELAY_MS);
		}

		return buildScanResponse(results);
	} catch (error: unknown) {
		logger.error('[gsm-scan] Scan error', { error: errMsg(error) });
		return {
			success: false,
			message: 'Scan failed. Make sure GSM Evil is stopped first.',
			error: errMsg(error)
		};
	}
}
