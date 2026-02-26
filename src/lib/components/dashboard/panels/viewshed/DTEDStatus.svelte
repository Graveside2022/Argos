<script lang="ts">
	import { onMount } from 'svelte';

	interface DTEDStatusResponse {
		loaded: boolean;
		tileCount: number;
		coverage: { north: number; south: number; east: number; west: number } | null;
		message?: string;
	}

	let status: DTEDStatusResponse | null = $state(null);
	let loading = $state(true);
	let error: string | null = $state(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/viewshed/status');
			if (!res.ok) {
				error = `Status API returned ${res.status}`;
				return;
			}
			status = await res.json();
		} catch {
			error = 'Could not reach viewshed API';
		} finally {
			loading = false;
		}
	});

	function formatCoverage(c: NonNullable<DTEDStatusResponse['coverage']>): string {
		return `${c.south.toFixed(0)}° to ${c.north.toFixed(0)}°N, ${c.west.toFixed(0)}° to ${c.east.toFixed(0)}°E`;
	}
</script>

<div class="dted-status">
	{#if loading}
		<span class="dted-label loading">Checking elevation data...</span>
	{:else if error}
		<span class="dted-label error">{error}</span>
	{:else if status?.loaded && status.coverage}
		<span class="dted-label ok">
			ELEVATION: {status.tileCount.toLocaleString()} tiles — {formatCoverage(status.coverage)}
		</span>
	{:else}
		<span class="dted-label warn">
			NO ELEVATION DATA — extract tiles with: extract-dted.sh
		</span>
	{/if}
</div>

<style>
	.dted-status {
		padding: 4px 0;
		font-family: 'Fira Code', monospace;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 1.2px;
	}
	.dted-label.ok {
		color: var(--success);
	}
	.dted-label.warn {
		color: var(--warning);
	}
	.dted-label.error {
		color: var(--error-desat);
	}
	.dted-label.loading {
		color: var(--foreground-secondary);
	}
</style>
