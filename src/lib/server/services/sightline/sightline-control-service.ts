/**
 * Sightline OSINT tool process control service.
 * Manages start/stop/status of the Sightline Next.js app as a native process.
 * Sightline runs on port 3001 via `npx next dev -p 3001`.
 */

import { type ChildProcess, spawn } from 'child_process';
import path from 'path';

import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

export interface SightlineControlResult {
	success: boolean;
	message: string;
	error?: string;
}

export interface SightlineStatusResult {
	success: boolean;
	isRunning: boolean;
	status: 'active' | 'inactive';
	port: number;
}

const SIGHTLINE_PORT = 3001;
const SIGHTLINE_DIR = process.env.SIGHTLINE_DIR || path.resolve(process.cwd(), '..', 'sightline');
const HEALTH_URL = `http://localhost:${SIGHTLINE_PORT}`;

/** Singleton process reference */
let sightlineProcess: ChildProcess | null = null;

/** Check if Sightline is responding on its port */
async function isSightlineResponding(): Promise<boolean> {
	try {
		const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
		return response.ok;
	} catch {
		return false;
	}
}

/** Poll until Sightline responds or timeout */
async function waitForReady(maxAttempts = 20): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		if (await isSightlineResponding()) return true;
		await delay(1000);
	}
	return false;
}

/** Check if our managed process is still alive */
function isProcessAlive(): boolean {
	if (!sightlineProcess || sightlineProcess.exitCode !== null) return false;
	try {
		sightlineProcess.kill(0);
		return true;
	} catch {
		return false;
	}
}

/** Spawn the Sightline Next.js dev server process */
function spawnSightlineProcess(): void {
	sightlineProcess = spawn(
		process.env.NPX_PATH || 'npx',
		['next', 'dev', '-p', String(SIGHTLINE_PORT)],
		{
			cwd: SIGHTLINE_DIR,
			stdio: 'ignore',
			detached: true,
			env: { ...process.env, NODE_ENV: 'development' }
		}
	);

	sightlineProcess.unref();

	sightlineProcess.on('error', (err) => {
		logger.error('[sightline] Process error', { error: errMsg(err) });
		sightlineProcess = null;
	});

	sightlineProcess.on('exit', (code) => {
		logger.info('[sightline] Process exited', { code });
		sightlineProcess = null;
	});
}

/** Start the Sightline Next.js dev server */
export async function startSightline(): Promise<SightlineControlResult> {
	try {
		logger.info('[sightline] Starting Sightline');

		if (isProcessAlive() || (await isSightlineResponding())) {
			logger.info('[sightline] Already running');
			return { success: true, message: 'Sightline is already running' };
		}

		spawnSightlineProcess();
		logger.info('[sightline] Process spawned, waiting for ready...');

		if (await waitForReady()) {
			logger.info('[sightline] Started successfully');
			return { success: true, message: 'Sightline started successfully' };
		}

		return {
			success: false,
			message: 'Sightline process started but not responding yet',
			error: `Check if port ${SIGHTLINE_PORT} is available`
		};
	} catch (error: unknown) {
		logger.error('[sightline] Start error', { error: errMsg(error) });
		return { success: false, message: 'Failed to start Sightline', error: errMsg(error) };
	}
}

/** Kill the managed sightline process and its process group */
function killManagedProcess(): void {
	if (!sightlineProcess || !isProcessAlive()) return;
	const pid = sightlineProcess.pid;
	if (pid) {
		try {
			process.kill(-pid, 'SIGTERM');
		} catch {
			sightlineProcess.kill('SIGTERM');
		}
	}
	sightlineProcess = null;
}

/** Kill all processes listening on the Sightline port (handles orphaned process trees) */
async function killProcessOnPort(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/fuser', ['-k', `${SIGHTLINE_PORT}/tcp`]);
	} catch {
		/* fuser exits non-zero when no process found — that's fine */
	}
}

/** Attempt all kill strategies and wait for shutdown */
async function terminateSightline(): Promise<boolean> {
	killManagedProcess();

	// Fallback: kill orphaned process by port if managed ref was lost (e.g. after Vite restart)
	if (await isSightlineResponding()) {
		logger.info('[sightline] Managed process gone, killing by port');
		await killProcessOnPort();
	}

	await delay(1000);
	return !(await isSightlineResponding());
}

/** Stop the Sightline process */
export async function stopSightline(): Promise<SightlineControlResult> {
	try {
		logger.info('[sightline] Stopping Sightline');

		if (!isProcessAlive() && !(await isSightlineResponding())) {
			return { success: true, message: 'Sightline is not running' };
		}

		const stopped = await terminateSightline();
		if (!stopped) {
			return {
				success: false,
				message: 'Sightline is still running after stop attempt',
				error: 'Could not kill the process'
			};
		}

		logger.info('[sightline] Stopped successfully');
		return { success: true, message: 'Sightline stopped successfully' };
	} catch (error: unknown) {
		logger.error('[sightline] Stop error', { error: errMsg(error) });
		return { success: false, message: 'Failed to stop Sightline', error: errMsg(error) };
	}
}

/** Get current Sightline status */
export async function getSightlineStatus(): Promise<SightlineStatusResult> {
	const processAlive = isProcessAlive();
	const responding = await isSightlineResponding();
	const isRunning = processAlive || responding;

	return {
		success: true,
		isRunning,
		status: isRunning ? 'active' : 'inactive',
		port: SIGHTLINE_PORT
	};
}
