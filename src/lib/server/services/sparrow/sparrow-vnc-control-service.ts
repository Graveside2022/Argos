/**
 * Public start/stop/status API for the Sparrow-WiFi VNC stack.
 *
 * Orchestrates Xtigervnc + sparrow-wifi.py + websockify to stream
 * the full PyQt5 GUI into the Argos dashboard via noVNC.
 *
 * Simpler than WebTAK: no URL management, no Chromium profile cleanup.
 */

import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import {
	centerSparrowWindow,
	isStackAlive,
	isStackAliveByPort,
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
const SPARROW_OWNER = 'sparrow-wifi';

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

/**
 * Free any competing SDR hold before sparrow starts. B205 in particular
 * shares PSU headroom with Alfa/HackRF — concurrent heavy scans brown-out
 * the Pi 5. Force-release stops wardragon-fpv-detect + kills uhd procs.
 */
async function freeCompetingHardware(): Promise<void> {
	const b205Owner = resourceManager.getOwner(HardwareDevice.B205);
	if (b205Owner && b205Owner !== SPARROW_OWNER) {
		logger.info('[sparrow-vnc] B205 held by competitor, force-releasing', {
			owner: b205Owner
		});
		await resourceManager.forceRelease(HardwareDevice.B205);
	}
}

/**
 * Release wlan1 from any tool that holds it in monitor mode. droneid-go
 * (via zmq-decoder.service) pins wlan1 to monitor for RemoteID capture,
 * which forces `iw scan` to fail with Error 161 (-95 EOPNOTSUPP). Stop
 * the service AND reap any orphan process with the same binary.
 */
async function releaseAlfaHolders(): Promise<void> {
	try {
		await execFileAsync(
			'/usr/bin/sudo',
			['-n', '/usr/bin/systemctl', 'stop', 'zmq-decoder.service'],
			{ timeout: 5000 }
		);
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[sparrow-vnc] zmq-decoder stop failed (may already be inactive)', {
			error: msg
		});
	}
	try {
		await execFileAsync(
			'/usr/bin/sudo',
			['-n', '/usr/bin/pkill', '-f', '/opt/droneid-go/droneid'],
			{ timeout: 3000 }
		);
	} catch {
		/* pkill exits non-zero when no match */
	}
	await delay(500);
}

/**
 * Ensure wlan1 is in managed mode before sparrow starts. If a prior tool
 * (droneid, kismet, airodump, btle_rx) left it in monitor mode, sparrow's
 * internal `iw dev wlan1 scan` call returns Error 161 (-95 EOPNOTSUPP) —
 * scan is not supported on monitor-type interfaces.
 */
async function resetAlfaToManaged(): Promise<void> {
	const iface = 'wlan1';
	try {
		await execFileAsync('/usr/bin/sudo', ['-n', '/usr/sbin/ip', 'link', 'set', iface, 'down'], {
			timeout: 4000
		});
		await execFileAsync(
			'/usr/bin/sudo',
			['-n', '/usr/sbin/iw', 'dev', iface, 'set', 'type', 'managed'],
			{ timeout: 4000 }
		);
		await execFileAsync('/usr/bin/sudo', ['-n', '/usr/sbin/ip', 'link', 'set', iface, 'up'], {
			timeout: 4000
		});
		await delay(2000);
		logger.info('[sparrow-vnc] wlan1 reset to managed');
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[sparrow-vnc] could not reset wlan1 to managed', { error: msg });
	}
}

async function releaseAlfa(): Promise<void> {
	await resourceManager.release(SPARROW_OWNER, HardwareDevice.ALFA).catch(() => undefined);
}

async function claimAlfa(): Promise<SparrowVncControlResult | null> {
	const claim = await resourceManager.acquire(SPARROW_OWNER, HardwareDevice.ALFA);
	if (claim.success) return null;
	logger.warn('[sparrow-vnc] ALFA (wlan1) unavailable', { owner: claim.owner });
	return {
		success: false,
		message: `wlan1 is in use by ${claim.owner ?? 'another tool'}`,
		error: `alfa-locked-by:${claim.owner ?? 'unknown'}`
	};
}

async function prepareHardwareAndSpawn(): Promise<void> {
	await freeCompetingHardware();
	await releaseAlfaHolders();
	await resetAlfaToManaged();
	await killOrphansByPort();
	await spawnStackProcesses();
}

async function runStartPipeline(): Promise<SparrowVncControlResult> {
	await prepareHardwareAndSpawn();
	if (!(await waitForStackReady())) {
		await releaseAlfa();
		return cleanupFailedStart();
	}
	logger.info('[sparrow-vnc] stack ready', { wsPort: SPARROW_WS_PORT });
	return successResult('Sparrow-WiFi VNC stack started');
}

async function handleStartError(error: unknown): Promise<SparrowVncControlResult> {
	logger.error('[sparrow-vnc] start error', { error: errMsg(error) });
	await killAllProcesses().catch(() => undefined);
	await releaseAlfa();
	return {
		success: false,
		message: 'Failed to start Sparrow-WiFi VNC stack',
		error: errMsg(error)
	};
}

/** Start the Sparrow-WiFi VNC stack. Idempotent — returns existing session if running. */
export async function startSparrowVnc(): Promise<SparrowVncControlResult> {
	registerShutdownHandler();
	if (isStackAlive()) {
		logger.info('[sparrow-vnc] stack already running');
		return successResult('Sparrow-WiFi VNC stack already running');
	}
	const rejection = await claimAlfa();
	if (rejection) return rejection;
	try {
		return await runStartPipeline();
	} catch (error: unknown) {
		return handleStartError(error);
	}
}

// ──────────────────────────────── stop ──────────────────────────────────

export async function stopSparrowVnc(): Promise<SparrowVncControlResult> {
	try {
		logger.info('[sparrow-vnc] stopping stack');
		await killAllProcesses();
		await killOrphansByPort();
		await releaseAlfa();
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

export async function getSparrowVncStatus(): Promise<SparrowVncStatusResult> {
	const running = isStackAlive() || (await isStackAliveByPort());
	return {
		success: true,
		isRunning: running,
		status: running ? 'active' : 'inactive',
		wsPort: SPARROW_WS_PORT,
		wsPath: WS_PATH
	};
}
