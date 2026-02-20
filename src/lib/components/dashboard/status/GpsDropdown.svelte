<script lang="ts">
	import type { Satellite } from '$lib/gps/types';

	import { type DeviceState, fetchSatelliteData, type GpsInfo } from './status-bar-data';

	interface Props {
		deviceState: DeviceState;
		info: GpsInfo;
		sats: number;
		fix: number;
		speed: number | null;
		accuracy: number | null;
		open: boolean;
		onToggle: () => void;
	}

	let { deviceState, info, sats, fix, speed, accuracy, open, onToggle }: Props = $props();

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

<div class="device-wrapper">
	<div class="status-item device-btn" onclick={onToggle} role="button" tabindex="0">
		<span
			class="status-dot"
			class:dot-active={deviceState === 'active'}
			class:dot-standby={deviceState === 'standby'}
			class:dot-offline={deviceState === 'offline'}
		></span>
		<span class="status-label">GPS</span>
		<span class="sat-count">{sats} SAT</span>
	</div>
	{#if open}
		<div class="device-dropdown">
			<div class="dropdown-title">GPS RECEIVER</div>
			{#if deviceState === 'offline'}
				<div class="dropdown-row">
					<span class="dropdown-key">Status</span><span class="dropdown-val dim"
						>Not available</span
					>
				</div>
			{:else}
				<div class="dropdown-row">
					<span class="dropdown-key">Fix</span><span
						class="dropdown-val"
						class:accent={fix >= 2}
						>{fix === 3 ? '3D Fix' : fix === 2 ? '2D Fix' : 'No Fix'}</span
					>
				</div>
				<div
					class="dropdown-row satellites-toggle"
					onclick={() => (satellitesExpanded = !satellitesExpanded)}
					role="button"
					tabindex="0"
				>
					<span class="dropdown-key">Satellites</span><span class="dropdown-val"
						>{sats}
						<span class="expand-icon" class:expanded={satellitesExpanded}>&#9660;</span
						></span
					>
				</div>
				{#if satellitesExpanded && satelliteData.length > 0}
					<div class="satellites-list">
						{#each satelliteData as sat}
							<div class="dropdown-row satellite-item">
								<span class="dropdown-key">PRN {sat.prn} ({sat.constellation})</span
								><span class="dropdown-val">{sat.snr} dB</span>
							</div>
						{/each}
						<div class="dropdown-divider"></div>
						<div class="dropdown-row">
							<span class="dropdown-key">Used for Fix</span><span
								class="dropdown-val accent">{satelliteUsedCount}</span
							>
						</div>
					</div>
				{/if}
				{#if speed !== null}<div class="dropdown-row">
						<span class="dropdown-key">Speed</span><span class="dropdown-val"
							>{speed.toFixed(1)} m/s</span
						>
					</div>{/if}
				{#if accuracy !== null}<div class="dropdown-row">
						<span class="dropdown-key">Accuracy</span><span class="dropdown-val"
							>{accuracy.toFixed(1)} m</span
						>
					</div>{/if}
				{#if info.device}<div class="dropdown-divider"></div>
					<div class="dropdown-row">
						<span class="dropdown-key">Device</span><span class="dropdown-val"
							>{info.device}</span
						>
					</div>{/if}
				{#if info.protocol}<div class="dropdown-row">
						<span class="dropdown-key">Protocol</span><span class="dropdown-val"
							>{info.protocol}</span
						>
					</div>{/if}
				{#if info.baudRate}<div class="dropdown-row">
						<span class="dropdown-key">Baud</span><span class="dropdown-val"
							>{info.baudRate}</span
						>
					</div>{/if}
				{#if info.usbAdapter}<div class="dropdown-row">
						<span class="dropdown-key">Adapter</span><span class="dropdown-val"
							>{info.usbAdapter}</span
						>
					</div>{/if}
				{#if info.gpsdVersion}<div class="dropdown-row">
						<span class="dropdown-key">GPSD</span><span class="dropdown-val"
							>v{info.gpsdVersion}</span
						>
					</div>{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.device-wrapper {
		position: relative;
	}
	.status-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--palantir-text-secondary);
	}
	.device-btn {
		cursor: pointer;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		transition: background 0.15s ease;
	}
	.device-btn:hover {
		background: var(--palantir-bg-hover);
	}
	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.dot-active {
		background: var(--palantir-success);
		box-shadow: 0 0 4px color-mix(in srgb, var(--palantir-success) 50%, transparent);
	}
	.dot-standby {
		background: var(--palantir-warning);
		box-shadow: 0 0 4px color-mix(in srgb, var(--palantir-warning) 40%, transparent);
	}
	.dot-offline {
		background: var(--palantir-text-tertiary);
	}
	.status-label {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		letter-spacing: var(--letter-spacing-wide);
		white-space: nowrap;
	}
	.sat-count {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
		letter-spacing: var(--letter-spacing-wide);
		margin-left: var(--space-1);
		font-variant-numeric: tabular-nums;
	}
	.device-dropdown {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		min-width: 260px;
		background: var(--palantir-bg-panel);
		border: 1px solid var(--palantir-border-default);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.dropdown-title {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
		padding-bottom: var(--space-1);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}
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
	.dropdown-val.dim {
		color: var(--palantir-text-tertiary);
		font-style: italic;
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
		font-size: 10px;
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
		font-size: 10px;
	}

	@media (max-width: 900px) {
		.status-label {
			font-size: 11px;
		}
	}
	@media (max-width: 767px) {
		.status-label {
			font-size: 10px;
		}
		.sat-count {
			display: none;
		}
	}
	@media (max-width: 599px) {
		.status-label {
			display: none;
		}
	}
	@media (max-width: 479px) {
		.status-dot {
			width: 10px;
			height: 10px;
		}
		.device-btn {
			padding: 8px;
			min-width: 44px;
			min-height: 44px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>
