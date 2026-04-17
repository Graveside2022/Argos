/**
 * Low-level process helpers for the Sparrow-WiFi VNC stack.
 *
 * Three-process stack: Xtigervnc (virtual display), sparrow-wifi.py (PyQt5 GUI),
 * and websockify (VNC-to-WebSocket bridge for noVNC).
 *
 * Modeled on webtak-vnc-processes.ts but simplified: no Chromium profile
 * management and no URL parameter (Sparrow GUI is self-contained).
 */

import { type ChildProcess, spawn } from 'child_process';
import { mkdirSync } from 'fs';
import { connect as netConnect } from 'net';

import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import {
	SPARROW_DEPTH,
	SPARROW_GEOMETRY,
	SPARROW_GUI_PATH,
	SPARROW_VNC_DISPLAY,
	SPARROW_VNC_PORT,
	SPARROW_WS_PORT
} from './sparrow-vnc-types';

// ───────────────────────────── module state ──────────────────────────────

let xvncProcess: ChildProcess | null = null;
let sparrowProcess: ChildProcess | null = null;
let websockifyProcess: ChildProcess | null = null;

// ─────────────────────────────── spawn ──────────────────────────────────

/** Spawn Xtigervnc as a combined X server + VNC server on `:98`. */
export function spawnXtigervnc(): void {
	xvncProcess = spawn(
		'/usr/bin/Xtigervnc',
		[
			SPARROW_VNC_DISPLAY,
			'-geometry',
			SPARROW_GEOMETRY,
			'-depth',
			String(SPARROW_DEPTH),
			'-SecurityTypes',
			'None',
			'-localhost',
			'-rfbport',
			String(SPARROW_VNC_PORT),
			'-AlwaysShared'
		],
		{ stdio: 'ignore', detached: true }
	);
	xvncProcess.unref();
	xvncProcess.on('exit', (code, signal) => {
		logger.info('[sparrow-vnc] Xtigervnc exited', { code, signal });
		xvncProcess = null;
	});
	xvncProcess.on('error', (err) => {
		logger.error('[sparrow-vnc] Xtigervnc error', { error: err.message });
		xvncProcess = null;
	});
}

/** Set X11 background to match Lunaris dark theme (#111111). */
export function setVncBackground(): void {
	const bg = spawn('/usr/bin/xsetroot', ['-solid', '#111111'], {
		env: { ...process.env, DISPLAY: SPARROW_VNC_DISPLAY },
		stdio: 'ignore'
	});
	bg.unref();
}

/** Center the Sparrow GUI window within the VNC framebuffer. */
export function centerSparrowWindow(): void {
	const script = `
		WID=$(xdotool search --name "sparrow" 2>/dev/null | head -1)
		if [ -n "$WID" ]; then
			eval $(xdotool getwindowgeometry --shell "$WID")
			SCREEN_W=$(xdpyinfo | grep dimensions | awk '{print $2}' | cut -dx -f1)
			SCREEN_H=$(xdpyinfo | grep dimensions | awk '{print $2}' | cut -dx -f2)
			X=$(( (SCREEN_W - WIDTH) / 2 ))
			Y=$(( (SCREEN_H - HEIGHT) / 2 ))
			xdotool windowmove "$WID" "$X" "$Y"
		fi
	`;
	const proc = spawn('/bin/bash', ['-c', script], {
		env: { ...process.env, DISPLAY: SPARROW_VNC_DISPLAY },
		stdio: 'ignore'
	});
	proc.unref();
}

function ensureXdgRuntimeDir(): string {
	const runtimeDir = process.env.XDG_RUNTIME_DIR ?? '/tmp/sparrow-runtime';
	try {
		mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
	} catch (err) {
		logger.warn('[sparrow-vnc] could not create XDG_RUNTIME_DIR', {
			path: runtimeDir,
			error: err instanceof Error ? err.message : String(err)
		});
	}
	return runtimeDir;
}

/** Spawn the Sparrow-WiFi PyQt5 GUI rendering into the Xtigervnc display.
 *  Runs via sudo because iw scan requires root privileges.
 *  stdout/stderr piped to logger so errors like "Error 161" surface in argos logs. */
