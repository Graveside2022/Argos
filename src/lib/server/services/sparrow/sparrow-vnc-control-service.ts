/**
 * Public start/stop/status API for the Sparrow-WiFi VNC stack.
 *
 * Orchestrates Xtigervnc + sparrow-wifi.py + websockify to stream
 * the full PyQt5 GUI into the Argos dashboard via noVNC.
 *
 * Simpler than WebTAK: no URL management, no Chromium profile cleanup.
 */

import { errMsg } from '$lib/server/api/error-utils';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import {
	centerSparrowWindow,
	isStackAlive,
	killAllProcesses,
	killOrphansByPort,
	setVncBackground,
	spawnSparrowGui,
	spawnWebsockify,
	spawnXtigervnc,
	waitForStackReady
} from './sparrow-vnc-processes';
import {
	SPARROW_WS_PORT,
	type SparrowVncControlResult,
	type SparrowVncStatusResult
} from './sparrow-vnc-types';

const WS_PATH = '/websockify';

// ───────────────────── shutdown handler (idempotent) ─────────────────────

let shutdownHandlerRegistered = false;

function registerShutdownHandler(): void {
	if (shutdownHandlerRegistered) return;
	shutdownHandlerRegistered = true;
	const handler = () => {
		logger.info('[sparrow-vnc] received shutdown signal, tearing down stack');
		void killAllProcesses();
	};
	process.once('SIGTERM', handler);
	process.once('SIGINT', handler);
	process.once('exit', handler);
}

// ─────────────────────────────── start ──────────────────────────────────

async function spawnStackProcesses(): Promise<void> {
	logger.info('[sparrow-vnc] spawning Xtigervnc');
	spawnXtigervnc();
	await delay(400);

	setVncBackground();

	logger.info('[sparrow-vnc] spawning sparrow-wifi.py');
	spawnSparrowGui();
	await delay(1500);

	centerSparrowWindow();

	logger.info('[sparrow-vnc] spawning websockify');
	spawnWebsockify();
}

async function cleanupFailedStart(): Promise<SparrowVncControlResult> {
	logger.error('[sparrow-vnc] stack failed to become ready within timeout');
	await killAllProcesses();
	await killOrphansByPort();
	return {
		success: false,
		message: 'Failed to start Sparrow-WiFi VNC stack',
		error: 'Timeout waiting for VNC and websockify to respond'
	};
}

function successResult(message: string): SparrowVncControlResult {
	return {
		success: true,
		message,
		wsPort: SPARROW_WS_PORT,
		wsPath: WS_PATH
	};
}

/** Start the Sparrow-WiFi VNC stack. Idempotent — returns existing session if running. */
export async function startSparrowVnc(): Promise<SparrowVncControlResult> {
	try {
		registerShutdownHandler();

		if (isStackAlive()) {
			logger.info('[sparrow-vnc] stack already running');
			return successResult('Sparrow-WiFi VNC stack already running');
		}

		await killOrphansByPort();
		await spawnStackProcesses();

		if (!(await waitForStackReady())) return cleanupFailedStart();

		logger.info('[sparrow-vnc] stack ready', { wsPort: SPARROW_WS_PORT });
		return successResult('Sparrow-WiFi VNC stack started');
	} catch (error: unknown) {
		logger.error('[sparrow-vnc] start error', { error: errMsg(error) });
		await killAllProcesses().catch(() => undefined);
		return {
			success: false,
			message: 'Failed to start Sparrow-WiFi VNC stack',
			error: errMsg(error)
		};
	}
}

// ──────────────────────────────── stop ──────────────────────────────────

export async function stopSparrowVnc(): Promise<SparrowVncControlResult> {
	try {
		logger.info('[sparrow-vnc] stopping stack');
		await killAllProcesses();
		await killOrphansByPort();
		logger.info('[sparrow-vnc] stack stopped');
		return { success: true, message: 'Sparrow-WiFi VNC stack stopped' };
	} catch (error: unknown) {
		logger.error('[sparrow-vnc] stop error', { error: errMsg(error) });
		return {
			success: false,
			message: 'Failed to stop Sparrow-WiFi VNC stack',
			error: errMsg(error)
		};
	}
}

// ─────────────────────────────── status ─────────────────────────────────

export function getSparrowVncStatus(): SparrowVncStatusResult {
	const running = isStackAlive();
	return {
		success: true,
		isRunning: running,
		status: running ? 'active' : 'inactive',
		wsPort: SPARROW_WS_PORT,
		wsPath: WS_PATH
	};
}
