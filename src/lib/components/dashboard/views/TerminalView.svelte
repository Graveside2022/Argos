<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { activeView } from '$lib/stores/dashboard/dashboardStore';

	let terminalEl: HTMLDivElement;
	let connectionError = $state(false);
	let cleanup: (() => void) | null = null;

	function goBack() {
		activeView.set('map');
	}

	onMount(async () => {
		if (!browser) return;

		const [xtermMod, fitMod] = await Promise.all([
			import('@xterm/xterm'),
			import('@xterm/addon-fit')
		]);

		// Inject xterm base CSS
		await import('@xterm/xterm/css/xterm.css');

		const { Terminal } = xtermMod;
		const { FitAddon } = fitMod;

		const terminal = new Terminal({
			cursorBlink: true,
			cursorStyle: 'bar',
			fontSize: 14,
			fontFamily:
				"'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
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

		const fitAddon = new FitAddon();
		terminal.loadAddon(fitAddon);

		// Optional web-links addon
		try {
			const { WebLinksAddon } = await import('@xterm/addon-web-links');
			terminal.loadAddon(new WebLinksAddon());
		} catch (_error: unknown) {
			/* optional */
		}

		terminal.open(terminalEl);
		requestAnimationFrame(() => fitAddon.fit());

		// Auto-resize when container dimensions change
		const resizeObserver = new ResizeObserver(() => {
			requestAnimationFrame(() => fitAddon.fit());
		});
		resizeObserver.observe(terminalEl);

		// WebSocket connection to PTY backend (dedicated port)
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const ws = new WebSocket(`${protocol}//${window.location.hostname}:3001`);

		ws.onopen = () => {
			connectionError = false;
			ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
		};

		ws.onmessage = (e) => {
			terminal.write(typeof e.data === 'string' ? e.data : '');
		};

		ws.onerror = () => {
			connectionError = true;
		};

		ws.onclose = () => {
			if (!connectionError) {
				terminal.write('\r\n\x1b[90m[session ended]\x1b[0m\r\n');
			}
		};

		// Forward terminal input to backend
		terminal.onData((data) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'input', data }));
			}
		});

		// Forward resize events to backend
		terminal.onResize(({ cols, rows }) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'resize', cols, rows }));
			}
		});

		terminal.focus();

		cleanup = () => {
			resizeObserver.disconnect();
			ws.close();
			terminal.dispose();
		};
	});

	onDestroy(() => cleanup?.());
</script>

<div class="terminal-view">
	<div class="terminal-header">
		<button class="btn btn-ghost btn-sm" onclick={goBack}>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="15 18 9 12 15 6" />
			</svg>
			Back
		</button>
		<span class="terminal-title">
			<svg
				width="14"
				height="14"
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
			Terminal
		</span>
	</div>

	<div class="terminal-body">
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
					<span class="error-detail">Then restart the dev server.</span>
				</div>
			</div>
		{/if}
		<div class="terminal-container" bind:this={terminalEl}></div>
	</div>
</div>

<style>
	.terminal-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: #0e1116;
	}

	.terminal-header {
		height: 40px;
		min-height: 40px;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0 var(--space-4);
		background: var(--palantir-bg-surface);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	.terminal-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--palantir-text-primary);
		letter-spacing: var(--letter-spacing-wide);
	}

	.terminal-body {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.terminal-container {
		width: 100%;
		height: 100%;
		padding: var(--space-2);
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
