<script lang="ts">
	import type { DeviceState, HardwareDetailRow } from './types';

	interface Props {
		deviceId: string;
		displayName: string;
		device: DeviceState;
		details: HardwareDetailRow[];
		expanded: boolean;
		onToggle: (id: string) => void;
	}

	let { deviceId, displayName, device, details, expanded, onToggle }: Props = $props();
</script>

<button class="scan-row clickable" onclick={() => onToggle(deviceId)}>
	<span
		class="scan-dot"
		class:active={device.isDetected && device.owner}
		class:standby={device.isDetected && !device.owner}
	></span>
	<span class="scan-name">{displayName}</span>
	{#if !device.isDetected}
		<span class="scan-status-text">not found</span>
	{:else if device.owner}
		<span class="scan-owner">{device.owner}</span>
	{:else}
		<span class="scan-status-text available">available</span>
	{/if}
	<span class="row-chevron" class:expanded>&#8250;</span>
</button>
{#if expanded}
	<div class="detail-panel">
		{#each details as row (row.key)}
			<div class="detail-row">
				<span class="detail-key">{row.key}</span>
				<span
					class="detail-val"
					class:accent={row.className === 'accent'}
					class:dim={row.className === 'dim'}>{row.value}</span
				>
			</div>
		{/each}
	</div>
{/if}

<style>
	.scan-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--surface-elevated);
		border-radius: var(--radius-md);
		width: 100%;
		text-align: left;
	}

	.scan-row.clickable {
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.scan-row.clickable:hover {
		background: var(--surface-hover);
	}

	.scan-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--foreground-secondary);
		flex-shrink: 0;
	}

	.scan-dot.active {
		background: var(--success);
		box-shadow: 0 0 4px color-mix(in srgb, var(--success) 50%, transparent);
	}

	.scan-dot.standby {
		background: var(--warning);
		box-shadow: 0 0 4px color-mix(in srgb, var(--warning) 40%, transparent);
	}

	.scan-name {
		font-size: var(--text-sm);
		color: var(--foreground);
		flex: 1;
	}

	.scan-status-text {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--foreground-secondary);
	}

	.scan-status-text.available {
		color: var(--primary);
	}

	.scan-owner {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--success);
	}

	.row-chevron {
		font-size: var(--text-base);
		color: var(--foreground-secondary);
		flex-shrink: 0;
		transition: transform 0.15s ease;
	}

	.row-chevron.expanded {
		transform: rotate(90deg);
	}

	.detail-panel {
		margin-top: calc(-1 * var(--space-2));
		padding: var(--space-3);
		background: var(--surface-elevated);
		border-radius: 0 0 var(--radius-md) var(--radius-md);
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.detail-key {
		font-size: var(--text-xs);
		color: var(--foreground-secondary);
		white-space: nowrap;
	}

	.detail-val {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--foreground);
		text-align: right;
		word-break: break-all;
	}

	.detail-val.accent {
		color: var(--success);
	}

	.detail-val.dim {
		color: var(--foreground-secondary);
		font-style: italic;
	}
</style>
