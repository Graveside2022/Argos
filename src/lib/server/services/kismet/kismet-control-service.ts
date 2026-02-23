import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { execFileAsync } from '$lib/server/exec';
import { withRetry } from '$lib/server/retry';
import { logger } from '$lib/utils/logger';

export interface KismetStartResult {
	success: boolean;
	status: 'already_running' | 'started' | 'starting' | 'failed';
	message: string;
	data?: {
		interface: string;
		channels: number[];
		deviceCount: number;
		uptime: number;
		note?: string;
	};
	error?: string;
}

/**
 * Check if Kismet process is running
 */
export async function isKismetRunning(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']);
		return stdout.trim().length > 0;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[Kismet] Process check failed', { error: msg });
		return false;
	}
}

/** Single probe of the Kismet status endpoint */
async function probeKismetStatus(): Promise<boolean> {
	try {
		const response = await fetch('http://localhost:2501/system/status.json', {
			method: 'GET',
			signal: AbortSignal.timeout(1000)
		});
		return response.ok;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[Kismet] Readiness check failed', { error: msg });
		return false;
	}
}

/** Poll Kismet status endpoint until responsive */
async function waitForKismetReady(maxAttempts = 15): Promise<boolean> {
	const probe = withRetry(
		async () => {
			const ready = await probeKismetStatus();
			if (!ready) throw new Error('Kismet not ready');
			return true;
		},
		{ attempts: maxAttempts, delayMs: 1000, backoff: 'linear' }
	);
	try {
		return await probe();
	} catch {
		return false;
	}
}

/**
 * Start Kismet using the startup script
 */
async function startWithScript(): Promise<{ success: boolean; stderr?: string }> {
	const scriptPath = path.join(process.cwd(), 'scripts', 'dev', 'start-kismet-with-alfa.sh');

	if (!fs.existsSync(scriptPath)) {
		logger.warn('[Kismet] Startup script not found', { scriptPath });
		return { success: false };
	}

	logger.info('[Kismet] Executing startup script');

	try {
		// Spawn detached process — replaces nohup/shell backgrounding
		const logFd = fs.openSync('/tmp/kismet-start.log', 'w');
		const child = spawn(scriptPath, [], {
			cwd: process.cwd(),
			detached: true,
			stdio: ['ignore', logFd, logFd]
		});
		child.unref();
		fs.closeSync(logFd);

		return { success: true };
	} catch (error) {
		logger.error('[Kismet] Script execution failed', {
			error: error instanceof Error ? error.message : String(error)
		});
		return { success: false };
	}
}

/**
 * Start Kismet directly (fallback when script not found)
 */
async function startDirect(): Promise<boolean> {
	logger.info('[Kismet] Attempting direct startup');

	try {
		// Spawn detached Kismet process — replaces nohup/shell backgrounding
		const logFd = fs.openSync('/tmp/kismet.log', 'w');
		const child = spawn('/usr/bin/kismet', ['--no-ncurses', '--no-line-wrap'], {
			detached: true,
			stdio: ['ignore', logFd, logFd]
		});
		child.unref();
		fs.closeSync(logFd);

		// Give Kismet a moment to start
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Check if it started
		return await isKismetRunning();
	} catch (error) {
		logger.error('[Kismet] Direct startup failed', {
			error: error instanceof Error ? error.message : String(error)
		});
		return false;
	}
}

/** Default WiFi channels (2.4 GHz band) */
const DEFAULT_CHANNELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const EXTENDED_CHANNELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/** Build a standard KismetStartResult with default data */
function buildResult(
	success: boolean,
	status: KismetStartResult['status'],
	message: string,
	iface: string,
	extra?: { channels?: number[]; note?: string; error?: string }
): KismetStartResult {
	return {
		success,
		status,
		message,
		data: {
			interface: iface,
			channels: extra?.channels || DEFAULT_CHANNELS,
			deviceCount: 0,
			uptime: 0,
			note: extra?.note
		},
		error: extra?.error
	};
}

/** Parse interface name from Kismet startup log */
function parseInterfaceFromLog(content: string): string | null {
	const lines = content.trim().split('\n').slice(-20);
	const interfaceLines = lines.filter((l) => l.includes('Primary interface selected:'));
	const lastLine = interfaceLines[interfaceLines.length - 1];
	const match = lastLine?.match(/Primary interface selected:\s+(\S+)/);
	return match?.[1] ?? null;
}

/** Detect the network interface from Kismet startup logs */
async function detectInterface(): Promise<string> {
	try {
		const content = fs.readFileSync('/tmp/kismet-start.log', 'utf-8');
		return parseInterfaceFromLog(content) || 'wlxbee1d69fa811';
	} catch {
		return 'wlxbee1d69fa811';
	}
}

/** Try direct startup as fallback when script fails */
async function tryFallbackDirect(): Promise<KismetStartResult> {
	const directStarted = await startDirect();
	if (directStarted) {
		return buildResult(
			true,
			'started',
			'Kismet started (direct mode)',
			'Configure via Kismet UI'
		);
	}
	return buildResult(
		false,
		'failed',
		'Failed to start Kismet - script not found and direct start failed',
		'',
		{
			error: 'Startup script not found and direct start failed'
		}
	);
}

/** Handle the result after script started and waiting for readiness */
async function handleScriptStarted(): Promise<KismetStartResult> {
	logger.info('[Kismet] Waiting for initialization');
	if (await waitForKismetReady()) {
		logger.info('[Kismet] Started successfully');
		const detectedInterface = await detectInterface();
		return buildResult(
			true,
			'started',
			'Kismet WiFi discovery started successfully',
			detectedInterface,
			{
				channels: EXTENDED_CHANNELS,
				note: 'Configure data sources via Kismet UI'
			}
		);
	}

	if (await isKismetRunning()) {
		logger.info('[Kismet] Running but may still be initializing');
		return buildResult(
			true,
			'starting',
			'Kismet is starting, may take a few more seconds',
			'Detecting...'
		);
	}

	logger.error('[Kismet] Failed to start - check /tmp/kismet-start.log');
	return buildResult(
		false,
		'failed',
		'Failed to start Kismet - check logs at /tmp/kismet-start.log',
		'',
		{
			error: 'Kismet failed to start'
		}
	);
}

/** Start Kismet WiFi discovery service */
export async function startKismet(): Promise<KismetStartResult> {
	logger.info('[Kismet] Starting WiFi discovery');

	if (await isKismetRunning()) {
		logger.info('[Kismet] Already running');
		return buildResult(
			true,
			'already_running',
			'Kismet is already running',
			'Use Kismet UI to configure'
		);
	}

	const scriptResult = await startWithScript();
	if (!scriptResult.success) return tryFallbackDirect();
	return handleScriptStarted();
}
