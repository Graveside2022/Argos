import { access, constants } from 'fs/promises';
import path from 'path';
import { WebSocket } from 'ws';

import { CLEANUP_TIMEOUT_MS, MAX_BUFFER_BYTES, type PtySession } from './types';

const PROJECT_ROOT = process.cwd();

export const VALID_SHELLS: string[] = [
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-0.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-1.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-2.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-3.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-logs.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-zsh-wrapper.sh')
];

export const sessions = new Map<string, PtySession>();

let ptyModulePromise: Promise<typeof import('node-pty') | null> | null = null;

export function loadPtyModule(): Promise<typeof import('node-pty') | null> {
	if (!ptyModulePromise) {
		ptyModulePromise = import('node-pty')
			.then((m) => {
				console.warn('[argos-terminal] node-pty loaded OK');
				return m;
			})
			.catch(() => {
				console.warn('[argos-terminal] node-pty not available — terminal disabled');
				return null;
			});
	}
	return ptyModulePromise;
}

export function normalizeShellPath(shellPath: string): string {
	let normalized = shellPath;
	if (normalized.startsWith('/app/')) {
		normalized = normalized.replace(/^\/app\//, PROJECT_ROOT + '/');
	}
	if (normalized.endsWith('/scripts/tmux-zsh-wrapper.sh') && !normalized.includes('/tmux/')) {
		normalized = normalized.replace(
			'/scripts/tmux-zsh-wrapper.sh',
			'/scripts/tmux/tmux-zsh-wrapper.sh'
		);
	}
	if (normalized.startsWith('scripts/')) {
		normalized = path.join(PROJECT_ROOT, normalized);
	}
	return normalized;
}

export async function isValidShell(shellPath: string): Promise<boolean> {
	if (!VALID_SHELLS.includes(shellPath)) return false;
	try {
		await access(shellPath, constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

export function sendJson(ws: WebSocket, data: Record<string, unknown>): void {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data));
	}
}

export function destroySession(sessionId: string): void {
	const session = sessions.get(sessionId);
	if (!session) return;
	if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
	try {
		session.pty.kill();
	} catch {
		/* already dead */
	}
	sessions.delete(sessionId);
	console.warn(`[argos-terminal] Session ${sessionId} destroyed`);
}

export function detachSession(sessionId: string): void {
	const session = sessions.get(sessionId);
	if (!session) return;
	session.ws = null;
	console.warn(
		`[argos-terminal] Session ${sessionId} detached, will cleanup in ${CLEANUP_TIMEOUT_MS / 1000}s`
	);
	session.cleanupTimer = setTimeout(() => {
		console.warn(`[argos-terminal] Session ${sessionId} timed out, destroying`);
		destroySession(sessionId);
	}, CLEANUP_TIMEOUT_MS);
}

export function destroyAllSessions(): void {
	for (const id of Array.from(sessions.keys())) destroySession(id);
}

function getDefaultShell(): string {
	return process.env.SHELL || '/bin/bash';
}

async function resolveShell(requestedShell: string): Promise<string> {
	const normalized = normalizeShellPath(requestedShell);
	if (await isValidShell(normalized)) return normalized;
	const fallback = getDefaultShell();
	console.warn(`[argos-terminal] Invalid shell requested: ${requestedShell}, using ${fallback}`);
	return fallback;
}

function buildSpawnEnv(): Record<string, string> {
	const env = { ...process.env };
	delete env['TMUX'];
	delete env['TMUX_PANE'];
	return env as Record<string, string>;
}

type PtyModule = NonNullable<Awaited<ReturnType<typeof loadPtyModule>>>;
type PtyInstance = ReturnType<PtyModule['spawn']>;

function tryCreatePty(
	ptyModule: PtyModule,
	shell: string,
	cols: number,
	rows: number,
	ws: WebSocket | null
): PtyInstance | null {
	try {
		return ptyModule.spawn(shell, [], {
			name: 'xterm-256color',
			cols,
			rows,
			cwd: process.env.HOME || '/home',
			env: buildSpawnEnv()
		});
	} catch (err) {
		console.error(`[argos-terminal] Failed to spawn PTY for ${shell}:`, err);
		if (ws) sendJson(ws, { type: 'exit' });
		return null;
	}
}

function trimBuffer(s: PtySession): void {
	while (s.bufferSize > MAX_BUFFER_BYTES && s.outputBuffer.length > 1) {
		const dropped = s.outputBuffer.shift();
		if (dropped) s.bufferSize -= dropped.length;
	}
}

function bufferOutput(s: PtySession, data: string): void {
	s.outputBuffer.push(data);
	s.bufferSize += data.length;
	trimBuffer(s);
}

function forwardOrBuffer(s: PtySession, data: string): void {
	if (s.ws && s.ws.readyState === WebSocket.OPEN) {
		s.ws.send(data);
		return;
	}
	bufferOutput(s, data);
}

function attachDataHandler(sessionId: string, ptyProcess: PtyInstance): void {
	ptyProcess.onData((data: string) => {
		try {
			const s = sessions.get(sessionId);
			if (s) forwardOrBuffer(s, data);
		} catch (err) {
			console.error(`[argos-terminal] onData error for ${sessionId}:`, err);
		}
	});
}

function attachExitHandler(sessionId: string, ptyProcess: PtyInstance): void {
	ptyProcess.onExit(() => {
		const s = sessions.get(sessionId);
		if (s?.ws && s.ws.readyState === WebSocket.OPEN) {
			sendJson(s.ws, { type: 'exit' });
		}
		sessions.delete(sessionId);
		console.warn(`[argos-terminal] Session ${sessionId} exited`);
	});
}

export async function spawnPty(
	requestedShell: string,
	sessionId: string,
	ws: WebSocket | null,
	cols = 80,
	rows = 24
): Promise<PtySession | null> {
	const ptyModule = await loadPtyModule();
	if (!ptyModule) return null;

	const shell = await resolveShell(requestedShell);
	const ptyProcess = tryCreatePty(ptyModule, shell, cols, rows, ws);
	if (!ptyProcess) return null;

	const session: PtySession = {
		pty: ptyProcess,
		shell,
		ws,
		outputBuffer: [],
		bufferSize: 0,
		cleanupTimer: null,
		cols,
		rows
	};
	sessions.set(sessionId, session);

	attachDataHandler(sessionId, ptyProcess);
	attachExitHandler(sessionId, ptyProcess);

	console.warn(`[argos-terminal] Session ${sessionId} spawned (${shell})`);
	return session;
}

function cancelCleanupTimer(session: PtySession): void {
	if (session.cleanupTimer) {
		clearTimeout(session.cleanupTimer);
		session.cleanupTimer = null;
	}
}

function evictStaleWs(session: PtySession, newWs: WebSocket): void {
	const oldWs = session.ws;
	if (!oldWs || oldWs === newWs) return;
	if (oldWs.readyState === WebSocket.OPEN) {
		sendJson(oldWs, { type: 'detached' });
		oldWs.close();
	}
}

function flushBufferedOutput(session: PtySession, ws: WebSocket): void {
	if (session.outputBuffer.length === 0) return;
	for (const chunk of session.outputBuffer) {
		if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
	}
	session.outputBuffer = [];
	session.bufferSize = 0;
}

export function reattachSession(sessionId: string, session: PtySession, ws: WebSocket): void {
	cancelCleanupTimer(session);
	evictStaleWs(session, ws);
	session.ws = ws;
	sendJson(ws, { type: 'reattached', shell: session.shell, sessionId });
	flushBufferedOutput(session, ws);
	console.warn(`[argos-terminal] Session ${sessionId} reattached`);
}

const PRE_SPAWN_SESSION_ID = 'tmux-0-default';
const PRE_SPAWN_DELAY_MS = 2000;

async function isExecutable(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

async function tryPreSpawn(shellPath: string): Promise<void> {
	if (sessions.has(PRE_SPAWN_SESSION_ID)) {
		console.warn('[argos-terminal] tmux-0 session already exists, skipping pre-spawn');
		return;
	}
	if (!(await isExecutable(shellPath))) {
		console.warn(`[argos-terminal] Pre-spawn skipped: ${shellPath} not executable`);
		return;
	}
	const session = await spawnPty(shellPath, PRE_SPAWN_SESSION_ID, null, 80, 24);
	if (session) {
		console.warn('[argos-terminal] Pre-spawned tmux-0 session (ready for reattach)');
	}
}

export function preSpawnDefaultSession(): Promise<void> {
	const shellPath = path.join(PROJECT_ROOT, 'scripts/tmux/tmux-0.sh');
	return new Promise((resolve) => {
		setTimeout(() => {
			void tryPreSpawn(shellPath).finally(() => resolve());
		}, PRE_SPAWN_DELAY_MS);
	});
}
