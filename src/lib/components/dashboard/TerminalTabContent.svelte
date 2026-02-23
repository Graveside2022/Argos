<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';
	import { buildTerminalTheme } from '$lib/components/dashboard/terminal/terminal-theme';
	import { updateSessionConnection } from '$lib/stores/dashboard/terminal-store';
	import { themeStore } from '$lib/stores/theme-store.svelte';
	import { logger } from '$lib/utils/logger';

	import TerminalErrorOverlay from './TerminalErrorOverlay.svelte';

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

	/** Derive display name from shell path. */
	function resolveShellName(shellPath: string): string {
		if (shellPath.includes('docker-claude-terminal.sh')) return '🐋 Claude';
		return shellPath.split('/').pop() || 'terminal';
	}

	/** Send a resize message to the terminal WebSocket. */
	function sendResize(sock: WebSocket) {
		if (!terminal) return;
		sock.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
	}

	/** Handle a session-ready or reattached message. */
	function handleSessionReady(msg: { shell: string }, sock: WebSocket, isReattach: boolean) {
		_actualShell = msg.shell;
		updateSessionConnection(sessionId, true);
		onTitleChange?.(resolveShellName(msg.shell));
		if (isReattach)
			terminal?.write('\r\n\x1b[90m[terminal reconnected - session restored]\x1b[0m\r\n');
		sendResize(sock);
	}

	/** Handle the 'exit' control message. */
	function handleSessionExit() {
		terminal?.write('\r\n\x1b[90m[session ended]\x1b[0m\r\n');
		updateSessionConnection(sessionId, false);
	}

	/** Dispatch a parsed control message. Returns true if recognized. */
	function dispatchControlMsg(msg: { type: string; shell?: string }, sock: WebSocket): boolean {
		if (msg.type === 'ready') {
			handleSessionReady(msg as { shell: string }, sock, false);
			return true;
		}
		if (msg.type === 'reattached') {
			handleSessionReady(msg as { shell: string }, sock, true);
			return true;
		}
		if (msg.type === 'exit') {
			handleSessionExit();
			return true;
		}
		return false;
	}

	/** Try to parse and handle a control message. Returns true if handled. */
	function handleControlMessage(data: string, sock: WebSocket): boolean {
		try {
			return dispatchControlMsg(JSON.parse(data), sock);
		} catch {
			return false;
		}
	}

	/** Whether a reconnection attempt should be made. */
	function shouldRetry(attempt: number): boolean {
		return !destroyed && attempt < WS_MAX_RETRIES && !connectionError;
	}

	/** Handle WebSocket close with retry logic. */
	function handleWebSocketClose(attempt: number) {
		if (shouldRetry(attempt)) {
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
	}

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
			if (typeof e.data !== 'string') return;
			if (handleControlMessage(e.data, sock)) return;
			terminal?.write(e.data);
		};

		sock.onerror = () => {
			updateSessionConnection(sessionId, false);
		};

		sock.onclose = () => {
			updateSessionConnection(sessionId, false);
			handleWebSocketClose(attempt);
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
		<TerminalErrorOverlay maxRetries={WS_MAX_RETRIES} />
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
</style>
