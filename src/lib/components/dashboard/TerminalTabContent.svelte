<!-- @constitutional-exemption Article-IV-4.3 issue:#TBD — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';
	import { updateSessionConnection } from '$lib/stores/dashboard/terminal-store';

	interface Props {
		sessionId: string;
		shell: string;
		isActive: boolean;
		onTitleChange?: (title: string) => void;
	}

	let { sessionId, shell, isActive, onTitleChange }: Props = $props();

	let terminalEl: HTMLDivElement | undefined = $state();
	let connectionError = $state(false);
	let _actualShell = $state(shell);

	// References for cleanup
	let terminal: import('@xterm/xterm').Terminal | null = null;
	let fitAddon: import('@xterm/addon-fit').FitAddon | null = null;
	let ws: WebSocket | null = null;
	let resizeObserver: ResizeObserver | null = null;

	// Focus terminal when becoming active
	$effect(() => {
		if (isActive && terminal) {
			requestAnimationFrame(() => {
				terminal?.focus();
				fitAddon?.fit();
			});
		}
	});

	onMount(async () => {
		if (!browser || !terminalEl) return;

		const [xtermMod, fitMod] = await Promise.all([
			import('@xterm/xterm'),
			import('@xterm/addon-fit')
		]);

		// Inject xterm base CSS (idempotent)
		await import('@xterm/xterm/css/xterm.css');

		const { Terminal } = xtermMod;
		const { FitAddon } = fitMod;

		terminal = new Terminal({
			cursorBlink: true,
			cursorStyle: 'bar',
			fontSize: 14,
			fontFamily:
				"'FiraCode Nerd Font', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
			lineHeight: 1.2,
			scrollback: 10000,
			theme: {
				background: '#0e1116',
				foreground: '#e8eaed',
				cursor: '#4a9eff',
				cursorAccent: '#0e1116',
				selectionBackground: 'rgba(74, 158, 255, 0.3)',
				selectionForeground: '#ffffff',
				black: '#16181d',
				red: '#f87171',
				green: '#4ade80',
				yellow: '#fbbf24',
				blue: '#4a9eff',
				magenta: '#a78bfa',
				cyan: '#22d3ee',
				white: '#e8eaed',
				brightBlack: '#5f6368',
				brightRed: '#fca5a5',
				brightGreen: '#86efac',
				brightYellow: '#fde047',
				brightBlue: '#60a5fa',
				brightMagenta: '#c4b5fd',
				brightCyan: '#67e8f9',
				brightWhite: '#ffffff'
			}
		});

		fitAddon = new FitAddon();
		terminal.loadAddon(fitAddon);

		// Optional web-links addon
		try {
			const { WebLinksAddon } = await import('@xterm/addon-web-links');
			terminal.loadAddon(new WebLinksAddon());
		} catch {
			/* optional */
		}

		terminal.open(terminalEl);
		requestAnimationFrame(() => fitAddon?.fit());

		// Auto-resize when container dimensions change
		resizeObserver = new ResizeObserver(() => {
			if (isActive) {
				requestAnimationFrame(() => fitAddon?.fit());
			}
		});
		resizeObserver.observe(terminalEl);

		// WebSocket connection to PTY backend
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		ws = new WebSocket(`${protocol}//${window.location.hostname}:3001`);

		ws.onopen = () => {
			connectionError = false;
			console.warn(`[Terminal ${sessionId}] WebSocket connected, sending init`);
			// Send init message with shell selection
			ws?.send(JSON.stringify({ type: 'init', shell, sessionId }));
		};

		ws.onmessage = (e) => {
			if (typeof e.data === 'string') {
				// Check for JSON messages from server
				try {
					const msg = JSON.parse(e.data);
					if (msg.type === 'ready') {
						console.warn(`[Terminal ${sessionId}] New PTY session spawned`);
						_actualShell = msg.shell;
						updateSessionConnection(sessionId, true);
						let shellName = msg.shell.split('/').pop() || 'terminal';
						// Friendly name for Docker + tmux terminal
						if (msg.shell.includes('docker-claude-terminal.sh')) {
							shellName = '🐋 Claude';
						}
						onTitleChange?.(shellName);
						// Send initial resize
						if (terminal) {
							ws?.send(
								JSON.stringify({
									type: 'resize',
									cols: terminal.cols,
									rows: terminal.rows
								})
							);
						}
						return;
					}
					if (msg.type === 'reattached') {
						console.warn(`[Terminal ${sessionId}] PTY session reattached successfully`);
						_actualShell = msg.shell;
						updateSessionConnection(sessionId, true);
						let shellName = msg.shell.split('/').pop() || 'terminal';
						// Friendly name for Docker + tmux terminal
						if (msg.shell.includes('docker-claude-terminal.sh')) {
							shellName = '🐋 Claude';
						}
						onTitleChange?.(shellName);

						// Notify user of reconnection
						terminal?.write(
							'\r\n\x1b[90m[terminal reconnected - session restored]\x1b[0m\r\n'
						);

						// Send resize so PTY matches current terminal dimensions
						if (terminal) {
							ws?.send(
								JSON.stringify({
									type: 'resize',
									cols: terminal.cols,
									rows: terminal.rows
								})
							);
						}
						// Buffered output will arrive as regular data after this message
						return;
					}
					if (msg.type === 'exit') {
						terminal?.write('\r\n\x1b[90m[session ended]\x1b[0m\r\n');
						updateSessionConnection(sessionId, false);
						return;
					}
				} catch {
					// Not JSON, treat as terminal output
				}
				terminal?.write(e.data);
			}
		};

		ws.onerror = () => {
			connectionError = true;
			updateSessionConnection(sessionId, false);
		};

		ws.onclose = () => {
			// Don't print "[connection closed]" — the PTY persists server-side
			// and will be reattached on next page load
			updateSessionConnection(sessionId, false);
		};

		// Forward terminal input to backend
		terminal.onData((data) => {
			if (ws?.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'input', data }));
			}
		});

		// Forward resize events to backend
		terminal.onResize(({ cols, rows }) => {
			if (ws?.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'resize', cols, rows }));
			}
		});

		// Extract title from terminal escape sequences (OSC 0 or OSC 2)
		terminal.onTitleChange((title) => {
			if (title) {
				onTitleChange?.(title);
			}
		});

		if (isActive) {
			terminal.focus();
		}
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		ws?.close();
		terminal?.dispose();
	});
