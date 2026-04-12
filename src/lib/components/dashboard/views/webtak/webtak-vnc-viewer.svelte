<script lang="ts">
	/**
	 * noVNC RFB viewer wired to a WebSocket URL.
	 *
	 * Dynamically imports `@novnc/novnc/core/rfb.js` inside an `$effect` so the
	 * module never runs under SSR (it touches the DOM at import time). The RFB
	 * instance is created fresh on every mount — to reconnect, the parent
	 * bumps a `{#key}` so this component unmounts and re-mounts.
	 */

	import { onDestroy } from 'svelte';

	interface Props {
		/** Fully-qualified WebSocket URL, e.g. `ws://host:6080/websockify`. */
		wsUrl: string;
		/** Fired when the RFB client reports an unclean disconnect. */
		onDisconnect?: (reason: string) => void;
	}

	let { wsUrl, onDisconnect }: Props = $props();

	type RfbLike = {
		scaleViewport: boolean;
		clipViewport: boolean;
		resizeSession: boolean;
		viewOnly: boolean;
		focusOnClick: boolean;
		qualityLevel: number;
		compressionLevel: number;
		background: string;
		addEventListener: (type: string, listener: (ev: CustomEvent) => void) => void;
		disconnect: () => void;
		focus: () => void;
	};

	let canvasContainer: HTMLDivElement | undefined = $state();
	let status = $state<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
	let errorMsg = $state('');
	let rfb: RfbLike | null = null;

	type RfbCtor = new (target: HTMLElement, url: string, opts: { shared?: boolean }) => RfbLike;

	async function loadRfbModule(): Promise<RfbCtor> {
		// Build the URL at runtime so Vite's static import analyzer cannot try
		// to resolve it. The file is served as a raw ESM asset from
		// static/webtak/novnc/rfb.js, which is real ESM source (not the broken
		// CJS bundle shipped on npm).
		const rfbUrl = ['', 'webtak', 'novnc', 'rfb.js'].join('/');
		const mod = (await import(/* @vite-ignore */ rfbUrl)) as unknown as {
			default?: RfbCtor;
		};
		return (mod.default ?? (mod as unknown as RfbCtor)) as RfbCtor;
	}

	function configureRfb(instance: RfbLike): void {
		instance.scaleViewport = true;
		instance.clipViewport = true;
		instance.resizeSession = false;
		instance.viewOnly = false;
		instance.focusOnClick = true;
		instance.qualityLevel = 6;
		instance.compressionLevel = 2;
		instance.background = 'var(--background)';
	}

	function wireRfbEvents(instance: RfbLike): void {
		instance.addEventListener('connect', () => {
			status = 'connected';
			setTimeout(() => instance.focus(), 100);
		});
		instance.addEventListener('disconnect', (event: CustomEvent) => {
			const clean = (event.detail as { clean?: boolean } | undefined)?.clean;
			status = clean ? 'disconnected' : 'error';
			if (clean) return;
			errorMsg = 'VNC connection lost';
			onDisconnect?.('unclean');
		});
		instance.addEventListener('securityfailure', (event: CustomEvent) => {
			const detail = event.detail as { reason?: string } | undefined;
			status = 'error';
			errorMsg = `VNC security failure: ${detail?.reason ?? 'unknown'}`;
		});
	}

	function reportRfbError(err: unknown, isCancelled: () => boolean): void {
		if (isCancelled()) return;
		status = 'error';
		errorMsg = err instanceof Error ? err.message : String(err);
	}

	async function initRfb(isCancelled: () => boolean): Promise<void> {
		try {
			const RFB = await loadRfbModule();
			if (isCancelled() || !canvasContainer) return;
			const instance = new RFB(canvasContainer, wsUrl, { shared: true });
			configureRfb(instance);
			wireRfbEvents(instance);
			rfb = instance;
		} catch (err) {
			reportRfbError(err, isCancelled);
		}
	}

	$effect(() => {
		if (!canvasContainer || !wsUrl) return;
		let cancelled = false;
		status = 'connecting';
		errorMsg = '';

		void initRfb(() => cancelled);

		return () => {
			cancelled = true;
			try {
				rfb?.disconnect();
			} catch {
				/* already disconnected */
			}
			rfb = null;
		};
	});

	onDestroy(() => {
		try {
			rfb?.disconnect();
		} catch {
			/* noop */
		}
	});
</script>

<div class="vnc-shell">
	<div bind:this={canvasContainer} class="vnc-canvas"></div>

	{#if status === 'connecting'}
		<div class="overlay">
			<div class="overlay-card">
				<div class="spinner" aria-hidden="true"></div>
				<p class="overlay-title">STARTING BROWSER SESSION</p>
				<p class="overlay-desc">Connecting to remote Chromium via noVNC…</p>
			</div>
		</div>
	{:else if status === 'error'}
		<div class="overlay">
			<div class="overlay-card error">
				<p class="overlay-title">CONNECTION FAILED</p>
				<p class="overlay-desc">{errorMsg || 'Unknown VNC error'}</p>
			</div>
		</div>
	{:else if status === 'disconnected'}
		<div class="overlay">
			<div class="overlay-card">
				<p class="overlay-title">DISCONNECTED</p>
				<p class="overlay-desc">The remote browser session ended.</p>
			</div>
		</div>
	{/if}

	{#if status === 'connected'}
		<div class="status-pill">
			<span class="status-dot"></span>
			<span>CONNECTED · noVNC</span>
		</div>
	{/if}
</div>

<style>
	.vnc-shell {
		position: relative;
		width: 100%;
		height: 100%;
		background: var(--background);
		overflow: hidden;
	}

	.vnc-canvas {
		width: 100%;
		height: 100%;
	}

	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
	}

	.overlay-card {
		background: var(--card);
		border: 1px solid var(--border);
		padding: 24px 32px;
		max-width: 420px;
		text-align: center;
		font-family: 'Fira Code', monospace;
	}

	.overlay-card.error {
		border-color: var(--destructive);
	}

	.overlay-title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--primary);
		margin: 0 0 8px;
		text-transform: uppercase;
	}

	.overlay-card.error .overlay-title {
		color: var(--destructive);
	}

	.overlay-desc {
		font-size: 10px;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.5;
	}

	.spinner {
		width: 28px;
		height: 28px;
		margin: 0 auto 16px;
		border: 2px solid var(--border);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.status-pill {
		position: absolute;
		right: 12px;
		bottom: 12px;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		background: var(--card);
		border: 1px solid var(--border);
		font-family: 'Fira Code', monospace;
		font-size: 9px;
		letter-spacing: 1px;
		color: var(--text-secondary);
		pointer-events: none;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--success, #8bbfa0);
		box-shadow: 0 0 6px var(--success, #8bbfa0);
	}
</style>
