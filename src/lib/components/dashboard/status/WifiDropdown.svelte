<script lang="ts">
	import type { DeviceState, WifiInfo } from './status-bar-data';

	interface Props {
		deviceState: DeviceState;
		info: WifiInfo;
		open: boolean;
		onToggle: () => void;
	}

	let { deviceState, info, open, onToggle }: Props = $props();
</script>

<div class="device-wrapper">
	<div class="status-item device-btn" onclick={onToggle} role="button" tabindex="0">
		<span
			class="status-dot"
			class:dot-active={deviceState === 'active'}
			class:dot-standby={deviceState === 'standby'}
			class:dot-offline={deviceState === 'offline'}
		></span>
		<span class="status-label">WiFi Adapter</span>
	</div>
	{#if open}
		<div class="device-dropdown">
			<div class="dropdown-title">WIFI ADAPTER</div>
			{#if deviceState === 'offline'}
				<div class="dropdown-row">
					<span class="dropdown-key">Status</span><span class="dropdown-val dim"
						>Not detected</span
					>
				</div>
			{:else}
				{#if info.chipset}<div class="dropdown-row">
						<span class="dropdown-key">Chipset</span><span class="dropdown-val"
							>{info.chipset}</span
						>
					</div>{/if}
				{#if info.mac}<div class="dropdown-row">
						<span class="dropdown-key">MAC</span><span class="dropdown-val"
							>{info.mac}</span
						>
					</div>{/if}
				{#if info.driver}<div class="dropdown-row">
						<span class="dropdown-key">Driver</span><span class="dropdown-val"
							>{info.driver}</span
						>
					</div>{/if}
				<div class="dropdown-row">
					<span class="dropdown-key">Interface</span><span class="dropdown-val"
						>{info.monitorInterface || info.interface || '—'}</span
					>
				</div>
				{#if info.mode}<div class="dropdown-row">
						<span class="dropdown-key">Mode</span><span class="dropdown-val"
							>{info.mode}</span
						>
					</div>{/if}
				{#if info.channel}<div class="dropdown-row">
						<span class="dropdown-key">Channel</span><span class="dropdown-val"
							>{info.channel}</span
						>
					</div>{/if}
				{#if info.bands && info.bands.length > 0}<div class="dropdown-row">
						<span class="dropdown-key">Bands</span><span class="dropdown-val"
							>{info.bands.join(', ')}</span
						>
					</div>{/if}
				{#if info.owner}<div class="dropdown-row">
						<span class="dropdown-key">Used by</span><span class="dropdown-val accent"
							>{info.owner}</span
						>
					</div>{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	@import './dropdown.css';
</style>
