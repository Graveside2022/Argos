import type { Plugin, ViteDevServer } from 'vite';
import { WebSocketServer } from 'ws';

const TERMINAL_PORT = 3001;

export function terminalPlugin(): Plugin {
	return {
		name: 'argos-terminal',
		configureServer(_server: ViteDevServer) {
			console.log('[argos-terminal] Plugin hook called');
			// Don't return the promise — fire-and-forget so we don't block Vite
			setupTerminal().catch((err) => {
				console.error('[argos-terminal] Setup failed:', err);
			});
		}
	};
}

async function setupTerminal() {
	let ptyModule: typeof import('node-pty');
	try {
		ptyModule = await import('node-pty');
		console.log('[argos-terminal] node-pty loaded OK');
	} catch {
		console.warn('[argos-terminal] node-pty not available — terminal disabled');
		return;
	}

	const wss = new WebSocketServer({ port: TERMINAL_PORT, host: '0.0.0.0' });

	wss.on('listening', () => {
		console.log(`[argos-terminal] Shell server listening on port ${TERMINAL_PORT}`);
	});

	wss.on('error', (err: Error) => {
		console.error('[argos-terminal] Server error:', err.message);
	});

	wss.on('connection', (ws) => {
		const shell = process.env.SHELL || '/bin/bash';
		const ptyProcess = ptyModule.spawn(shell, [], {
			name: 'xterm-256color',
			cols: 80,
			rows: 24,
			cwd: process.env.HOME || '/home',
			env: process.env as Record<string, string>
		});

		ptyProcess.onData((data: string) => {
			if (ws.readyState === 1) ws.send(data);
		});

		ws.on('message', (msg: Buffer | string) => {
			const str = typeof msg === 'string' ? msg : msg.toString();
			try {
				const parsed = JSON.parse(str);
				if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
					ptyProcess.resize(
						Math.max(1, Math.floor(parsed.cols)),
						Math.max(1, Math.floor(parsed.rows))
					);
					return;
				}
				if (parsed.type === 'input' && typeof parsed.data === 'string') {
					ptyProcess.write(parsed.data);
					return;
				}
			} catch {
				ptyProcess.write(str);
			}
		});

		ws.on('close', () => {
			ptyProcess.kill();
		});

		ptyProcess.onExit(() => {
			if (ws.readyState === 1) ws.close();
		});
	});
}