</script>

<div class="terminal-tab-content" class:active={isActive} class:hidden={!isActive}>
	{#if connectionError}
		<div class="error-overlay">
			<div class="error-content">
				<svg
					width="32"
					height="32"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="4 17 10 11 4 5" />
					<line x1="12" y1="19" x2="20" y2="19" />
				</svg>
				<span class="error-title">Terminal Unavailable</span>
				<span class="error-detail"
					>Ensure <code>node-pty</code> is installed and the dev server is running.</span
				>
				<code class="error-cmd">npm install node-pty</code>
			</div>
		</div>
	{/if}
	<div class="terminal-container" bind:this={terminalEl}></div>
</div>

<style>
	.terminal-tab-content {
		flex: 1;
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.terminal-tab-content.hidden {
		display: none;
	}

	.terminal-container {
		width: 100%;
		height: 100%;
		padding: 4px 0 0 4px;
	}

	/* xterm.js overrides */
	.terminal-container :global(.xterm) {
		height: 100%;
	}

	.terminal-container :global(.xterm-viewport::-webkit-scrollbar) {
		width: 8px;
	}

	.terminal-container :global(.xterm-viewport::-webkit-scrollbar-track) {
		background: transparent;
	}

	.terminal-container :global(.xterm-viewport::-webkit-scrollbar-thumb) {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
	}

	.terminal-container :global(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
		background: rgba(255, 255, 255, 0.2);
	}

	/* Error overlay */
	.error-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(14, 17, 22, 0.9);
		z-index: 10;
	}

	.error-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-8);
		color: var(--palantir-text-secondary);
		text-align: center;
	}

	.error-content svg {
		color: var(--palantir-text-tertiary);
	}

	.error-title {
		font-size: var(--text-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--palantir-text-primary);
	}

	.error-detail {
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
	}

	.error-detail code {
		font-family: var(--font-mono);
		color: var(--palantir-accent);
	}

	.error-cmd {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		background: var(--palantir-bg-elevated);
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-md);
		color: var(--palantir-accent);
		border: 1px solid var(--palantir-border-subtle);
	}
</style>
