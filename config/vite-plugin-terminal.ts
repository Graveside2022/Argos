import { execFileSync } from 'child_process';
import { access, constants } from 'fs/promises';
import path from 'path';
import type { Plugin, ViteDevServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';

const TERMINAL_PORT = 3001;
const INIT_TIMEOUT_MS = 5000; // Wait max 5s for init message
const CLEANUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes before killing orphaned PTY
const MAX_BUFFER_BYTES = 100 * 1024; // 100KB output buffer while detached
const PORT_RETRY_DELAY_MS = 1000; // Wait after killing stale port holder
const MAX_PORT_RETRIES = 2;

// Valid shell paths — resolved relative to project root
const PROJECT_ROOT = process.cwd();
const VALID_SHELLS = [
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-0.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-1.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-2.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-3.sh'),
	path.join(PROJECT_ROOT, 'scripts/tmux/tmux-zsh-wrapper.sh')
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
 * Normalize legacy paths cached by clients.
 * - Docker container paths (/app/...) → native host paths
 * - Old script locations (scripts/tmux-zsh-wrapper.sh) → new location (scripts/tmux/)
 */
function normalizeShellPath(shellPath: string): string {
	let normalized = shellPath;

	// Docker → native
	if (normalized.startsWith('/app/')) {
		normalized = normalized.replace(/^\/app\//, PROJECT_ROOT + '/');
	}

	// Old tmux-zsh-wrapper.sh location (moved during Phase 3 reorg)
	if (normalized.endsWith('/scripts/tmux-zsh-wrapper.sh') && !normalized.includes('/tmux/')) {
		normalized = normalized.replace(
			'/scripts/tmux-zsh-wrapper.sh',
			'/scripts/tmux/tmux-zsh-wrapper.sh'
		);
	}

	return normalized;
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

/**
 * Kill whatever is holding a port. Returns true if something was killed.
 */
function killPortHolder(port: number): boolean {
	try {
		const output = execFileSync('lsof', ['-ti', `:${port}`], {
			encoding: 'utf8',
			timeout: 3000
		}).trim();
		if (!output) return false;

		const pids = output
			.split('\n')
			.map((p) => parseInt(p, 10))
			.filter((p) => p > 0 && p !== process.pid);
		for (const pid of pids) {
			try {
				process.kill(pid, 'SIGKILL');
				console.warn(`[argos-terminal] Killed stale process ${pid} on port ${port}`);
			} catch {
				// Already dead
			}
		}
		return pids.length > 0;
	} catch {
		return false;
	}
}

/**
 * Create WebSocket server with retry on EADDRINUSE.
 * Kills stale port holders and retries.
 */
function createWssWithRetry(port: number, retries = MAX_PORT_RETRIES): Promise<WebSocketServer> {
	return new Promise((resolve, reject) => {
		const wss = new WebSocketServer({ port, host: '0.0.0.0' });

		wss.on('listening', () => {
			console.warn(`[argos-terminal] Shell server listening on port ${port}`);
			resolve(wss);
		});

		wss.on('error', (err: Error & { code?: string }) => {
			if (err.code === 'EADDRINUSE' && retries > 0) {
				console.warn(
					`[argos-terminal] Port ${port} in use, killing stale holder and retrying...`
				);
				wss.close();
				killPortHolder(port);
				setTimeout(() => {
					createWssWithRetry(port, retries - 1).then(resolve, reject);
				}, PORT_RETRY_DELAY_MS);
			} else if (err.code === 'EADDRINUSE') {
				console.error(
					`[argos-terminal] Port ${port} still in use after retries — terminal disabled`
				);
				wss.close();
				reject(err);
			} else {
				console.error('[argos-terminal] Server error:', err.message);
			}
		});
	});
}

/**
 * Pre-spawn the default tmux-0 session so it's ready before any browser connects.
 * Runs headless (no WebSocket attached) — the client reattaches when Terminal is opened.
 * Delays 2s to let tmux-continuum restore any saved state.
 */
function preSpawnDefaultSession(ptyModule: typeof import('node-pty')): void {
	const PRE_SPAWN_SESSION_ID = 'tmux-0-default';
	const PRE_SPAWN_SHELL = path.join(PROJECT_ROOT, 'scripts/tmux/tmux-0.sh');
	const PRE_SPAWN_DELAY_MS = 2000;

	// Don't double-spawn
	if (sessions.has(PRE_SPAWN_SESSION_ID)) {
		console.warn('[argos-terminal] tmux-0 session already exists, skipping pre-spawn');
		return;
	}

	setTimeout(async () => {
		// Verify shell is executable
		try {
			await access(PRE_SPAWN_SHELL, constants.X_OK);
		} catch {
			console.warn(`[argos-terminal] Pre-spawn skipped: ${PRE_SPAWN_SHELL} not executable`);
			return;
		}

		// Unset TMUX variables to prevent nested session conflicts
		const env = { ...process.env };
		delete env['TMUX'];
		delete env['TMUX_PANE'];

		let ptyProcess: ReturnType<typeof ptyModule.spawn>;
		try {
			ptyProcess = ptyModule.spawn(PRE_SPAWN_SHELL, [], {
				name: 'xterm-256color',
				cols: 80,
				rows: 24,
				cwd: process.env.HOME || '/home',
				env: env as Record<string, string>
			});
		} catch (err) {
			console.error('[argos-terminal] Pre-spawn failed:', err);
			return;
		}

		const session: PtySession = {
			pty: ptyProcess,
			shell: PRE_SPAWN_SHELL,
			ws: null, // headless — no WebSocket yet
			outputBuffer: [],
			bufferSize: 0,
			cleanupTimer: null, // no cleanup timer — persistent default session
			cols: 80,
			rows: 24
		};

		sessions.set(PRE_SPAWN_SESSION_ID, session);

		// Buffer output while headless; client reattaches and sees history
		ptyProcess.onData((data: string) => {
			try {
				const s = sessions.get(PRE_SPAWN_SESSION_ID);
				if (!s) return;

				if (s.ws && s.ws.readyState === WebSocket.OPEN) {
					s.ws.send(data);
				} else {
					s.outputBuffer.push(data);
					s.bufferSize += data.length;

					while (s.bufferSize > MAX_BUFFER_BYTES && s.outputBuffer.length > 1) {
						const dropped = s.outputBuffer.shift();
						if (dropped) s.bufferSize -= dropped.length;
					}
				}
			} catch (err) {
				console.error(`[argos-terminal] Pre-spawn onData error:`, err);
			}
		});

		ptyProcess.onExit(() => {
			sessions.delete(PRE_SPAWN_SESSION_ID);
			console.warn('[argos-terminal] Pre-spawned tmux-0 session exited');
		});

		console.warn('[argos-terminal] Pre-spawned tmux-0 session (ready for reattach)');
	}, PRE_SPAWN_DELAY_MS);
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

	let wss: WebSocketServer;
	try {
		wss = await createWssWithRetry(TERMINAL_PORT);
	} catch {
		// Terminal disabled but Vite continues running
		return;
	}

	// Graceful shutdown: clean up all PTY sessions when Vite exits
	const cleanup = () => {
		for (const [id, session] of sessions) {
			try {
				session.pty.kill();
			} catch {
				/* already dead */
			}
			if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
			sessions.delete(id);
		}
		try {
			wss.close();
		} catch {
			/* already closed */
		}
	};
	process.on('exit', cleanup);
	process.on('SIGTERM', cleanup);
	process.on('SIGINT', cleanup);

	// Pre-spawn tmux-0 so it's ready before any browser connects
	preSpawnDefaultSession(ptyModule);

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
			// Normalize legacy paths (Docker /app/..., old script locations)
			const normalized = normalizeShellPath(requestedShell);

			// Validate and use requested shell, fallback to default
			let shell = defaultShell;
			if (await isValidShell(normalized)) {
				shell = normalized;
			} else {
				console.warn(
					`[argos-terminal] Invalid shell requested: ${requestedShell}, using ${defaultShell}`
				);
			}

			let ptyProcess: ReturnType<typeof ptyModule.spawn>;
			try {
				// Unset TMUX variables to prevent nested session conflicts
				const env = { ...process.env };
				delete env['TMUX'];
				delete env['TMUX_PANE'];

				ptyProcess = ptyModule.spawn(shell, [], {
					name: 'xterm-256color',
					cols: 80,
					rows: 24,
					cwd: process.env.HOME || '/home',
					env: env as Record<string, string>
				});
			} catch (err) {
				console.error(`[argos-terminal] Failed to spawn PTY for ${shell}:`, err);
				sendJson(ws, { type: 'exit' });
				return;
			}

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

			// Forward PTY output to WebSocket or buffer (catch to prevent crashing Vite)
			ptyProcess.onData((data: string) => {
				try {
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
				} catch (err) {
					console.error(`[argos-terminal] onData error for ${sessionId}:`, err);
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
