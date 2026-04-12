<script lang="ts">
	/**
	 * WebTAK panel — noVNC-backed.
	 *
	 * Replaces the old iframe embedding (which broke against TAK server's
	 * `X-Frame-Options: DENY` + strict CSP). The operator enters a TAK URL,
	 * Argos spawns a real Chromium browser on a virtual display, and streams
	 * that Chromium back via VNC-over-WebSocket. All keyboard/mouse input is
	 * forwarded to the real browser, so typing credentials and interacting
	 * with WebTAK works exactly like using a laptop.
	 *
	 * Three UI modes: `form` (enter URL) → `starting` (spawning stack) →
	 * `connected` (noVNC viewer).  The server-side stack is auto-stopped on
	 * view unmount via a `keepalive: true` fetch so switching tabs doesn't
	 * leak a Chromium process.
	 */

	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';
	import WebtakUrlForm from './webtak/webtak-url-form.svelte';
	import WebtakVncViewer from './webtak/webtak-vnc-viewer.svelte';

	type Mode = 'form' | 'starting' | 'connected' | 'error';

	const CONTROL_ENDPOINT = '/api/webtak-vnc/control';

	const saved = typeof window !== 'undefined' ? localStorage.getItem('argos-webtak-url') : null;

	let mode = $state<Mode>('form');
	let wsUrl = $state('');
	let currentUrl = $state(saved || '');
	let startError = $state('');
	let viewerKey = $state(0);

	function goBack() {
		activeView.set('map');
	}

	function buildWsUrl(body: { wsPort?: number; wsPath?: string }): string {
		const wsPort = body.wsPort ?? 6080;
		const wsPath = body.wsPath ?? '/websockify';
		return `ws://${window.location.hostname}:${wsPort}${wsPath}`;
	}

	async function restoreExistingSession(isCancelled: () => boolean): Promise<void> {
		try {
			const res = await fetch(CONTROL_ENDPOINT, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'status' })
			});
			if (isCancelled()) return;
			const body = await res.json();
			if (!body.isRunning || !body.currentUrl) return;
			wsUrl = buildWsUrl(body);
			currentUrl = body.currentUrl;
			mode = 'connected';
		} catch {
			/* ignore — fall back to form */
		}
	}

	async function postControlStart(url: string): Promise<{
		wsPort?: number;
		wsPath?: string;
		success: boolean;
		error?: string;
		message?: string;
	}> {
		const res = await fetch(CONTROL_ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'start', url })
		});
		const body = await res.json();
		if (!res.ok || !body.success) {
			throw new Error(body.error || body.message || `HTTP ${res.status}`);
		}
		return body;
	}

	async function handleConnect(url: string) {
		mode = 'starting';
		startError = '';
		try {
			const body = await postControlStart(url);
			wsUrl = buildWsUrl(body);
			currentUrl = url;
			mode = 'connected';
		} catch (err) {
			startError = err instanceof Error ? err.message : String(err);
			mode = 'error';
		}
	}

	async function handleDisconnect() {
		try {
			await fetch(CONTROL_ENDPOINT, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'stop' })
			});
		} catch {
			/* best-effort teardown */
		}
		wsUrl = '';
		mode = 'form';
	}

	function refreshViewer() {
		viewerKey++;
	}

	function openInNewTab() {
		if (currentUrl && typeof window !== 'undefined') {
			window.open(currentUrl, '_blank', 'noopener,noreferrer');
		}
	}

	function onViewerDisconnect(reason: string) {
		if (reason === 'unclean') {
			startError = 'Remote browser session ended unexpectedly.';
			mode = 'error';
		}
	}

	function returnToForm() {
		wsUrl = '';
		startError = '';
		mode = 'form';
	}

	// On mount, ask the backend whether a VNC stack is already running. If so,
	// skip the form and jump straight back into the existing session — this
	// makes tab switching seamless for the operator. The stack is only torn
	// down when the user explicitly clicks Disconnect.
	$effect(() => {
		if (typeof fetch === 'undefined') return;
		let cancelled = false;
		void restoreExistingSession(() => cancelled);
		return () => {
			cancelled = true;
		};
	});
</script>

<ToolViewWrapper title="WebTAK — Team Awareness Kit" onBack={goBack}>
	{#snippet actions()}
		{#if mode === 'connected'}
			<button class="action-btn" onclick={refreshViewer}>Refresh</button>
			<button class="action-btn" onclick={openInNewTab}>Open in Tab</button>
			<button class="action-btn" onclick={handleDisconnect}>Disconnect</button>
		{:else if mode === 'error'}
			<button class="action-btn" onclick={returnToForm}>Change URL</button>
		{/if}
	{/snippet}

	<div class="webtak-shell">
		{#if mode === 'form'}
			<WebtakUrlForm
				initialUrl={currentUrl}
				onConnect={handleConnect}
				busy={false}
				errorMessage=""
			/>
		{:else if mode === 'starting'}
			<div class="status-panel">
				<div class="status-card">
					<div class="spinner" aria-hidden="true"></div>
					<p class="status-title">STARTING BROWSER SESSION</p>
					<p class="status-desc">
						Spawning Xtigervnc, Chromium, and websockify on the Argos host…
					</p>
				</div>
			</div>
		{:else if mode === 'connected'}
			{#key viewerKey}
				<WebtakVncViewer {wsUrl} onDisconnect={onViewerDisconnect} />
			{/key}
		{:else if mode === 'error'}
			<div class="status-panel">
				<div class="status-card error">
					<p class="status-title">CONNECTION FAILED</p>
					<p class="status-desc">{startError || 'Unknown error'}</p>
					<button class="retry-btn" onclick={returnToForm}>Change URL</button>
				</div>
			</div>
		{/if}
	</div>
</ToolViewWrapper>

<style>
	.webtak-shell {
		position: relative;
		width: 100%;
		height: 100%;
		background: var(--background);
	}

	.status-panel {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	.status-card {
		background: var(--card);
		border: 1px solid var(--border);
		padding: 28px 36px;
		max-width: 460px;
		font-family: 'Fira Code', monospace;
		text-align: center;
	}

	.status-card.error {
		border-color: var(--destructive);
	}

	.status-title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--primary);
		margin: 0 0 8px;
		text-transform: uppercase;
	}

	.status-card.error .status-title {
		color: var(--destructive);
	}

	.status-desc {
		font-size: 10px;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0;
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

	.action-btn {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-secondary);
		padding: 4px 12px;
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		cursor: pointer;
	}

	.action-btn:hover {
		color: var(--foreground);
		border-color: var(--foreground);
	}

	.retry-btn {
		margin-top: 16px;
		padding: 6px 18px;
		background: var(--primary);
		color: var(--background);
		border: none;
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		letter-spacing: 0.8px;
		font-weight: 600;
		text-transform: uppercase;
		cursor: pointer;
	}
</style>
