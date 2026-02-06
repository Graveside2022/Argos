import type { Plugin, ViteDevServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { access, constants } from 'fs/promises';

const TERMINAL_PORT = 3001;
const INIT_TIMEOUT_MS = 5000; // Wait max 5s for init message

// Valid shell paths
const VALID_SHELLS = [
	'/bin/bash',
	'/bin/zsh',
	'/bin/sh',
	'/usr/bin/bash',
	'/usr/bin/zsh',
	'/usr/bin/fish',
	'/bin/fish'
];

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
		let ptyProcess: ReturnType<typeof ptyModule.spawn> | null = null;
		let initialized = false;
		let initTimeout: ReturnType<typeof setTimeout> | null = null;

		/**
		 * Spawn the PTY process with the given shell
		 */
		async function spawnPty(requestedShell: string) {
			// Validate and use requested shell, fallback to default
			let shell = defaultShell;
			if (await isValidShell(requestedShell)) {
				shell = requestedShell;
			} else {
				console.warn(
					`[argos-terminal] Invalid shell requested: ${requestedShell}, using ${defaultShell}`
				);
			}

			ptyProcess = ptyModule.spawn(shell, [], {
				name: 'xterm-256color',
				cols: 80,
				rows: 24,
				cwd: process.env.HOME || '/home',
				env: process.env as Record<string, string>
			});

			// Send ready message with actual shell used
			sendJson(ws, { type: 'ready', shell });

			// Forward PTY output to WebSocket
			ptyProcess.onData((data: string) => {
				if (ws.readyState === WebSocket.OPEN) {
					ws.send(data);
				}
			});

			// Handle PTY exit
			ptyProcess.onExit(() => {
				sendJson(ws, { type: 'exit' });
				if (ws.readyState === WebSocket.OPEN) {
					ws.close();
				}
			});

			initialized = true;
		}

		// Set up timeout to spawn with default shell if no init received
		initTimeout = setTimeout(() => {
			if (!initialized) {
				console.warn(
					'[argos-terminal] No init message received, spawning with default shell'
				);
				spawnPty(defaultShell);
			}
		}, INIT_TIMEOUT_MS);

		ws.on('message', async (msg: Buffer | string) => {
			const str = typeof msg === 'string' ? msg : msg.toString();

			try {
				const parsed = JSON.parse(str);

				// Handle init message (shell selection)
				if (parsed.type === 'init' && !initialized) {
					if (initTimeout) {
						clearTimeout(initTimeout);
						initTimeout = null;
					}
					await spawnPty(parsed.shell || defaultShell);
					return;
				}

				// Handle resize message
				if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
					if (ptyProcess) {
						ptyProcess.resize(
							Math.max(1, Math.floor(parsed.cols)),
							Math.max(1, Math.floor(parsed.rows))
						);
					}
					return;
				}

				// Handle input message
				if (parsed.type === 'input' && typeof parsed.data === 'string') {
					if (ptyProcess) {
						ptyProcess.write(parsed.data);
					}
					return;
				}
			} catch {
				// Non-JSON message — treat as raw input (backward compatibility)
				if (ptyProcess) {
					ptyProcess.write(str);
				} else if (!initialized) {
					// No PTY yet and got raw input — spawn with default
					if (initTimeout) {
						clearTimeout(initTimeout);
						initTimeout = null;
					}
					await spawnPty(defaultShell);
					// ptyProcess is now set by spawnPty
					if (ptyProcess) {
						(ptyProcess as ReturnType<typeof ptyModule.spawn>).write(str);
					}
				}
			}
		});

		ws.on('close', () => {
			if (initTimeout) {
				clearTimeout(initTimeout);
			}
			if (ptyProcess) {
				ptyProcess.kill();
			}
		});

		ws.on('error', (err) => {
			console.error('[argos-terminal] WebSocket error:', err.message);
			if (ptyProcess) {
				ptyProcess.kill();
			}
		});
	});
}
