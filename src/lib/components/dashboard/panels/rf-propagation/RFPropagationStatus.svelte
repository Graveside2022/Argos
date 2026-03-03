<script lang="ts">
	import { untrack } from 'svelte';

	import { computeProgress, isComputing } from '$lib/stores/dashboard/rf-propagation-store';
	import { fetchJSON } from '$lib/utils/fetch-json';

	interface StatusResponse {
		available: boolean;
		engine: 'cloudrf';
	}

	let status = $state<StatusResponse | null>(null);
	let hasError = $state(false);

	async function loadStatus(): Promise<void> {
		const res = await fetchJSON<StatusResponse>('/api/rf-propagation/status');
		if (res && typeof res.engine === 'string') {
			status = res;
			hasError = false;
		} else {
			hasError = true;
		}
	}

	$effect(() => {
		untrack(() => loadStatus());
	});
</script>

<section class="rf-status">
	<h3 class="section-label">RF PROPAGATION ENGINE</h3>

	{#if hasError}
		<span class="status-text error">Engine unavailable</span>
	{:else if !status}
		<span class="status-text">Loading status...</span>
	{:else}
		<div class="status-row">
			<span class="dot" class:active={status.available}></span>
			<span class="label">CloudRF Cloud</span>
			<span class="value" class:active={status.available}>
				{status.available ? 'Connected' : 'No API key'}
			</span>
		</div>
	{/if}

	{#if $isComputing}
		<div class="status-row" style="margin-top: 2px">
			<span class="dot computing"></span>
			<span class="progress-text">{$computeProgress || 'Computing...'}</span>
		</div>
	{/if}
</section>

<style>
	.rf-status {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-family: var(--font-mono, 'Fira Code', monospace);
	}
	.section-label {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground, #888888);
		margin: 0;
	}
	.status-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--muted-foreground, #555555);
	}
	.dot.active {
		background: #8bbfa0;
	}
	.dot.computing {
		background: #d4a054;
		animation: pulse 1.2s ease-in-out infinite;
	}
	.label {
		font-size: 11px;
		color: var(--foreground);
		flex: 1;
	}
	.value {
		font-size: 10px;
		color: var(--muted-foreground);
	}
	.value.active {
		color: #8bbfa0;
	}
	.status-text {
		font-size: 11px;
		color: var(--muted-foreground);
		font-style: italic;
	}
	.status-text.error {
		color: #ff5c33;
		font-style: normal;
	}
	.progress-text {
		font-size: 10px;
		color: #d4a054;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
