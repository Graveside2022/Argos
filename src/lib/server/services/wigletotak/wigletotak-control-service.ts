/**
 * WigleToTAK control service.
 * Manages start/stop/status of the WigleToTAK Flask process.
 *
 * WigleToTAK is a standalone Python Flask app (not a systemd unit).
 * We spawn it directly and track its PID. Kismet's wiglecsv log
 * directory is passed as the default data source.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { unlink } from 'fs/promises';
import * as net from 'net';
import os from 'os';
import path from 'path';

import { errMsg } from '$lib/server/api/error-utils';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

export interface WigleTotakControlResult {
	success: boolean;
	message: string;
	details?: string;
	error?: string;
}

export interface WigleTotakStatusResult {
	success: boolean;
	isRunning: boolean;
	status: 'active' | 'inactive';
	port: number;
}

const WIGLETOTAK_PORT = env.WIGLETOTAK_PORT;
const PID_FILE = '/tmp/wigletotak.pid';
const INSTALL_DIR = path.join(os.homedir(), 'WigleToTAK');
const SCRIPT = path.join(INSTALL_DIR, 'WigletoTAK.py');

/** TCP port probe — resolves true if Flask is accepting connections */
function isPortOpen(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new net.Socket();
		socket.setTimeout(1500);
		socket
			.once('connect', () => {
				socket.destroy();
				resolve(true);
			})
			.once('timeout', () => {
				socket.destroy();
				resolve(false);
			})
			.once('error', () => resolve(false))
			.connect(port, '127.0.0.1');
	});
}

/** Read saved PID, return null if file missing or stale */
function readPid(): number | null {
	try {
		if (!existsSync(PID_FILE)) return null;
		const pid = parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10);
		return isNaN(pid) ? null : pid;
	} catch {
		return null;
	}
}

/** Check if a process with given PID is alive */
async function isPidAlive(pid: number): Promise<boolean> {
	try {
		await execFileAsync('/bin/kill', ['-0', String(pid)]);
		return true;
	} catch {
		return false;
	}
}

/** Resolve whether WigleToTAK process is running */
async function isWigleTotakRunning(): Promise<boolean> {
	const pid = readPid();
	if (pid !== null && (await isPidAlive(pid))) return true;
	// Fall back to port probe (handles manual starts outside Argos)
	return isPortOpen(WIGLETOTAK_PORT);
}

/** Poll until Flask responds or timeout */
async function waitForReady(maxAttempts = 20): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		if (await isPortOpen(WIGLETOTAK_PORT)) return true;
		await delay(1000);
	}
	return false;
}

/** Spawn the Flask process and record its PID */
async function spawnFlask(): Promise<WigleTotakControlResult> {
	const child = spawn('python3', [SCRIPT], {
		cwd: INSTALL_DIR,
		detached: true,
		stdio: 'ignore',
		env: { ...process.env, WIGLETOTAK_PORT: String(WIGLETOTAK_PORT) }
	});
	child.unref();

	if (child.pid) {
		writeFileSync(PID_FILE, String(child.pid), 'utf8');
		logger.info(`[wigletotak] Spawned PID ${child.pid}, waiting for Flask...`);
	}

	if (await waitForReady()) {
		logger.info('[wigletotak] Started successfully');
		return {
			success: true,
			message: 'WigleToTAK started successfully',
			details: `Flask dashboard active at http://localhost:${WIGLETOTAK_PORT}`
		};
	}

	return {
		success: false,
		message: 'WigleToTAK did not respond in time',
		error: `Check ${INSTALL_DIR} — run manually: python3 WigletoTAK.py`
	};
}

/** Start WigleToTAK Flask process */
export async function startWigleToTak(): Promise<WigleTotakControlResult> {
	try {
		logger.info('[wigletotak] Starting WigleToTAK');

		if (await isWigleTotakRunning()) {
			return {
				success: true,
				message: 'WigleToTAK is already running',
				details: `Dashboard at http://localhost:${WIGLETOTAK_PORT}`
			};
		}

		if (!existsSync(SCRIPT)) {
			return {
				success: false,
				message: 'WigleToTAK not installed',
				error: `Script not found at ${SCRIPT}. Clone: git clone https://github.com/canaryradio/WigleToTAK ~/WigleToTAK`
			};
		}

		return spawnFlask();
	} catch (error: unknown) {
		logger.error('[wigletotak] Start error', { error: errMsg(error) });
		return { success: false, message: 'Failed to start WigleToTAK', error: errMsg(error) };
	}
}

/** Kill a process by PID with SIGTERM, escalate to SIGKILL if needed */
async function killPid(pid: number): Promise<void> {
	await execFileAsync('/bin/kill', ['-TERM', String(pid)]);
	await delay(1500);
	if (await isPidAlive(pid)) {
		await execFileAsync('/bin/kill', ['-KILL', String(pid)]);
		await delay(500);
	}
}

/** Clean up PID file and stray processes */
async function cleanupStrayProcesses(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/pkill', ['-f', 'WigletoTAK.py']);
	} catch {
		/* no stray processes */
	}
	try {
		await unlink(PID_FILE);
	} catch {
		/* already gone */
	}
}

/** Stop WigleToTAK Flask process */
export async function stopWigleToTak(): Promise<WigleTotakControlResult> {
	try {
		logger.info('[wigletotak] Stopping WigleToTAK');

		const pid = readPid();
		if (pid !== null && (await isPidAlive(pid))) {
			await killPid(pid);
		}

		await cleanupStrayProcesses();

		if (await isPortOpen(WIGLETOTAK_PORT)) {
			return {
				success: false,
				message: 'WigleToTAK stop attempted but port is still open',
				error: `Something is still listening on port ${WIGLETOTAK_PORT}`
			};
		}

		logger.info('[wigletotak] Stopped successfully');
		return { success: true, message: 'WigleToTAK stopped successfully' };
	} catch (error: unknown) {
		logger.error('[wigletotak] Stop error', { error: errMsg(error) });
		return { success: false, message: 'Failed to stop WigleToTAK', error: errMsg(error) };
	}
}

/** Get current WigleToTAK status */
export async function getWigleTotakStatus(): Promise<WigleTotakStatusResult> {
	try {
		const isRunning = await isWigleTotakRunning();
		return {
			success: true,
			isRunning,
			status: isRunning ? 'active' : 'inactive',
			port: WIGLETOTAK_PORT
		};
	} catch {
		return { success: true, isRunning: false, status: 'inactive', port: WIGLETOTAK_PORT };
	}
}
