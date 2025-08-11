import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

// Helper to check if Kismet is already running
async function isKismetRunning(): Promise<boolean> {
	try {
		const { stdout } = await execAsync('pgrep -x kismet');
		return stdout.trim().length > 0;
	} catch {
		return false;
	}
}

// Helper to wait for Kismet to be ready
async function waitForKismet(maxAttempts = 15): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			// Try to connect to Kismet's web interface
			const response = await fetch('http://localhost:2501/system/status.json', {
				method: 'GET',
				signal: AbortSignal.timeout(1000)
			});
			if (response.ok) {
				return true;
			}
		} catch {
			// Not ready yet
		}
		// Wait 1 second before next attempt
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	return false;
}

export const POST: RequestHandler = async ({ _url }) => {
	try {
		console.warn('Starting Kismet WiFi discovery...');

		// Check if Kismet is already running
		if (await isKismetRunning()) {
			console.warn('Kismet is already running');
			return json({
				success: true,
				status: 'already_running',
				message: 'Kismet is already running',
				data: {
					interface: 'Use Kismet UI to configure',
					channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
					deviceCount: 0,
					uptime: 0
				}
			});
		}

		// Determine the path to the startup script
		const scriptPath = path.join(process.cwd(), 'scripts', 'start-kismet-with-alfa.sh');

		// Check if script exists
		if (!fs.existsSync(scriptPath)) {
			console.error('Kismet startup script not found at:', scriptPath);

			// Fallback: try to start Kismet directly
			console.warn('Attempting direct Kismet startup...');

			try {
				// Start Kismet with basic configuration
				// Using nohup to prevent it from being killed when the request completes
				await execAsync(
					'nohup kismet --no-ncurses --no-line-wrap > /tmp/kismet.log 2>&1 &'
				);

				// Give Kismet a moment to start
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Check if it started
				if (await isKismetRunning()) {
					return json({
						success: true,
						status: 'started',
						message: 'Kismet started (direct mode)',
						data: {
							interface: 'Configure via Kismet UI',
							channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
							deviceCount: 0,
							uptime: 0
						}
					});
				}
			} catch (error) {
				console.error('Direct Kismet startup failed:', error);
			}

			return json(
				{
					success: false,
					error: 'Startup script not found and direct start failed',
					message: 'Failed to start Kismet - script not found'
				},
				{
					status: 500
				}
			);
		}

		// Execute the startup script in background
		console.warn('Executing Kismet startup script...');

		// Use nohup to ensure the process continues after this request completes
		// Redirect output to log file for debugging
		const { stderr } = await execAsync(`nohup ${scriptPath} > /tmp/kismet-start.log 2>&1 &`, {
			cwd: process.cwd(),
			shell: '/bin/bash'
		});

		if (stderr) {
			console.warn('Startup script stderr:', stderr);
		}

		// Wait for Kismet to be ready
		console.warn('Waiting for Kismet to initialize...');
		const isReady = await waitForKismet();

		if (!isReady) {
			// Check if Kismet is at least running
			if (await isKismetRunning()) {
				console.warn('Kismet is running but may still be initializing');
				return json({
					success: true,
					status: 'starting',
					message: 'Kismet is starting, may take a few more seconds',
					data: {
						interface: 'Detecting...',
						channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
						deviceCount: 0,
						uptime: 0
					}
				});
			}

			// Not running at all
			console.error('Kismet failed to start - check /tmp/kismet-start.log');
			return json(
				{
					success: false,
					error: 'Kismet failed to start',
					message: 'Failed to start Kismet - check logs at /tmp/kismet-start.log'
				},
				{
					status: 500
				}
			);
		}

		// Kismet is ready!
		console.warn('Kismet started successfully');

		// Try to get actual interface info from the startup log
		let detectedInterface = 'wlxbee1d69fa811'; // Default to known Alfa interface
		try {
			const { stdout } = await execAsync(
				'tail -20 /tmp/kismet-start.log | grep "Primary interface selected:" | tail -1'
			);
			const match = stdout.match(/Primary interface selected:\s+(\S+)/);
			if (match) {
				detectedInterface = match[1];
			}
		} catch {
			// Ignore errors, use default
		}

		return json({
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
		});
	} catch (error) {
		console.error('Kismet start error:', error);

		return json(
			{
				success: false,
				error: (error as Error).message,
				message: 'Failed to start Kismet'
			},
			{
				status: 500
			}
		);
	}
};
