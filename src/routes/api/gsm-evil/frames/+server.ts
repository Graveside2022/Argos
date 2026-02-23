import { json } from '@sveltejs/kit';
import { readFile } from 'fs/promises';

import { execFileAsync } from '$lib/server/exec';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/** Lookup table for GSM L3 RR Management message types (protocol discriminator 0x06) */
const GSM_RR_MESSAGE_TYPES: Record<number, string> = {
	0x19: ' [SI1]',
	0x1a: ' [SI2]',
	0x1b: ' [SI3]',
	0x1c: ' [SI4]',
	0x1d: ' [SI5]',
	0x1e: ' [SI6]',
	0x02: ' [SI2bis]',
	0x03: ' [SI2ter]',
	0x07: ' [SI2quat]',
	0x21: ' [PAGING1]',
	0x22: ' [PAGING2]',
	0x24: ' [PAGING3]',
	0x3e: ' [IMM_ASSIGN]',
	0x3f: ' [IMM_ASSIGN_EXT]'
};

function classifyRrMessage(bytes: string[]): string {
	const isRrManagement = bytes.length >= 3 && bytes[1] === '06';
	if (!isRrManagement) return '';
	const msgType = parseInt(bytes[2], 16);
	return GSM_RR_MESSAGE_TYPES[msgType] ?? ' [RR]';
}

function classifyFrame(hexData: string): string {
	const bytes = hexData.split(/\s+/);
	const rrType = classifyRrMessage(bytes);
	if (rrType) return rrType;
	if (hexData.includes('2b 2b 2b 2b 2b 2b 2b 2b 2b')) return ' [FILL]';
	return ' [DATA]';
}

function formatFrameLine(hexData: string): string {
	if (hexData.length < 10) return '';
	const frameType = classifyFrame(hexData);
	const displayData = hexData.length > 48 ? hexData.substring(0, 48) + '...' : hexData;
	return displayData + frameType;
}

async function checkGrgsmProcess(): Promise<boolean> {
	const grgsm = await execFileAsync('/usr/bin/pgrep', ['-f', 'grgsm_livemon_headless']).catch(
		(error: unknown) => {
			logger.warn('[gsm-evil-frames] GRGSM process check failed', {
				error: String(error)
			});
			return { stdout: '' };
		}
	);
	return grgsm.stdout.trim().length > 0;
}

async function readRecentFrames(): Promise<string> {
	const logPath = '/tmp/grgsm_scan.log';
	const frameRegex = /^\s*[0-9a-f]{2}\s/;
	try {
		const fileContent = await readFile(logPath, 'utf-8');
		const allLines = fileContent.split('\n');
		const lastLines = allLines.slice(-10);
		return lastLines.filter((line) => frameRegex.test(line)).join('\n');
	} catch (error: unknown) {
		logger.warn('[gsm-evil-frames] Frame log read failed', { error: String(error) });
		return '';
	}
}

function parseFrames(recentFrames: string): string[] {
	if (!recentFrames) return [];
	const lines = recentFrames.split('\n').filter((line) => line.trim().length > 0);
	return lines
		.slice(-5)
		.map((line) => formatFrameLine(line.trim()))
		.filter((f) => f.length > 0);
}

export const GET: RequestHandler = async () => {
	try {
		const isRunning = await checkGrgsmProcess();
		if (!isRunning) {
			return json({
				success: false,
				frames: [],
				message: 'GSM monitor not running'
			});
		}

		const recentFrames = await readRecentFrames();
		const frames = parseFrames(recentFrames);

		if (frames.length === 0) {
			return json({
				success: false,
				frames: [],
				message: 'No GSM frames captured - check if data is flowing'
			});
		}

		return json({
			success: true,
			frames: frames,
			message: frames.length > 0 ? 'Live frames captured' : 'No frames detected'
		});
	} catch (error: unknown) {
		logger.error('Frame capture error', { error: (error as Error).message });
		return json({
			success: false,
			frames: [],
			message: 'Failed to capture frames',
			// Safe: Catch block error cast to Error for message extraction
			error: (error as Error).message
		});
	}
};
