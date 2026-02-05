<script lang="ts">
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';
</script>

<div class="gps-overlay">
	{#if $gpsStore.status.hasGPSFix}
		<div class="gps-row">
			<span class="gps-label">LAT</span>
			<span class="gps-value">{$gpsStore.status.formattedCoords.lat}</span>
		</div>
		<div class="gps-row">
			<span class="gps-label">LON</span>
			<span class="gps-value">{$gpsStore.status.formattedCoords.lon}</span>
		</div>
		<div class="gps-row">
			<span class="gps-label">MGRS</span>
			<span class="gps-value">{$gpsStore.status.mgrsCoord}</span>
		</div>
		<div class="gps-row">
			<span class="gps-label">FIX</span>
			<span class="gps-value"
				>{$gpsStore.status.fixType} ({$gpsStore.status.satellites} sats)</span
			>
		</div>
	{:else}
		<div class="gps-row">
			<span class="gps-label">GPS</span>
			<span class="gps-value gps-waiting">{$gpsStore.status.gpsStatus}</span>
		</div>
	{/if}
</div>

<style>
	.gps-overlay {
		position: absolute;
		top: var(--space-3);
		right: var(--space-3);
		background: rgba(28, 31, 38, 0.92);
		border: 1px solid var(--palantir-border-default);
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-3);
		z-index: 500;
		display: flex;
		flex-direction: column;
		gap: 2px;
		pointer-events: none;
	}

	.gps-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.gps-label {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-wider);
		color: var(--palantir-text-tertiary);
		min-width: 32px;
	}

	.gps-value {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-primary);
		font-variant-numeric: tabular-nums;
	}

	.gps-waiting {
		color: var(--palantir-text-secondary);
	}
</style>
