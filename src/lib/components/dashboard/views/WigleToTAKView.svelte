<script lang="ts">
	import { onMount } from 'svelte';

	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';

	type ServiceStatus = 'checking' | 'running' | 'stopped';

	let serviceStatus = $state<ServiceStatus>('checking');
	let iframeUrl = $state('');

	async function fetchStatus(): Promise<{ isRunning: boolean; port: number } | null> {
		try {
			const res = await fetch('/api/wigletotak/status');
			return res.ok ? ((await res.json()) as { isRunning: boolean; port: number }) : null;
		} catch {
			return null;
		}
	}

	onMount(async () => {
		const host = window.location.hostname;
		const data = await fetchStatus();
		if (data?.isRunning) {
			iframeUrl = `http://${host}:${data.port}/`;
			serviceStatus = 'running';
		} else {
			serviceStatus = 'stopped';
		}
	});

	function goBack() {
		activeView.set('map');
	}
</script>

<ToolViewWrapper title="WigleToTAK" onBack={goBack}>
	{#if serviceStatus === 'checking'}
		<div class="wtt-status">
			<p class="status-label">CONNECTING...</p>
		</div>
	{:else if serviceStatus === 'stopped'}
		<div class="wtt-status">
			<p class="status-label">WIGLETOTAK OFFLINE</p>
			<p class="status-detail">Start the service from the navigation panel first.</p>
		</div>
	{:else if iframeUrl}
		<iframe
			src={iframeUrl}
			title="WigleToTAK"
			class="wtt-iframe"
			sandbox="allow-scripts allow-same-origin allow-forms"
		></iframe>
	{/if}
</ToolViewWrapper>

<style>
	.wtt-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--background);
	}

	.wtt-status {
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

	.status-detail {
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		color: var(--muted-foreground);
		text-align: center;
	}
</style>
