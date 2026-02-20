<script lang="ts">
	import type { GPSStatus } from '$lib/stores/tactical-map/gps-store';

	interface Props {
		status: GPSStatus;
	}

	let { status }: Props = $props();
</script>

<section class="panel-section">
	<div class="section-label">GPS POSITION</div>
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
		border-bottom: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.section-label {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
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
		color: var(--palantir-text-tertiary);
		letter-spacing: var(--letter-spacing-wider);
	}

	.info-value {
		font-size: var(--text-sm);
		color: var(--palantir-text-primary);
	}

	.info-value.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.no-data {
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
		font-style: italic;
	}
</style>
