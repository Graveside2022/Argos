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
	<div class="status-item device-btn" onclick={onToggle} role="button" tabindex="0">
		<span
			class="status-dot"
			class:dot-active={deviceState === 'active'}
			class:dot-standby={deviceState === 'standby'}
			class:dot-offline={deviceState === 'offline'}
		></span>
		<span class="status-label">Software Defined Radio</span>
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

	@media (max-width: 900px) {
		.status-label {
			font-size: 11px;
		}
	}
	@media (max-width: 767px) {
		.status-label {
			font-size: var(--text-status);
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
