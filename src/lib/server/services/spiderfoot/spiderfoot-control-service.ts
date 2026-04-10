/**
 * SpiderFoot OSINT tool process control service.
 * Manages start/stop/status of SpiderFoot as a native process.
 * SpiderFoot runs on port 5002 via `spiderfoot -l 127.0.0.1:5002`.
 */

import { type ChildProcess, spawn } from 'child_process';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { logger } from '$lib/utils/logger';

const execFileAsync = promisify(execFile);

const SPIDERFOOT_PORT = 5002;
const HEALTH_URL = `http://127.0.0.1:${SPIDERFOOT_PORT}`;

/** Result types for control operations */
interface SpiderfootControlResult {
	success: boolean;
	message: string;
	error?: string;
}

interface SpiderfootStatusResult {
	success: boolean;
	isRunning: boolean;
	message: string;
}

let spiderfootProcess: ChildProcess | null = null;

/** Check if SpiderFoot is responding on its port */
async function isSpiderfootResponding(): Promise<boolean> {
	try {
		const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
		return response.ok;
	} catch {
		return false;
	}
}

/** Check if the managed process is still alive */
function isProcessAlive(): boolean {
	if (!spiderfootProcess?.pid) return false;
	try {
		process.kill(spiderfootProcess.pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** Wait for SpiderFoot to become responsive */
async function waitForReady(maxAttempts = 30): Promise<boolean> {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		if (await isSpiderfootResponding()) return true;
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	return false;
}

/** Spawn the SpiderFoot web server process */
function spawnSpiderfootProcess(): void {
	spiderfootProcess = spawn('/usr/bin/spiderfoot', ['-l', `127.0.0.1:${SPIDERFOOT_PORT}`], {
		stdio: 'ignore',
		detached: true,
		env: { ...process.env }
	});

	spiderfootProcess.unref();

	spiderfootProcess.on('exit', (code) => {
		logger.info(`[spiderfoot] Process exited with code ${code}`);
		spiderfootProcess = null;
	});
}

/** Kill the managed process via SIGTERM to process group */
function killManagedProcess(): void {
	if (!spiderfootProcess?.pid) return;
	try {
		process.kill(-spiderfootProcess.pid, 'SIGTERM');
		logger.info('[spiderfoot] Sent SIGTERM to process group');
	} catch {
		logger.warn('[spiderfoot] Failed to kill managed process group');
	}
	spiderfootProcess = null;
}

/** Kill all processes listening on the SpiderFoot port (handles orphaned process trees) */
async function killProcessOnPort(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/fuser', ['-k', `${SPIDERFOOT_PORT}/tcp`]);
	} catch {
		/* fuser exits non-zero when no process found */
	}
}

/** Attempt all kill strategies and wait for shutdown */
async function terminateSpiderfoot(): Promise<boolean> {
	killManagedProcess();
	await killProcessOnPort();

	// Wait up to 5 seconds for clean shutdown
	for (let i = 0; i < 10; i++) {
		if (!(await isSpiderfootResponding())) return true;
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	return !(await isSpiderfootResponding());
}

/** Start the SpiderFoot process */
export async function startSpiderfoot(): Promise<SpiderfootControlResult> {
	try {
		if (await isSpiderfootResponding()) {
			return { success: true, message: 'SpiderFoot is already running' };
		}

		logger.info('[spiderfoot] Starting SpiderFoot');
		spawnSpiderfootProcess();

		const ready = await waitForReady();
		if (!ready) {
			killManagedProcess();
			return {
				success: false,
				message: 'SpiderFoot failed to start',
				error: 'Timeout waiting for health check'
			};
		}

		logger.info('[spiderfoot] SpiderFoot started successfully');
		return { success: true, message: 'SpiderFoot started successfully' };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.error(`[spiderfoot] Start failed: ${msg}`);
		return { success: false, message: 'Failed to start SpiderFoot', error: msg };
	}
}

/** Stop the SpiderFoot process */
export async function stopSpiderfoot(): Promise<SpiderfootControlResult> {
	try {
		logger.info('[spiderfoot] Stopping SpiderFoot');

		const stopped = await terminateSpiderfoot();
		if (!stopped) {
			return {
				success: false,
				message: 'Failed to stop SpiderFoot',
				error: 'Process still responding after kill'
			};
		}

		return { success: true, message: 'SpiderFoot stopped' };
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.error(`[spiderfoot] Stop failed: ${msg}`);
		return { success: false, message: 'Failed to stop SpiderFoot', error: msg };
	}
}

/** Get current SpiderFoot status */
export async function getSpiderfootStatus(): Promise<SpiderfootStatusResult> {
	const isRunning = (await isSpiderfootResponding()) || isProcessAlive();
	return {
		success: true,
		isRunning,
		message: isRunning ? 'SpiderFoot is running' : 'SpiderFoot is not running'
	};
}
