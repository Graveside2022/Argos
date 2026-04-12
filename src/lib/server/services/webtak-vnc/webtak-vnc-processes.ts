/**
 * Low-level process helpers for the WebTAK VNC stack.
 *
 * Owns module-scoped `ChildProcess | null` refs for the three processes that
 * make up a single WebTAK session: `Xtigervnc` (virtual display + VNC server),
 * `chromium` (the browser pointing at the TAK URL), and `websockify` (the
 * VNC-to-WebSocket proxy the frontend connects to).
 *
 * Functions in this module are intentionally small and side-effectful. They
 * are composed by `webtak-vnc-control-service.ts`, which provides the
 * user-facing start/stop orchestration with retries, error reporting, and
 * state transitions.
 *
 * @module
 */

import { type ChildProcess, spawn } from 'child_process';
import { connect as netConnect } from 'net';

import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import {
	CHROMIUM_USER_DATA_DIR,
	WEBTAK_DEPTH,
	WEBTAK_GEOMETRY,
	WEBTAK_VNC_DISPLAY,
	WEBTAK_VNC_PORT,
	WEBTAK_WS_PORT
} from './webtak-vnc-types';

// ───────────────────────────── module state ──────────────────────────────

let xvncProcess: ChildProcess | null = null;
let chromiumProcess: ChildProcess | null = null;
let websockifyProcess: ChildProcess | null = null;
let currentUrl: string | null = null;

// ─────────────────────────────── spawn ──────────────────────────────────

/** Spawn Xtigervnc as a combined X server + VNC server on `:99`. */
export function spawnXtigervnc(): void {
	xvncProcess = spawn(
		'/usr/bin/Xtigervnc',
		[
			WEBTAK_VNC_DISPLAY,
			'-geometry',
			WEBTAK_GEOMETRY,
			'-depth',
			String(WEBTAK_DEPTH),
			'-SecurityTypes',
			'None',
			'-localhost',
			'-rfbport',
			String(WEBTAK_VNC_PORT),
			'-AlwaysShared'
		],
		{ stdio: 'ignore', detached: true }
	);
	xvncProcess.unref();
	xvncProcess.on('exit', (code, signal) => {
		logger.info('[webtak-vnc] Xtigervnc exited', { code, signal });
		xvncProcess = null;
	});
	xvncProcess.on('error', (err) => {
		logger.error('[webtak-vnc] Xtigervnc error', { error: err.message });
		xvncProcess = null;
	});
}

/** Spawn a Chromium instance rendering into the Xtigervnc display. */
export function spawnChromium(url: string): void {
	const flags = [
		'--no-sandbox',
		'--no-first-run',
		'--no-default-browser-check',
		'--disable-features=Translate',
		'--ignore-certificate-errors',
		'--test-type',
		'--disable-dev-shm-usage',
		'--disable-extensions',
		`--window-size=${WEBTAK_GEOMETRY.replace('x', ',')}`,
		'--window-position=0,0',
		`--user-data-dir=${CHROMIUM_USER_DATA_DIR}`,
		url
	];
	chromiumProcess = spawn('/usr/bin/chromium', flags, {
		env: { ...process.env, DISPLAY: WEBTAK_VNC_DISPLAY },
		stdio: 'ignore',
		detached: true
	});
	chromiumProcess.unref();
	chromiumProcess.on('exit', (code, signal) => {
		logger.info('[webtak-vnc] chromium exited', { code, signal });
		chromiumProcess = null;
	});
	chromiumProcess.on('error', (err) => {
		logger.error('[webtak-vnc] chromium error', { error: err.message });
		chromiumProcess = null;
	});
}