export function spawnSparrowGui(): void {
	const runtimeDir = ensureXdgRuntimeDir();
	sparrowProcess = spawn('/usr/bin/sudo', ['-E', '/usr/bin/python3', SPARROW_GUI_PATH], {
		env: {
			...process.env,
			DISPLAY: SPARROW_VNC_DISPLAY,
			XDG_RUNTIME_DIR: runtimeDir,
			QT_QPA_PLATFORM: 'xcb'
		},
		cwd: '/opt/sparrow-wifi',
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: true
	});
	sparrowProcess.unref();
	sparrowProcess.stdout?.on('data', (buf: Buffer) => {
		const line = buf.toString('utf-8').trimEnd();
		if (line) logger.info('[sparrow-gui] ' + line);
	});
	sparrowProcess.stderr?.on('data', (buf: Buffer) => {
		const line = buf.toString('utf-8').trimEnd();
		if (line) logger.warn('[sparrow-gui] ' + line);
	});
	sparrowProcess.on('exit', (code, signal) => {
		logger.info('[sparrow-vnc] sparrow-wifi.py exited', { code, signal });
		sparrowProcess = null;
	});
	sparrowProcess.on('error', (err) => {
		logger.error('[sparrow-vnc] sparrow-wifi.py error', { error: err.message });
		sparrowProcess = null;
	});
}

/** Spawn websockify to bridge the VNC port to a WebSocket. */
export function spawnWebsockify(): void {
	websockifyProcess = spawn(
		'/usr/bin/websockify',
		[String(SPARROW_WS_PORT), `localhost:${SPARROW_VNC_PORT}`],
		{ stdio: 'ignore', detached: true }
	);
	websockifyProcess.unref();
	websockifyProcess.on('exit', (code, signal) => {
		logger.info('[sparrow-vnc] websockify exited', { code, signal });
		websockifyProcess = null;
	});
	websockifyProcess.on('error', (err) => {
		logger.error('[sparrow-vnc] websockify error', { error: err.message });
		websockifyProcess = null;
	});
}

// ─────────────────────────────── health ─────────────────────────────────

/** Probe whether the VNC TCP port is accepting connections. */
export function isVncPortOpen(): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = netConnect({ host: 'localhost', port: SPARROW_VNC_PORT });
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

/** Probe whether websockify is responding. */
export async function isWebsockifyResponding(): Promise<boolean> {
	try {
		const res = await fetch(`http://localhost:${SPARROW_WS_PORT}/`, {
			method: 'HEAD',
			signal: AbortSignal.timeout(1000)
		});
		return res.status > 0;
	} catch {
		return false;
	}
}

/** Poll until both VNC and websockify are alive. */
export async function waitForStackReady(maxAttempts = 25): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		const [vncOk, wsOk] = await Promise.all([isVncPortOpen(), isWebsockifyResponding()]);
		if (vncOk && wsOk) return true;
		await delay(200);
	}
	return false;
}

// ─────────────────────────────── cleanup ────────────────────────────────

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
	logger.info('[sparrow-vnc] killed process', { name });
}

/** Non-fatal fuser-kill of anything bound to the VNC or WebSocket ports. */
export async function killOrphansByPort(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/fuser', [
			'-k',
			`${SPARROW_VNC_PORT}/tcp`,
			`${SPARROW_WS_PORT}/tcp`
		]);
	} catch {
		/* fuser exits non-zero when nothing to kill */
	}
}

/** Tear down all three processes in reverse spawn order. */
export async function killAllProcesses(): Promise<void> {
	await killProcess(websockifyProcess, 'websockify');
	websockifyProcess = null;
	await killProcess(sparrowProcess, 'sparrow-wifi.py');
	sparrowProcess = null;
	await killProcess(xvncProcess, 'Xtigervnc');
	xvncProcess = null;
}

// ─────────────────────────────── state ──────────────────────────────────

export function isStackAlive(): boolean {
	// In-memory refs reset on dev server reload but detached child procs survive.
	// Fall back to tracked refs OR live TCP ports so UI doesn't show "unavailable"
	// across a hot-restart.
	if (xvncProcess !== null && sparrowProcess !== null && websockifyProcess !== null) return true;
	return false;
}

/** True when VNC + websockify TCP ports are live, even across dev server restarts. */
export async function isStackAliveByPort(): Promise<boolean> {
	const [vncOk, wsOk] = await Promise.all([isVncPortOpen(), isWebsockifyResponding()]);
	return vncOk && wsOk;
}
