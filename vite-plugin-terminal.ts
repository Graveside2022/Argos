import type { Plugin, ViteDevServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { access, constants } from 'fs/promises';

const TERMINAL_PORT = 3001;
const INIT_TIMEOUT_MS = 5000; // Wait max 5s for init message
const CLEANUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes before killing orphaned PTY
const MAX_BUFFER_BYTES = 100 * 1024; // 100KB output buffer while detached

// Valid shell paths
const VALID_SHELLS = [
	'/bin/bash',
	'/bin/zsh',
	'/bin/sh',
	'/usr/bin/bash',
	'/usr/bin/zsh',
	'/usr/bin/fish',
	'/bin/fish',
	// Docker + tmux persistent terminal
	'/home/kali/Documents/Argos/Argos/scripts/docker-claude-terminal.sh'
];

/** Persistent PTY session that survives WebSocket disconnections */
interface PtySession {
	pty: ReturnType<typeof import('node-pty').spawn>;
	shell: string;
	ws: WebSocket | null; // null when detached
	outputBuffer: string[]; // buffered output while detached
	bufferSize: number; // track byte size of buffer
	cleanupTimer: ReturnType<typeof setTimeout> | null; // kill after timeout with no connection
	cols: number;
	rows: number;
}

/** Session registry — PTYs persist across WebSocket reconnections */
const sessions = new Map<string, PtySession>();

export function terminalPlugin(): Plugin {
	return {
		name: 'argos-terminal',
		configureServer(_server: ViteDevServer) {
			console.warn('[argos-terminal] Plugin hook called');
			// Don't return the promise — fire-and-forget so we don't block Vite
			setupTerminal().catch((err) => {
				console.error('[argos-terminal] Setup failed:', err);
			});
		}
	};
}

/**
 * Check if a shell path is valid and executable
 */
async function isValidShell(shellPath: string): Promise<boolean> {
	// Must be in allowed list (security)
	if (!VALID_SHELLS.includes(shellPath)) {
		return false;
	}

	try {
		await access(shellPath, constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Send a JSON message to the WebSocket
 */
function sendJson(ws: WebSocket, data: Record<string, unknown>): void {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data));
	}
}

/**
 * Remove a session from the registry and kill its PTY
 */
function destroySession(sessionId: string): void {
	const session = sessions.get(sessionId);
	if (!session) return;

	if (session.cleanupTimer) {
		clearTimeout(session.cleanupTimer);
	}

	try {
		session.pty.kill();
	} catch {
		// PTY may already be dead
	}

	sessions.delete(sessionId);
	console.warn(`[argos-terminal] Session ${sessionId} destroyed`);
}

/**
 * Detach a WebSocket from its session (on WS close).
 * Starts buffering output and a cleanup timer.
 */
function detachSession(sessionId: string): void {
	const session = sessions.get(sessionId);
	if (!session) return;

	session.ws = null;
	console.warn(
		`[argos-terminal] Session ${sessionId} detached, will cleanup in ${CLEANUP_TIMEOUT_MS / 1000}s`
	);

	// Start cleanup timer
	session.cleanupTimer = setTimeout(() => {
		console.warn(`[argos-terminal] Session ${sessionId} timed out, destroying`);
		destroySession(sessionId);
	}, CLEANUP_TIMEOUT_MS);
}

async function setupTerminal() {
	let ptyModule: typeof import('node-pty');
	try {
		ptyModule = await import('node-pty');
		console.warn('[argos-terminal] node-pty loaded OK');
	} catch {
		console.warn('[argos-terminal] node-pty not available — terminal disabled');
		return;
	}

	const wss = new WebSocketServer({ port: TERMINAL_PORT, host: '0.0.0.0' });

	wss.on('listening', () => {
		console.warn(`[argos-terminal] Shell server listening on port ${TERMINAL_PORT}`);
	});

	wss.on('error', (err: Error) => {
		console.error('[argos-terminal] Server error:', err.message);
	});

	wss.on('connection', (ws) => {
		const defaultShell = process.env.SHELL || '/bin/bash';
		let boundSessionId: string | null = null;
		let initialized = false;
		let initTimeout: ReturnType<typeof setTimeout> | null = null;

		/**
		 * Reattach to an existing session
		 */
		function reattachSession(sessionId: string, session: PtySession) {
			// Cancel cleanup timer
			if (session.cleanupTimer) {
				clearTimeout(session.cleanupTimer);
				session.cleanupTimer = null;
			}

			// Detach previous WebSocket if somehow still attached
			if (session.ws && session.ws !== ws && session.ws.readyState === WebSocket.OPEN) {
				sendJson(session.ws, { type: 'detached' });
				session.ws.close();
			}

			// Attach new WebSocket
			session.ws = ws;
			boundSessionId = sessionId;
			initialized = true;

			// Notify client of reattachment
			sendJson(ws, { type: 'reattached', shell: session.shell, sessionId });

			// Flush buffered output
			if (session.outputBuffer.length > 0) {
				for (const chunk of session.outputBuffer) {
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(chunk);
					}
				}
				session.outputBuffer = [];
				session.bufferSize = 0;
			}

			// Resize PTY to match client (client will send resize after reattach)
			console.warn(`[argos-terminal] Session ${sessionId} reattached`);
		}

		/**
		 * Spawn a new PTY process and register the session
		 */
		async function spawnPty(requestedShell: string, sessionId: string) {
			// Validate and use requested shell, fallback to default
			let shell = defaultShell;
			if (await isValidShell(requestedShell)) {
				shell = requestedShell;
			} else {
				console.warn(
					`[argos-terminal] Invalid shell requested: ${requestedShell}, using ${defaultShell}`
				);
			}

			const ptyProcess = ptyModule.spawn(shell, [], {
				name: 'xterm-256color',
				cols: 80,
				rows: 24,
				cwd: process.env.HOME || '/home',
				env: process.env as Record<string, string>
			});

			const session: PtySession = {
				pty: ptyProcess,
				shell,
				ws,
				outputBuffer: [],
				bufferSize: 0,
				cleanupTimer: null,
				cols: 80,
				rows: 24
			};

			sessions.set(sessionId, session);
			boundSessionId = sessionId;
			initialized = true;

			// Send ready message
			sendJson(ws, { type: 'ready', shell, sessionId });

			// Forward PTY output to WebSocket or buffer
			ptyProcess.onData((data: string) => {
				const s = sessions.get(sessionId);
				if (!s) return;

				if (s.ws && s.ws.readyState === WebSocket.OPEN) {
					s.ws.send(data);
				} else {
					// Buffer output while detached
					s.outputBuffer.push(data);
					s.bufferSize += data.length;

					// Cap buffer size — drop oldest chunks if over limit
					while (s.bufferSize > MAX_BUFFER_BYTES && s.outputBuffer.length > 1) {
						const dropped = s.outputBuffer.shift();
						if (dropped) s.bufferSize -= dropped.length;
					}
				}
			});

			// Handle PTY exit (user typed `exit`)
			ptyProcess.onExit(() => {
				const s = sessions.get(sessionId);
				if (s?.ws && s.ws.readyState === WebSocket.OPEN) {
					sendJson(s.ws, { type: 'exit' });
				}
				sessions.delete(sessionId);
				console.warn(`[argos-terminal] Session ${sessionId} exited`);
			});

			console.warn(`[argos-terminal] Session ${sessionId} spawned (${shell})`);
		}

		// Set up timeout to spawn with default shell if no init received
		initTimeout = setTimeout(() => {
			if (!initialized) {
				console.warn(
					'[argos-terminal] No init message received, spawning with default shell'
				);
				const fallbackId = Math.random().toString(36).substring(2, 9);
				spawnPty(defaultShell, fallbackId);
			}
		}, INIT_TIMEOUT_MS);

		ws.on('message', async (msg: Buffer | string) => {
			const str = typeof msg === 'string' ? msg : msg.toString();

			try {
				const parsed = JSON.parse(str);

				// Handle init message (shell selection + session reattach)
				if (parsed.type === 'init' && !initialized) {
					if (initTimeout) {
						clearTimeout(initTimeout);
						initTimeout = null;
					}

					const sessionId =
						parsed.sessionId || Math.random().toString(36).substring(2, 9);

					// Check if session exists and PTY is alive
					const existing = sessions.get(sessionId);
					if (existing) {
						try {
							// Verify PTY is still alive (process.kill(0) checks existence)
							process.kill(existing.pty.pid, 0);
							reattachSession(sessionId, existing);
						} catch {
							// PTY is dead, clean up and spawn new
							sessions.delete(sessionId);
							await spawnPty(parsed.shell || defaultShell, sessionId);
						}
					} else {
						await spawnPty(parsed.shell || defaultShell, sessionId);
					}
					return;
				}

				// Handle list-sessions request
				if (parsed.type === 'list-sessions') {
					const sessionList = Array.from(sessions.entries()).map(([id, s]) => {
						let alive = true;
						try {
							process.kill(s.pty.pid, 0);
						} catch {
							alive = false;
						}
						return { id, shell: s.shell, alive };
					});
					sendJson(ws, { type: 'sessions', sessions: sessionList });
					return;
				}

				// Handle resize message
				if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
					if (boundSessionId) {
						const session = sessions.get(boundSessionId);
						if (session) {
							const cols = Math.max(1, Math.floor(parsed.cols));
							const rows = Math.max(1, Math.floor(parsed.rows));
							session.pty.resize(cols, rows);
							session.cols = cols;
							session.rows = rows;
						}
					}
					return;
				}

				// Handle input message
				if (parsed.type === 'input' && typeof parsed.data === 'string') {
					if (boundSessionId) {
						const session = sessions.get(boundSessionId);
						if (session) {
							session.pty.write(parsed.data);
						}
					}
					return;
				}
			} catch {
				// Non-JSON message — treat as raw input (backward compatibility)
				if (boundSessionId) {
					const session = sessions.get(boundSessionId);
					if (session) {
						session.pty.write(str);
					}
				} else if (!initialized) {
					// No PTY yet and got raw input — spawn with default
					if (initTimeout) {
						clearTimeout(initTimeout);
						initTimeout = null;
					}
					const fallbackId = Math.random().toString(36).substring(2, 9);
					await spawnPty(defaultShell, fallbackId);
					const session = sessions.get(fallbackId);
					if (session) {
						session.pty.write(str);
					}
				}
			}
		});

		ws.on('close', () => {
			if (initTimeout) {
				clearTimeout(initTimeout);
			}
			// DON'T kill the PTY — detach and buffer instead
			if (boundSessionId) {
				detachSession(boundSessionId);
			}
		});

		ws.on('error', (err) => {
			console.error('[argos-terminal] WebSocket error:', err.message);
			// DON'T kill the PTY — detach and buffer instead
			if (boundSessionId) {
				detachSession(boundSessionId);
			}
		});
	});
}