/** Spawn websockify to bridge the VNC port to a WebSocket. */
export function spawnWebsockify(): void {
	websockifyProcess = spawn(
		'/usr/bin/websockify',
		[String(WEBTAK_WS_PORT), `localhost:${WEBTAK_VNC_PORT}`],
		{ stdio: 'ignore', detached: true }
	);
	websockifyProcess.unref();
	websockifyProcess.on('exit', (code, signal) => {
		logger.info('[webtak-vnc] websockify exited', { code, signal });
		websockifyProcess = null;
	});
	websockifyProcess.on('error', (err) => {
		logger.error('[webtak-vnc] websockify error', { error: err.message });
		websockifyProcess = null;
	});
}

// ─────────────────────────────── health ─────────────────────────────────

/** Probe whether the VNC TCP port is accepting connections. */
export function isVncPortOpen(): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = netConnect({ host: 'localhost', port: WEBTAK_VNC_PORT });
		const done = (ok: boolean) => {
			socket.destroy();
			resolve(ok);
		};
		socket.setTimeout(1000);
		socket.once('connect', () => done(true));
		socket.once('error', () => done(false));
		socket.once('timeout', () => done(false));
	});
}

/** Probe whether websockify is responding (any HTTP response is proof of life). */
export async function isWebsockifyResponding(): Promise<boolean> {
	try {
		const res = await fetch(`http://localhost:${WEBTAK_WS_PORT}/`, {
			method: 'HEAD',
			signal: AbortSignal.timeout(1000)
		});
		// websockify returns 405 for a HEAD request — any response means alive.
		return res.status > 0;
	} catch {
		return false;
	}
}

/** Poll every 200ms for up to maxAttempts × 200ms until both services are alive. */
export async function waitForStackReady(maxAttempts = 20): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		const [vncOk, wsOk] = await Promise.all([isVncPortOpen(), isWebsockifyResponding()]);
		if (vncOk && wsOk) return true;
		await delay(200);
	}
	return false;
}

// ─────────────────────────────── cleanup ────────────────────────────────

/** Send a signal to the whole process group, falling back to the direct child. */
function sendSignal(ref: ChildProcess, signal: NodeJS.Signals): void {
	const pid = ref.pid;
	if (pid == null) return;
	try {
		process.kill(-pid, signal);
	} catch {
		try {
			ref.kill(signal);
		} catch {
			/* already dead */
		}
	}
}

/** Send SIGTERM, wait 500ms, then SIGKILL any surviving process. */
export async function killProcess(ref: ChildProcess | null, name: string): Promise<void> {
	if (!ref || ref.pid == null || ref.killed) return;
	sendSignal(ref, 'SIGTERM');
	await delay(500);
	if (!ref.killed) sendSignal(ref, 'SIGKILL');
	logger.info('[webtak-vnc] killed process', { name });
}

/** Non-fatal fuser-kill of anything bound to the VNC or WebSocket ports. */
export async function killOrphansByPort(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/fuser', [
			'-k',
			`${WEBTAK_VNC_PORT}/tcp`,
			`${WEBTAK_WS_PORT}/tcp`
		]);
	} catch {
		/* fuser exits non-zero when nothing to kill — that's fine */
	}
}

/** Remove the scratch Chromium profile to avoid "profile already in use" errors. */
export async function purgeChromiumProfile(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/rm', ['-rf', CHROMIUM_USER_DATA_DIR]);
	} catch (err) {
		logger.warn('[webtak-vnc] profile purge failed', {
			error: err instanceof Error ? err.message : String(err)
		});
	}
}

/** Tear down all three processes in reverse spawn order. */
export async function killAllProcesses(): Promise<void> {
	await killProcess(websockifyProcess, 'websockify');
	websockifyProcess = null;
	await killProcess(chromiumProcess, 'chromium');
	chromiumProcess = null;
	await killProcess(xvncProcess, 'Xtigervnc');
	xvncProcess = null;
}

// ─────────────────────────────── state ──────────────────────────────────

export function isStackAlive(): boolean {
	return xvncProcess !== null && chromiumProcess !== null && websockifyProcess !== null;
}

export function getCurrentUrl(): string | null {
	return currentUrl;
}

export function setCurrentUrl(url: string | null): void {
	currentUrl = url;
}
