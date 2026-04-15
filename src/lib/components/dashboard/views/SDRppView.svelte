<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';
	import WebtakVncViewer from './webtak/webtak-vnc-viewer.svelte';

	type ServiceStatus = 'checking' | 'running' | 'stopped' | 'error';

	let serviceStatus = $state<ServiceStatus>('checking');
	let errorMsg = $state('');
	let wsUrl = $state('');
	let vncKey = $state(0);

	function buildWsUrl(wsPort: number, wsPath: string): string {
		const host = window.location.hostname;
		const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
		return `${proto}://${host}:${wsPort}${wsPath}`;
	}

	function applyStatusData(data: Record<string, unknown>): void {
		const isRunning = (data.running ?? data.isRunning) as boolean | undefined;
		const wsPortVal = data.wsPort as number | undefined;
		const wsPathVal = data.wsPath as string | undefined;
		if (isRunning && wsPortVal && wsPathVal) {
			wsUrl = buildWsUrl(wsPortVal, wsPathVal);
			serviceStatus = 'running';
		} else {
			serviceStatus = 'stopped';
		}
	}

	async function checkStatus(): Promise<void> {
		try {
			const res = await fetch('/api/sdrpp/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ action: 'status' })
			});
			if (!res.ok) {
				serviceStatus = 'error';
				errorMsg = `Status check failed: ${res.status}`;
				return;
			}
			applyStatusData(await res.json());
		} catch {
			serviceStatus = 'error';
			errorMsg = 'Failed to check SDR++ status';
		}
	}

	function handleDisconnect(reason: string): void {
		if (reason === 'unclean') {
			serviceStatus = 'error';
			errorMsg = 'VNC connection lost';
		}
	}

	function reconnect(): void {
		vncKey++;
		serviceStatus = 'checking';
		checkStatus();
	}

	function goBack(): void {
		activeView.set('map');
	}

	onMount(() => {
		checkStatus();
	});

	onDestroy(() => {
		/* cleanup handled by VNC viewer */
	});
</script>

<ToolViewWrapper title="SDR++ Spectrum Analyzer" onBack={goBack}>
	{#if serviceStatus === 'checking'}
		<div class="sdrpp-status">
			<div class="spinner" aria-hidden="true"></div>
			<p class="status-label">CONNECTING...</p>
		</div>
	{:else if serviceStatus === 'stopped'}
		<div class="sdrpp-status">
			<p class="status-label">SDR++ UNAVAILABLE</p>
			<p class="status-detail">Start SDR++ from the tool card first.</p>
		</div>
	{:else if serviceStatus === 'error'}
		<div class="sdrpp-status">
			<p class="status-label error">CONNECTION FAILED</p>
			<p class="status-detail">{errorMsg || 'Unknown error'}</p>
			<button class="retry-btn" onclick={reconnect}>RETRY</button>
		</div>
	{:else}
		{#key vncKey}
			<WebtakVncViewer {wsUrl} onDisconnect={handleDisconnect} resizeSession={true} />
		{/key}
	{/if}
</ToolViewWrapper>

<style>
	.sdrpp-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.5rem;
	}
	.status-label {
		font-family: 'Fira Code', monospace;
		font-size: 12px;
		color: var(--muted-foreground, #d4a054);
		text-transform: uppercase;
		letter-spacing: 1.2px;
	}
	.status-label.error {
		color: var(--destructive, #ff5c33);
	}
	.status-detail {
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		color: var(--muted-foreground, #888);
	}
	.retry-btn {
		margin-top: 0.5rem;
		padding: 0.35rem 1rem;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--primary, #a8b8e0);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 4px;
		background: var(--card, #1a1a1a);
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.retry-btn:hover {
		border-color: var(--primary, #a8b8e0);
	}
	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--border, #2e2e2e);
		border-top-color: var(--primary, #a8b8e0);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
