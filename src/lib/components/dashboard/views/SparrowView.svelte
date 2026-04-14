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

	async function checkStatus(): Promise<void> {
		try {
			const res = await fetch('/api/sparrow/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ action: 'status' })
			});
			const data = await res.json();
			if (data.vnc?.isRunning) {
				const host = window.location.hostname;
				wsUrl = `ws://${host}:${data.vnc.wsPort}${data.vnc.wsPath}`;
				serviceStatus = 'running';
			} else {
				serviceStatus = 'stopped';
			}
		} catch {
			serviceStatus = 'error';
			errorMsg = 'Failed to check Sparrow-WiFi status';
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

<ToolViewWrapper title="Sparrow WiFi" onBack={goBack}>
	{#if serviceStatus === 'checking'}
		<div class="sparrow-status">
			<div class="spinner" aria-hidden="true"></div>
			<p class="status-label">CONNECTING...</p>
		</div>
	{:else if serviceStatus === 'stopped'}
		<div class="sparrow-status">
			<p class="status-label">SPARROW UNAVAILABLE</p>
			<p class="status-detail">Start Sparrow-WiFi from the tool card first.</p>
		</div>
	{:else if serviceStatus === 'error'}
		<div class="sparrow-status">
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
	.sparrow-status {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.5rem;
	}
	.status-label {
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--color-warning, #d4a054);
		text-transform: uppercase;
	}
	.status-label.error {
		color: var(--destructive, #ff5c33);
	}
	.status-detail {
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		color: var(--muted-foreground);
	}
	.retry-btn {
		margin-top: 12px;
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 1.2px;
		padding: 6px 16px;
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 3px;
		background: transparent;
		color: var(--primary, #a8b8e0);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.retry-btn:hover {
		background: rgba(168, 184, 224, 0.08);
		border-color: var(--primary, #a8b8e0);
	}
	.spinner {
		width: 28px;
		height: 28px;
		border: 2px solid var(--border, #2e2e2e);
		border-top-color: var(--primary, #a8b8e0);
		border-radius: 50%;
		animation: spin 0.9s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
