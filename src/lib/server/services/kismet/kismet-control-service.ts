import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { logWarn } from '$lib/utils/logger';

const execAsync = promisify(exec);

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
		const { stdout } = await execAsync('pgrep -x kismet');
		return stdout.trim().length > 0;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logWarn('[Kismet] Process check failed', { error: msg });
		return false;
	}
}

/**
 * Wait for Kismet web interface to be ready
 * Polls /system/status.json endpoint until responsive
 */
async function waitForKismetReady(maxAttempts = 15): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			const response = await fetch('http://localhost:2501/system/status.json', {
				method: 'GET',
				signal: AbortSignal.timeout(1000)
			});
			if (response.ok) {
				return true;
			}
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			logWarn('[Kismet] Readiness check failed', { error: msg });
		}
		// Wait 1 second before next attempt
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	return false;
}

/**
 * Start Kismet using the startup script
 */
async function startWithScript(): Promise<{ success: boolean; stderr?: string }> {
	const scriptPath = path.join(process.cwd(), 'scripts', 'dev', 'start-kismet-with-alfa.sh');

	if (!fs.existsSync(scriptPath)) {
		console.warn('Kismet startup script not found at:', scriptPath);
		return { success: false };
	}

	console.warn('Executing Kismet startup script...');

	try {
		// Use nohup to ensure the process continues after this request completes
		const { stderr } = await execAsync(`nohup ${scriptPath} > /tmp/kismet-start.log 2>&1 &`, {
			cwd: process.cwd(),
			shell: '/bin/bash'
		});

		if (stderr) {
			console.warn('Startup script stderr:', stderr);
		}

		return { success: true, stderr };
	} catch (error) {
		console.error('Script execution failed:', error);
		return { success: false };
	}
}

/**
 * Start Kismet directly (fallback when script not found)
 */
async function startDirect(): Promise<boolean> {
	console.warn('Attempting direct Kismet startup...');

	try {
		// Start Kismet with basic configuration
		// Using nohup to prevent it from being killed when the request completes
		await execAsync('nohup kismet --no-ncurses --no-line-wrap > /tmp/kismet.log 2>&1 &');

		// Give Kismet a moment to start
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Check if it started
		return await isKismetRunning();
	} catch (error) {
		console.error('Direct Kismet startup failed:', error);
		return false;
	}
}

/**
 * Detect the network interface from Kismet startup logs
 */
async function detectInterface(): Promise<string> {
	const defaultInterface = 'wlxbee1d69fa811'; // Known Alfa interface

	try {
		const { stdout } = await execAsync(
			'tail -20 /tmp/kismet-start.log | grep "Primary interface selected:" | tail -1'
		);
		const match = stdout.match(/Primary interface selected:\s+(\S+)/);
		if (match) {
			return match[1];
		}
	} catch (_error: unknown) {
		// Ignore errors, use default
	}

	return defaultInterface;
}

/**
 * Start Kismet WiFi discovery service
 * Tries script-based startup first, falls back to direct startup if needed
 *
 * @returns Result object with status and data
 */
export async function startKismet(): Promise<KismetStartResult> {
	console.warn('Starting Kismet WiFi discovery...');

	// Check if already running
	if (await isKismetRunning()) {
		console.warn('Kismet is already running');
		return {
			success: true,
			status: 'already_running',
			message: 'Kismet is already running',
			data: {
				interface: 'Use Kismet UI to configure',
				channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
				deviceCount: 0,
				uptime: 0
			}
		};
	}

	// Try script-based startup first
	const scriptResult = await startWithScript();

	if (!scriptResult.success) {
		// Script not found or failed - try direct startup
		const directStarted = await startDirect();

		if (directStarted) {
			return {
				success: true,
				status: 'started',
				message: 'Kismet started (direct mode)',
				data: {
					interface: 'Configure via Kismet UI',
					channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
					deviceCount: 0,
					uptime: 0
				}
			};
		}

		return {
			success: false,
			status: 'failed',
			message: 'Failed to start Kismet - script not found and direct start failed',
			error: 'Startup script not found and direct start failed'
		};
	}

	// Script executed - wait for Kismet to be ready
	console.warn('Waiting for Kismet to initialize...');
	const isReady = await waitForKismetReady();

	if (!isReady) {
		// Check if Kismet is at least running
		if (await isKismetRunning()) {
			console.warn('Kismet is running but may still be initializing');
			return {
				success: true,
				status: 'starting',
				message: 'Kismet is starting, may take a few more seconds',
				data: {
					interface: 'Detecting...',
					channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
					deviceCount: 0,
					uptime: 0
				}
			};
		}

		// Not running at all
		console.error('Kismet failed to start - check /tmp/kismet-start.log');
		return {
			success: false,
			status: 'failed',
			message: 'Failed to start Kismet - check logs at /tmp/kismet-start.log',
			error: 'Kismet failed to start'
		};
	}

	// Kismet is ready!
	console.warn('Kismet started successfully');

	const detectedInterface = await detectInterface();

	return {
		success: true,
		status: 'started',
		message: 'Kismet WiFi discovery started successfully',
		data: {
			interface: detectedInterface,
			channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
			deviceCount: 0,
			uptime: 0,
			note: 'Configure data sources via Kismet UI'
		}
	};
}
