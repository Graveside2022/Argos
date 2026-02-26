<script lang="ts">
	import type { GPSStatus } from '$lib/stores/tactical-map/gps-store';

	interface Props {
		status: GPSStatus;
	}

	let { status }: Props = $props();
</script>

<section class="panel-section">
	<h3 class="section-header">GPS POSITION</h3>
	{#if status.hasGPSFix}
		<div class="info-grid">
			<div class="info-item">
				<span class="info-label">LAT</span>
				<span class="info-value mono">{status.formattedCoords.lat}</span>
			</div>
			<div class="info-item">
				<span class="info-label">LON</span>
				<span class="info-value mono">{status.formattedCoords.lon}</span>
			</div>
			<div class="info-item">
				<span class="info-label">MGRS</span>
				<span class="info-value mono">{status.mgrsCoord}</span>
			</div>
			<div class="info-item">
				<span class="info-label">FIX</span>
				<span class="info-value">{status.fixType} Fix</span>
			</div>
			<div class="info-item">
				<span class="info-label">SATS</span>
				<span class="info-value">{status.satellites}</span>
			</div>
			<div class="info-item">
				<span class="info-label">ACC</span>
				<span class="info-value">{status.accuracy.toFixed(1)}m</span>
			</div>
		</div>
	{:else}
		<div class="no-data">{status.gpsStatus}</div>
	{/if}
</section>

<style>
	.panel-section {
		padding: var(--space-4);
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.section-header {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
		margin: 0;
	}

	.info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.info-label {
		font-size: var(--text-xs);
		color: var(--foreground-secondary);
		letter-spacing: var(--letter-spacing-wider);
	}

	.info-value {
		font-size: var(--text-sm);
		color: var(--foreground);
	}

	.info-value.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.no-data {
		font-size: var(--text-sm);
		color: var(--foreground-secondary);
		font-style: italic;
	}
</style>
