<script lang="ts">
	import { type DeviceState, formatSerial, type SdrInfo } from './status-bar-data';

	interface Props {
		deviceState: DeviceState;
		info: SdrInfo;
		open: boolean;
		onToggle: () => void;
	}

	let { deviceState, info, open, onToggle }: Props = $props();
</script>

<div class="device-wrapper">
	<div
		class="status-item device-btn"
		onclick={onToggle}
		role="button"
		tabindex="0"
		title="Software Defined Radio"
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
			<div class="dropdown-title">SOFTWARE DEFINED RADIO</div>
			{#if deviceState === 'offline'}
				<div class="dropdown-row">
					<span class="dropdown-key">Status</span><span class="dropdown-val dim"
						>Not detected</span
					>
				</div>
			{:else}
				{#if info.manufacturer}<div class="dropdown-row">
						<span class="dropdown-key">Make</span><span class="dropdown-val"
							>{info.manufacturer}</span
						>
					</div>{/if}
				{#if info.product}<div class="dropdown-row">
						<span class="dropdown-key">Model</span><span class="dropdown-val"
							>{info.product}</span
						>
					</div>{/if}
				{#if info.serial}<div class="dropdown-row">
						<span class="dropdown-key">Serial</span><span class="dropdown-val"
							>{formatSerial(info.serial)}</span
						>
					</div>{/if}
				{#if info.firmwareApi}<div class="dropdown-row">
						<span class="dropdown-key">FW API</span><span class="dropdown-val"
							>{info.firmwareApi}</span
						>
					</div>{/if}
				{#if info.usbSpeed}<div class="dropdown-row">
						<span class="dropdown-key">USB</span><span class="dropdown-val"
							>{info.usbSpeed}</span
						>
					</div>{/if}
				{#if info.maxPower}<div class="dropdown-row">
						<span class="dropdown-key">Power</span><span class="dropdown-val"
							>{info.maxPower}</span
						>
					</div>{/if}
				{#if info.configuration}<div class="dropdown-row">
						<span class="dropdown-key">Mode</span><span class="dropdown-val"
							>{info.configuration}</span
						>
					</div>{/if}
				{#if info.owner}<div class="dropdown-row">
						<span class="dropdown-key">Used by</span><span class="dropdown-val accent"
							>{info.owner}</span
						>
					</div>{/if}
				{#if !info.owner}<div class="dropdown-row">
						<span class="dropdown-key">Status</span><span class="dropdown-val dim"
							>Idle</span
						>
					</div>{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	@import './dropdown.css';
</style>
