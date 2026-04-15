/**
 * Low-level process helpers for the SDR++ VNC stack.
 *
 * Three-process stack: Xtigervnc (virtual display), SDR++ (C++ GUI),
 * and websockify (VNC-to-WebSocket bridge for noVNC).
 *
 * Modeled on sparrow-vnc-processes.ts but adapted for SDR++:
 * no sudo needed (SDR++ uses libusb for HackRF), wider geometry,
 * and longer init delay for the heavier C++ application.
 */

import { type ChildProcess, spawn } from 'child_process';
import { connect as netConnect } from 'net';

import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import {
	SDRPP_DEPTH,
	SDRPP_GEOMETRY,
	SDRPP_GUI_PATH,
	SDRPP_ROOT_DIR,
	SDRPP_VNC_DISPLAY,
	SDRPP_VNC_PORT,
	SDRPP_WS_PORT
} from './sdrpp-vnc-types';

// ───────────────────────────── module state ──────────────────────────────

let xvncProcess: ChildProcess | null = null;
let sdrppProcess: ChildProcess | null = null;
let websockifyProcess: ChildProcess | null = null;

// ─────────────────────────────── spawn ──────────────────────────────────

/** Spawn Xtigervnc as a combined X server + VNC server on `:97`. */
export function spawnXtigervnc(): void {
	xvncProcess = spawn(
		'/usr/bin/Xtigervnc',
		[
			SDRPP_VNC_DISPLAY,
			'-geometry',
			SDRPP_GEOMETRY,
			'-depth',
			String(SDRPP_DEPTH),
			'-SecurityTypes',
			'None',
			'-localhost',
			'-rfbport',
			String(SDRPP_VNC_PORT),
			'-AlwaysShared'
		],
		{ stdio: 'ignore', detached: true }
	);
	xvncProcess.unref();
	xvncProcess.on('exit', (code, signal) => {
		logger.info('[sdrpp-vnc] Xtigervnc exited', { code, signal });
		xvncProcess = null;
	});
	xvncProcess.on('error', (err) => {
		logger.error('[sdrpp-vnc] Xtigervnc error', { error: err.message });
		xvncProcess = null;
	});
}

/** Set X11 background to match Lunaris dark theme (#111111). */
export function setVncBackground(): void {
	const bg = spawn('/usr/bin/xsetroot', ['-solid', '#111111'], {
		env: { ...process.env, DISPLAY: SDRPP_VNC_DISPLAY },
		stdio: 'ignore'
	});
	bg.unref();
}

/** Center the SDR++ window within the VNC framebuffer. */
export function centerSdrppWindow(): void {
	const script = `
		WID=$(xdotool search --name "SDR++" 2>/dev/null | head -1)
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
		env: { ...process.env, DISPLAY: SDRPP_VNC_DISPLAY },
		stdio: 'ignore'
	});
	proc.unref();
}

/** Spawn the SDR++ GUI rendering into the Xtigervnc display.
 *  No sudo needed — SDR++ uses libusb for HackRF access. */
export function spawnSdrppGui(): void {
	sdrppProcess = spawn(SDRPP_GUI_PATH, ['-r', SDRPP_ROOT_DIR], {
		env: {
			...process.env,
			DISPLAY: SDRPP_VNC_DISPLAY,
			PULSE_SERVER: 'unix:/run/user/1000/pulse/native'
		},
		cwd: '/opt/sdrpp',
		stdio: 'ignore',
		detached: true
	});
	sdrppProcess.unref();
	sdrppProcess.on('exit', (code, signal) => {
		logger.info('[sdrpp-vnc] sdrpp exited', { code, signal });
		sdrppProcess = null;
	});
	sdrppProcess.on('error', (err) => {
		logger.error('[sdrpp-vnc] sdrpp error', { error: err.message });
		sdrppProcess = null;
	});
}

/** Spawn websockify to bridge the VNC port to a WebSocket. */
export function spawnWebsockify(): void {
	websockifyProcess = spawn(
		'/usr/bin/websockify',
		[String(SDRPP_WS_PORT), `localhost:${SDRPP_VNC_PORT}`],
		{ stdio: 'ignore', detached: true }
	);
	websockifyProcess.unref();
	websockifyProcess.on('exit', (code, signal) => {
		logger.info('[sdrpp-vnc] websockify exited', { code, signal });
		websockifyProcess = null;
	});
	websockifyProcess.on('error', (err) => {
		logger.error('[sdrpp-vnc] websockify error', { error: err.message });
		websockifyProcess = null;
	});
}

// ─────────────────────────────── health ─────────────────────────────────

/** Probe whether the VNC TCP port is accepting connections. */
export function isVncPortOpen(): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = netConnect({ host: 'localhost', port: SDRPP_VNC_PORT });
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
		const res = await fetch(`http://localhost:${SDRPP_WS_PORT}/`, {
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
	logger.info('[sdrpp-vnc] killed process', { name });
}

/** Non-fatal fuser-kill of anything bound to the VNC or WebSocket ports. */
export async function killOrphansByPort(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/fuser', [
			'-k',
			`${SDRPP_VNC_PORT}/tcp`,
			`${SDRPP_WS_PORT}/tcp`
		]);
	} catch {
		/* fuser exits non-zero when nothing to kill */
	}
}

/** Tear down all three processes in reverse spawn order. */
export async function killAllProcesses(): Promise<void> {
	await killProcess(websockifyProcess, 'websockify');
	websockifyProcess = null;
	await killProcess(sdrppProcess, 'sdrpp');
	sdrppProcess = null;
	await killProcess(xvncProcess, 'Xtigervnc');
	xvncProcess = null;
}

/** Check whether all three managed processes are still alive. */
export function isStackAlive(): boolean {
	return xvncProcess !== null && sdrppProcess !== null && websockifyProcess !== null;
}
