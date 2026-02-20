<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';
	import { buildTerminalTheme } from '$lib/components/dashboard/terminal/terminal-theme';
	import { updateSessionConnection } from '$lib/stores/dashboard/terminal-store';
	import { themeStore } from '$lib/stores/theme-store.svelte';
	import { logger } from '$lib/utils/logger';

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

	const WS_MAX_RETRIES = 5;
	const WS_BASE_DELAY_MS = 500; // 500ms, 1s, 2s, 4s, 8s

	// References for cleanup
	let terminal: import('@xterm/xterm').Terminal | null = null;
	let fitAddon: import('@xterm/addon-fit').FitAddon | null = null;
	let ws: WebSocket | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let wsRetryTimer: ReturnType<typeof setTimeout> | null = null;
	let destroyed = false;

	// Focus terminal when becoming active
	$effect(() => {
		if (isActive && terminal) {
			requestAnimationFrame(() => {
				terminal?.focus();
				fitAddon?.fit();
			});
		}
	});

	// Re-apply terminal UI chrome colors when theme changes
	$effect(() => {
		// Subscribe to reactive theme state to trigger re-resolution
		const _palette = themeStore.palette;
		if (!terminal) return;
		terminal.options.theme = buildTerminalTheme();
	});

	function connectWebSocket(attempt: number) {
		if (destroyed) return;

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const sock = new WebSocket(`${protocol}//${window.location.host}/terminal-ws`);
		ws = sock;

		sock.onopen = () => {
			connectionError = false;
			logger.info('Terminal WebSocket connected, sending init', { sessionId });
			sock.send(JSON.stringify({ type: 'init', shell, sessionId }));
		};

		sock.onmessage = (e) => {
			if (typeof e.data === 'string') {
				try {
					const msg = JSON.parse(e.data);
					if (msg.type === 'ready') {
						logger.info('New PTY session spawned', { sessionId });
						_actualShell = msg.shell;
						updateSessionConnection(sessionId, true);
						let shellName = msg.shell.split('/').pop() || 'terminal';
						if (msg.shell.includes('docker-claude-terminal.sh')) {
							shellName = '🐋 Claude';
						}
						onTitleChange?.(shellName);
						if (terminal) {
							sock.send(
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
						logger.info('PTY session reattached successfully', { sessionId });
						_actualShell = msg.shell;
						updateSessionConnection(sessionId, true);
						let shellName = msg.shell.split('/').pop() || 'terminal';
						if (msg.shell.includes('docker-claude-terminal.sh')) {
							shellName = '🐋 Claude';
						}
						onTitleChange?.(shellName);
						terminal?.write(
							'\r\n\x1b[90m[terminal reconnected - session restored]\x1b[0m\r\n'
						);
						if (terminal) {
							sock.send(
								JSON.stringify({
									type: 'resize',
									cols: terminal.cols,
									rows: terminal.rows
								})
							);
						}
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

		sock.onerror = () => {
			updateSessionConnection(sessionId, false);
		};

		sock.onclose = () => {
			updateSessionConnection(sessionId, false);
			// Retry with exponential backoff if we never connected successfully
			if (!destroyed && attempt < WS_MAX_RETRIES && !connectionError) {
				const delay = WS_BASE_DELAY_MS * Math.pow(2, attempt);
				logger.warn('Terminal connection failed, retrying', {
					sessionId,
					attempt: attempt + 1,
					maxRetries: WS_MAX_RETRIES,
					delayMs: delay
				});
				wsRetryTimer = setTimeout(() => connectWebSocket(attempt + 1), delay);
			} else if (!destroyed && attempt >= WS_MAX_RETRIES) {
				logger.warn('Terminal retries exhausted, showing error', {
					sessionId,
					maxRetries: WS_MAX_RETRIES
				});
				connectionError = true;
			}
		};
	}

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
			theme: buildTerminalTheme()
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

		// Connect WebSocket with auto-retry
		connectWebSocket(0);

		if (isActive) {
			terminal.focus();
		}
	});

	onDestroy(() => {
		destroyed = true;
		if (wsRetryTimer) clearTimeout(wsRetryTimer);
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
					>Could not connect to terminal server after {WS_MAX_RETRIES} attempts.</span
				>
				<code class="error-cmd">Check that the dev server is running (npm run dev)</code>
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
