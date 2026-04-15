/**
 * Public start/stop/status API for the SDR++ VNC stack.
 *
 * Orchestrates Xtigervnc + SDR++ + websockify to stream
 * the full C++ GUI into the Argos dashboard via noVNC.
 *
 * Unlike Sparrow-WiFi, SDR++ has no separate agent service.
 * This control service only manages the VNC three-process stack.
 */

import { errMsg } from '$lib/server/api/error-utils';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import {
	centerSdrppWindow,
	isStackAlive,
	killAllProcesses,
	killOrphansByPort,
	setVncBackground,
	spawnSdrppGui,
	spawnWebsockify,
	spawnXtigervnc,
	waitForStackReady
} from './sdrpp-vnc-processes';
import {
	SDRPP_WS_PATH,
	SDRPP_WS_PORT,
	type SdrppVncControlResult,
	type SdrppVncStatusResult
} from './sdrpp-vnc-types';

// ───────────────────── shutdown handler (idempotent) ─────────────────────

let shutdownHandlerRegistered = false;

function registerShutdownHandler(): void {
	if (shutdownHandlerRegistered) return;
	shutdownHandlerRegistered = true;
	const handler = () => {
		logger.info('[sdrpp-vnc] received shutdown signal, tearing down stack');
		void killAllProcesses();
	};
	process.once('SIGTERM', handler);
	process.once('SIGINT', handler);
}

// ─────────────────────────────── start ──────────────────────────────────

async function spawnStackProcesses(): Promise<void> {
	logger.info('[sdrpp-vnc] spawning Xtigervnc');
	spawnXtigervnc();
	await delay(400);

	setVncBackground();

	logger.info('[sdrpp-vnc] spawning SDR++');
	spawnSdrppGui();
	await delay(2500);

	centerSdrppWindow();

	logger.info('[sdrpp-vnc] spawning websockify');
	spawnWebsockify();
}

async function cleanupFailedStart(): Promise<SdrppVncControlResult> {
	logger.error('[sdrpp-vnc] stack failed to become ready within timeout');
	await killAllProcesses();
	await killOrphansByPort();
	return {
		success: false,
		message: 'Failed to start SDR++ VNC stack',
		error: 'Timeout waiting for VNC and websockify to respond'
	};
}

function successResult(message: string): SdrppVncControlResult {
	return {
		success: true,
		message,
		wsPort: SDRPP_WS_PORT,
		wsPath: SDRPP_WS_PATH
	};
}

/** Start the SDR++ VNC stack. Idempotent -- returns existing session if running. */
export async function startSdrppVnc(): Promise<SdrppVncControlResult> {
	try {
		registerShutdownHandler();

		if (isStackAlive()) {
			logger.info('[sdrpp-vnc] stack already running');
			return successResult('SDR++ VNC stack already running');
		}

		await killOrphansByPort();
		await spawnStackProcesses();

		if (!(await waitForStackReady())) return cleanupFailedStart();

		logger.info('[sdrpp-vnc] stack ready', { wsPort: SDRPP_WS_PORT });
		return successResult('SDR++ VNC stack started');
	} catch (error: unknown) {
		logger.error('[sdrpp-vnc] start error', { error: errMsg(error) });
		await killAllProcesses().catch(() => undefined);
		return {
			success: false,
			message: 'Failed to start SDR++ VNC stack',
			error: errMsg(error)
		};
	}
}

// ──────────────────────────────── stop ──────────────────────────────────

export async function stopSdrppVnc(): Promise<SdrppVncControlResult> {
	try {
		logger.info('[sdrpp-vnc] stopping stack');
		await killAllProcesses();
		await killOrphansByPort();
		logger.info('[sdrpp-vnc] stack stopped');
		return { success: true, message: 'SDR++ VNC stack stopped' };
	} catch (error: unknown) {
		logger.error('[sdrpp-vnc] stop error', { error: errMsg(error) });
		return {
			success: false,
			message: 'Failed to stop SDR++ VNC stack',
			error: errMsg(error)
		};
	}
}

// ─────────────────────────────── status ─────────────────────────────────

export function getSdrppVncStatus(): SdrppVncStatusResult {
	const running = isStackAlive();
	return {
		success: true,
		isRunning: running,
		status: running ? 'active' : 'inactive',
		wsPort: SDRPP_WS_PORT,
		wsPath: SDRPP_WS_PATH
	};
}
