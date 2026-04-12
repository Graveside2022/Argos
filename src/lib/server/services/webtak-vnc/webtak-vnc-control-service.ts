/**
 * Public start/stop/status API for the WebTAK VNC stack.
 *
 * Orchestrates the three-process stack (Xtigervnc + chromium + websockify)
 * defined in `webtak-vnc-processes.ts`, adding the operator-facing concerns:
 * idempotent start, URL change detection, orphan cleanup, ready-check polling,
 * and graceful teardown on Argos shutdown.
 *
 * Mirrors the Sightline control service pattern
 * (`src/lib/server/services/sightline/sightline-control-service.ts`).
 *
 * @module
 */

import { errMsg } from '$lib/server/api/error-utils';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import {
	getCurrentUrl,
	isStackAlive,
	killAllProcesses,
	killOrphansByPort,
	purgeChromiumProfile,
	setCurrentUrl,
	spawnChromium,
	spawnWebsockify,
	spawnXtigervnc,
	waitForStackReady
} from './webtak-vnc-processes';
import {
	WEBTAK_WS_PORT,
	type WebtakVncControlResult,
	type WebtakVncStatusResult
} from './webtak-vnc-types';

const WS_PATH = '/websockify';

// ───────────────────── shutdown handler (idempotent) ─────────────────────

let shutdownHandlerRegistered = false;

function registerShutdownHandler(): void {
	if (shutdownHandlerRegistered) return;
	shutdownHandlerRegistered = true;
	const handler = () => {
		logger.info('[webtak-vnc] received shutdown signal, tearing down stack');
		void killAllProcesses();
	};
	process.once('SIGTERM', handler);
	process.once('SIGINT', handler);
	process.once('exit', handler);
}

// ─────────────────────────────── start ──────────────────────────────────

function validateStartUrl(url: string): WebtakVncControlResult | null {
	try {
		const parsed = new URL(url);
		if (!/^https?:$/.test(parsed.protocol)) {
			return {
				success: false,
				message: 'Invalid URL',
				error: 'URL must use http or https'
			};
		}
		return null;
	} catch {
		return {
			success: false,
			message: 'Invalid URL',
			error: 'URL could not be parsed'
		};
	}
}

async function spawnStackProcesses(url: string): Promise<void> {
	logger.info('[webtak-vnc] spawning Xtigervnc');
	spawnXtigervnc();
	await delay(400);

	logger.info('[webtak-vnc] spawning chromium', { url });
	spawnChromium(url);
	await delay(300);

	logger.info('[webtak-vnc] spawning websockify');
	spawnWebsockify();
}

async function cleanupFailedStart(): Promise<WebtakVncControlResult> {
	logger.error('[webtak-vnc] stack failed to become ready within timeout');
	await killAllProcesses();
	await killOrphansByPort();
	return {
		success: false,
		message: 'Failed to start WebTAK VNC stack',
		error: 'Timeout waiting for VNC and websockify to respond'
	};
}

/** Returns a short-circuit result if the existing stack is reusable; else null. */
async function handleExistingStack(url: string): Promise<WebtakVncControlResult | null> {
	if (!isStackAlive()) return null;
	if (getCurrentUrl() === url) {
		logger.info('[webtak-vnc] stack already running for requested URL');
		return successResult(url, 'WebTAK VNC stack already running');
	}
	logger.info('[webtak-vnc] URL changed, restarting stack');
	await stopWebtakVnc();
	return null;
}

function buildStartErrorResult(error: unknown): WebtakVncControlResult {
	return {
		success: false,
		message: 'Failed to start WebTAK VNC stack',
		error: errMsg(error)
	};
}

/**
 * Start the VNC stack pointed at the given TAK server URL.
 *
 * Idempotent: calling with the same URL while running returns the existing
 * WebSocket endpoint; calling with a different URL tears down the existing
 * stack first.
 */
export async function startWebtakVnc(url: string): Promise<WebtakVncControlResult> {
	const urlError = validateStartUrl(url);
	if (urlError) return urlError;

	try {
		registerShutdownHandler();
		const reuse = await handleExistingStack(url);
		if (reuse) return reuse;

		// Kill only ports that belong to us, but leave the profile intact so
		// cookies, session storage, and logged-in WebTAK state persist across
		// restarts. Profile is purged on explicit stop, not on start.
		await killOrphansByPort();
		await spawnStackProcesses(url);

		if (!(await waitForStackReady())) return cleanupFailedStart();

		setCurrentUrl(url);
		logger.info('[webtak-vnc] stack ready', { url, wsPort: WEBTAK_WS_PORT });
		return successResult(url, 'WebTAK VNC stack started');
	} catch (error: unknown) {
		logger.error('[webtak-vnc] start error', { error: errMsg(error) });
		await killAllProcesses().catch(() => undefined);
		return buildStartErrorResult(error);
	}
}

// ──────────────────────────────── stop ──────────────────────────────────

export async function stopWebtakVnc(): Promise<WebtakVncControlResult> {
	try {
		logger.info('[webtak-vnc] stopping stack');
		await killAllProcesses();
		await killOrphansByPort();
		// Discard the Chromium profile on explicit stop so the next start
		// begins from a clean slate (and releases ~100 MB of disk cache).
		await purgeChromiumProfile();
		setCurrentUrl(null);
		logger.info('[webtak-vnc] stack stopped');
		return {
			success: true,
			message: 'WebTAK VNC stack stopped',
			currentUrl: null
		};
	} catch (error: unknown) {
		logger.error('[webtak-vnc] stop error', { error: errMsg(error) });
		return {
			success: false,
			message: 'Failed to stop WebTAK VNC stack',
			error: errMsg(error)
		};
	}
}

// ─────────────────────────────── status ─────────────────────────────────

export function getWebtakVncStatus(): WebtakVncStatusResult {
	const running = isStackAlive();
	return {
		success: true,
		isRunning: running,
		status: running ? 'active' : 'inactive',
		wsPort: WEBTAK_WS_PORT,
		wsPath: WS_PATH,
		currentUrl: getCurrentUrl()
	};
}

// ─────────────────────────────── helpers ────────────────────────────────

function successResult(url: string, message: string): WebtakVncControlResult {
	return {
		success: true,
		message,
		wsPort: WEBTAK_WS_PORT,
		wsPath: WS_PATH,
		currentUrl: url
	};
}
