<script lang="ts">
	import type { KismetDevice } from '$lib/kismet/types';
	import { isolatedDeviceMAC } from '$lib/stores/dashboard/dashboard-store';
	import { kismetStore } from '$lib/stores/tactical-map/kismet-store';
	import { getSignalHex } from '$lib/utils/signal-utils';

	import type { SortColumn } from './device-filters';
	import {
		formatDataSize,
		formatEncryption,
		formatFirstSeen,
		formatFreq,
		formatLastSeen,
		formatPackets,
		getRSSI,
		hasConnections,
		sortIndicator as getSortIndicator
	} from './device-formatters';
	import DeviceSubRows from './DeviceSubRows.svelte';

	interface Props {
		devices: KismetDevice[];
		selectedMAC: string | null;
		expandedMAC: string | null;
		sortColumn: SortColumn;
		sortDirection: 'asc' | 'desc';
		onSort: (col: SortColumn) => void;
		onRowClick: (device: KismetDevice) => void;
	}

	let {
		devices,
		selectedMAC,
		expandedMAC,
		sortColumn,
		sortDirection,
		onSort,
		onRowClick
	}: Props = $props();

	function si(col: string): string {
		return getSortIndicator(sortColumn, sortDirection, col);
	}
</script>

<div class="table-scroll">
	<table class="data-table data-table-compact">
		<thead>
			<tr>
				<th onclick={() => onSort('mac')} class="sortable col-mac">MAC / SSID{si('mac')}</th
				>
				<th onclick={() => onSort('rssi')} class="sortable col-rssi">RSSI{si('rssi')}</th>
				<th onclick={() => onSort('type')} class="sortable col-type">TYPE{si('type')}</th>
				<th class="col-vendor">VENDOR</th>
				<th onclick={() => onSort('channel')} class="sortable col-ch">CH{si('channel')}</th>
				<th class="col-freq">FREQ</th>
				<th class="col-enc">ENC</th>
				<th onclick={() => onSort('packets')} class="sortable col-pkts"
					>PKTS{si('packets')}</th
				>
				<th onclick={() => onSort('data')} class="sortable col-data">DATA{si('data')}</th>
				<th class="col-first">AGE</th>
				<th class="col-seen">LAST</th>
			</tr>
		</thead>
		<tbody>
			{#each devices as device (device.mac)}
				{@const rssi = getRSSI(device)}
				<tr
					class:selected={selectedMAC === device.mac}
					class:has-connections={hasConnections(device)}
					class:isolated-parent={$isolatedDeviceMAC === device.mac}
					onclick={() => onRowClick(device)}
				>
					<td class="col-mac">
						<div class="cell-stack">
							<span class="cell-primary">
								{#if device.clients?.length}
									<span
										class="row-chevron"
										class:expanded={expandedMAC === device.mac ||
											$isolatedDeviceMAC === device.mac}>&#8250;</span
									>
								{:else if device.parentAP}
									<span
										class="row-chevron"
										class:expanded={expandedMAC === device.mac}>&#8250;</span
									>
								{/if}
								{device.ssid || 'Hidden'}
								{#if device.clients?.length}
									<span class="client-count">{device.clients.length}</span>
								{/if}
							</span>
							<span class="cell-secondary">{device.mac}</span>
						</div>
					</td>
					<td class="col-rssi">
						<div class="rssi-cell">
							<span class="signal-indicator" style="background: {getSignalHex(rssi)}"
							></span>
							<span class="rssi-value">{rssi !== 0 ? rssi : '-'}</span>
						</div>
					</td>
					<td class="col-type">
						<span class="type-badge">{device.type || '-'}</span>
					</td>
					<td class="col-vendor">
						<span class="vendor-text">{device.manufacturer || device.manuf || '-'}</span
						>
					</td>
					<td class="col-ch">
						<span class="mono-value">{device.channel || '-'}</span>
					</td>
					<td class="col-freq">
						<span class="mono-value">{formatFreq(device.frequency)}</span>
					</td>
					<td class="col-enc">
						<span class="enc-badge">{formatEncryption(device)}</span>
					</td>
					<td class="col-pkts">
						<span class="mono-value">{formatPackets(device.packets)}</span>
					</td>
					<td class="col-data">
						<span class="mono-value"
							>{formatDataSize(device.datasize || device.dataSize || 0)}</span
						>
					</td>
					<td class="col-first">
						<span class="mono-value">{formatFirstSeen(device)}</span>
					</td>
					<td class="col-seen">
						<span class="mono-value">{formatLastSeen(device)}</span>
					</td>
				</tr>
				{#if !$isolatedDeviceMAC && expandedMAC === device.mac && hasConnections(device)}
					<DeviceSubRows {device} {onRowClick} />
				{/if}
			{:else}
				<tr>
					<td colspan="11" class="empty-row">
						{#if $kismetStore.status !== 'running'}
							Start Kismet to see devices
						{:else}
							No devices match filters
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	@import './device-table-cells.css';

	.table-scroll {
		flex: 1;
		overflow: auto;
	}

	table {
		width: max-content;
		min-width: 100%;
		border-collapse: collapse;
	}

	thead {
		position: sticky;
		top: 0;
		z-index: 1;
	}

	th {
		background: var(--surface-header, #181818);
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: var(--letter-spacing-wider);
		color: var(--foreground-secondary, #888888);
		text-align: left;
		padding: var(--space-2) var(--space-2);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border);
	}

	tbody tr:hover {
		background: var(--surface-hover, #1e1e1e);
	}

	tbody tr.selected {
		background: var(--surface-hover, #1e1e1e);
		border-left: 2px solid var(--interactive, #4a8af4);
	}

	.sortable {
		cursor: pointer;
		user-select: none;
	}

	.sortable:hover {
		color: var(--foreground-muted);
	}

	.row-chevron {
		display: inline-block;
		font-size: 11px;
		color: var(--foreground-secondary);
		transition: transform 0.15s ease;
		margin-right: 2px;
	}

	.row-chevron.expanded {
		transform: rotate(90deg);
	}

	.client-count {
		font-family: var(--font-mono);
		font-size: var(--text-section);
		color: var(--primary);
		background: color-mix(in srgb, var(--primary) 15%, transparent);
		padding: 0 4px;
		border-radius: 3px;
		margin-left: 4px;
		vertical-align: middle;
	}

	.isolated-parent {
		background: color-mix(in srgb, var(--primary) 6%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--primary) 15%, transparent);
	}

	.empty-row {
		text-align: center;
		color: var(--foreground-secondary);
		font-style: italic;
		padding: var(--space-6) var(--space-3) !important;
	}
</style>
