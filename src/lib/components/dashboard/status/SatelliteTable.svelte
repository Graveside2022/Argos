<script lang="ts">
	import type { Satellite } from '$lib/gps/types';

	import { fetchSatelliteData } from './status-bar-data';

	interface Props {
		open: boolean;
		sats: number;
	}

	let { open, sats }: Props = $props();

	let satellitesExpanded = $state(false);
	let satelliteData = $state<Satellite[]>([]);
	let satelliteUsedCount = $state(0);

	$effect(() => {
		if (open && satellitesExpanded) {
			void fetchSatelliteData().then((r) => {
				if (r) {
					satelliteData = r.satellites;
					satelliteUsedCount = r.usedCount;
				}
			});
			const interval = setInterval(
				() =>
					void fetchSatelliteData().then((r) => {
						if (r) {
							satelliteData = r.satellites;
							satelliteUsedCount = r.usedCount;
						}
					}),
				5000
			);
			return () => clearInterval(interval);
		}
	});
</script>

<div
	class="dropdown-row satellites-toggle"
	onclick={() => (satellitesExpanded = !satellitesExpanded)}
	onkeydown={(e: KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			satellitesExpanded = !satellitesExpanded;
		}
	}}
	role="button"
	tabindex="0"
>
	<span class="dropdown-key">Satellites</span><span class="dropdown-val"
		>{sats}
		<span class="expand-icon" class:expanded={satellitesExpanded}>&#9660;</span></span
	>
</div>
{#if satellitesExpanded && satelliteData.length > 0}
	<div class="satellites-list">
		{#each satelliteData as sat (sat.prn)}
			<div class="dropdown-row satellite-item">
				<span class="dropdown-key">PRN {sat.prn} ({sat.constellation})</span><span
					class="dropdown-val">{sat.snr} dB</span
				>
			</div>
		{/each}
		<div class="dropdown-divider"></div>
		<div class="dropdown-row">
			<span class="dropdown-key">Used for Fix</span><span class="dropdown-val accent"
				>{satelliteUsedCount}</span
			>
		</div>
	</div>
{/if}

<style>
	.dropdown-row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.dropdown-key {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		white-space: nowrap;
	}
	.dropdown-val {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-primary);
		text-align: right;
		word-break: break-all;
	}
	.dropdown-val.accent {
		color: var(--palantir-success);
	}
	.dropdown-divider {
		height: 1px;
		background: var(--palantir-border-subtle);
		margin: var(--space-1) 0;
	}
	.satellites-toggle {
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.satellites-toggle:hover {
		background: var(--palantir-bg-hover);
	}
	.expand-icon {
		display: inline-block;
		font-size: var(--text-status);
		margin-left: var(--space-1);
		transition: transform 0.2s ease;
		color: var(--palantir-text-tertiary);
	}
	.expand-icon.expanded {
		transform: rotate(180deg);
	}
	.satellites-list {
		padding-left: var(--space-2);
		margin-top: var(--space-1);
		animation: slideDown 0.2s ease;
	}
	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
		}
		to {
			opacity: 1;
			max-height: 500px;
		}
	}
	.satellite-item .dropdown-key,
	.satellite-item .dropdown-val {
		font-size: var(--text-status);
	}
</style>
