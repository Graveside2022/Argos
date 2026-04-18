import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocket, WebSocketServer } from 'ws';

import { detachSession, reattachSession, sendJson, sessions, spawnPty } from './session';
import { INIT_TIMEOUT_MS, TERMINAL_WS_PATH } from './types';

interface ConnectionState {
	defaultShell: string;
	boundSessionId: string | null;
	initialized: boolean;
	initTimeout: ReturnType<typeof setTimeout> | null;
	ws: WebSocket;
}

interface ParsedMessage {
	type?: string;
	sessionId?: string;
	shell?: string;
	cols?: number;
	rows?: number;
	data?: string;
}

let wssSingleton: WebSocketServer | null = null;

function newId(): string {
	return Math.random().toString(36).substring(2, 9);
}

function isPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function clearInitTimeout(state: ConnectionState): void {
	if (state.initTimeout) {
		clearTimeout(state.initTimeout);
		state.initTimeout = null;
	}
}

async function spawnNewSession(
	state: ConnectionState,
	sessionId: string,
	shell: string
): Promise<void> {
	const s = await spawnPty(shell, sessionId, state.ws);
	if (!s) return;
	state.boundSessionId = sessionId;
	state.initialized = true;
	sendJson(state.ws, { type: 'ready', shell: s.shell, sessionId });
}

async function fallbackSpawn(state: ConnectionState, shell: string): Promise<string> {
	const id = newId();
	await spawnNewSession(state, id, shell);
	return id;
}

async function attachToExisting(
	state: ConnectionState,
	sessionId: string,
	shellPref: string
): Promise<void> {
	const existing = sessions.get(sessionId);
	if (existing && isPidAlive(existing.pty.pid)) {
		reattachSession(sessionId, existing, state.ws);
		state.boundSessionId = sessionId;
		state.initialized = true;
		return;
	}
	if (existing) sessions.delete(sessionId);
	await spawnNewSession(state, sessionId, shellPref);
}

async function handleInit(state: ConnectionState, parsed: ParsedMessage): Promise<void> {
	if (state.initialized) return;
	clearInitTimeout(state);
	const sessionId = parsed.sessionId ?? newId();
	const shellPref = parsed.shell ?? state.defaultShell;
	await attachToExisting(state, sessionId, shellPref);
}

function handleListSessions(state: ConnectionState): void {
	const sessionList = Array.from(sessions.entries()).map(([id, s]) => ({
		id,
		shell: s.shell,
		alive: isPidAlive(s.pty.pid)
	}));
	sendJson(state.ws, { type: 'sessions', sessions: sessionList });
}

function handleResize(state: ConnectionState, parsed: ParsedMessage): void {
	if (!state.boundSessionId || !parsed.cols || !parsed.rows) return;
	const session = sessions.get(state.boundSessionId);
	if (!session) return;
	const cols = Math.max(1, Math.floor(parsed.cols));
	const rows = Math.max(1, Math.floor(parsed.rows));
	session.pty.resize(cols, rows);
	session.cols = cols;
	session.rows = rows;
}

function handleInput(state: ConnectionState, parsed: ParsedMessage): void {
	if (!state.boundSessionId || typeof parsed.data !== 'string') return;
	const session = sessions.get(state.boundSessionId);
	if (session) session.pty.write(parsed.data);
}

async function handleParseError(state: ConnectionState, raw: string): Promise<void> {
	if (state.boundSessionId) {
		const session = sessions.get(state.boundSessionId);
		if (session) session.pty.write(raw);
		return;
	}
	if (state.initialized) return;
	clearInitTimeout(state);
	const id = await fallbackSpawn(state, state.defaultShell);
	const session = sessions.get(id);
	if (session) session.pty.write(raw);
}

const messageHandlers: Record<
	string,
	(state: ConnectionState, parsed: ParsedMessage) => void | Promise<void>
> = {
	init: handleInit,
	'list-sessions': (state) => handleListSessions(state),
	resize: handleResize,
	input: handleInput
};

async function dispatchMessage(state: ConnectionState, raw: string): Promise<void> {
	let parsed: ParsedMessage;
	try {
		parsed = JSON.parse(raw) as ParsedMessage;
	} catch {
		await handleParseError(state, raw);
		return;
	}
	const handler = parsed.type ? messageHandlers[parsed.type] : undefined;
	if (handler) await handler(state, parsed);
}

function attachMessageHandlers(ws: WebSocket): void {
	const state: ConnectionState = {
		defaultShell: process.env.SHELL || '/bin/bash',
		boundSessionId: null,
		initialized: false,
		initTimeout: null,
		ws
	};

	state.initTimeout = setTimeout(() => {
		if (state.initialized) return;
		console.warn('[argos-terminal] No init message received, spawning with default shell');
		void fallbackSpawn(state, state.defaultShell);
	}, INIT_TIMEOUT_MS);

	ws.on('message', (msg: Buffer | string) => {
		void dispatchMessage(state, typeof msg === 'string' ? msg : msg.toString());
	});
	ws.on('close', () => {
		clearInitTimeout(state);
		if (state.boundSessionId) detachSession(state.boundSessionId);
	});
	ws.on('error', (err: Error) => {
		console.error('[argos-terminal] WebSocket error:', err.message);
		if (state.boundSessionId) detachSession(state.boundSessionId);
	});
}

function registerWssShutdown(): void {
	for (const sig of ['exit', 'SIGTERM', 'SIGINT'] as const) {
		process.on(sig, () => {
			try {
				wssSingleton?.close();
			} catch {
				/* already closed */
			}
		});
	}
}

function getWss(): WebSocketServer {
	if (wssSingleton) return wssSingleton;
	wssSingleton = new WebSocketServer({ noServer: true, maxPayload: 262144 });
	wssSingleton.on('connection', attachMessageHandlers);
	registerWssShutdown();
	return wssSingleton;
}

export function handleTerminalUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
	const url = new URL(req.url || '/', `http://${req.headers.host ?? 'localhost'}`);
	if (url.pathname !== TERMINAL_WS_PATH) return false;
	const wss = getWss();
	wss.handleUpgrade(req, socket, head, (ws) => {
		wss.emit('connection', ws, req);
	});
	return true;
}
