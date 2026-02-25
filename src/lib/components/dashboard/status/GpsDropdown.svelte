<script lang="ts">
	import SatelliteTable from './SatelliteTable.svelte';
	import { type DeviceState, type GpsInfo } from './status-bar-data';

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
</script>

<div class="device-wrapper">
	<div
		class="status-item device-btn"
		onclick={onToggle}
		onkeydown={(e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				onToggle();
			}
		}}
		role="button"
		tabindex="0"
		title="GPS {sats} SAT"
	>
		<span
			class="status-dot"
			class:dot-active={deviceState === 'active'}
			class:dot-standby={deviceState === 'standby'}
			class:dot-offline={deviceState === 'offline'}
		></span>
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
				<SatelliteTable {open} {sats} />
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
	@import './dropdown.css';

	.sat-count {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: var(--text-sm, 12px);
		color: var(--foreground-tertiary, #999999);
		letter-spacing: 0.5px;
		margin-left: 2px;
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 767px) {
		.sat-count {
			display: none;
		}
	}
</style>
