<script lang="ts">
	import type { KismetDevice } from '$lib/kismet/types';
	import { kismetStore } from '$lib/stores/tactical-map/kismet-store';
	import { getSignalHex } from '$lib/utils/signal-utils';

	import {
		formatDataSize,
		formatEncryption,
		formatFirstSeen,
		formatFreq,
		formatLastSeen,
		formatPackets,
		getRSSI
	} from './device-formatters';

	interface Props {
		device: KismetDevice;
		onRowClick: (device: KismetDevice) => void;
	}

	let { device, onRowClick }: Props = $props();

	function lookupDevice(mac: string): KismetDevice | undefined {
		return $kismetStore.devices.get(mac);
	}
</script>

{#if device.clients?.length}
	{#each device.clients as clientMac (clientMac)}
		{@const client = lookupDevice(clientMac)}
		{@const clientRssi = client ? getRSSI(client) : 0}
		<tr
			class="sub-row"
			onclick={(e) => {
				e.stopPropagation();
				if (client) onRowClick(client);
			}}
		>
			<td class="col-mac">
				<div class="cell-stack sub-cell">
					<span class="cell-primary">{client?.ssid || 'Hidden'}</span>
					<span class="cell-secondary">{clientMac}</span>
				</div>
			</td>
			<td class="col-rssi">
				<div class="rssi-cell">
					<span class="signal-indicator" style="background: {getSignalHex(clientRssi)}"
					></span>
					<span class="rssi-value">{clientRssi !== 0 ? clientRssi : '-'}</span>
				</div>
			</td>
			<td class="col-type">
				<span class="type-badge">{client?.type || 'Client'}</span>
			</td>
			<td class="col-vendor">
				<span class="vendor-text">{client?.manufacturer || client?.manuf || '-'}</span>
			</td>
			<td class="col-ch">
				<span class="mono-value">{client?.channel || '-'}</span>
			</td>
			<td class="col-freq">
				<span class="mono-value">{formatFreq(client?.frequency || 0)}</span>
			</td>
			<td class="col-enc">
				<span class="enc-badge">{client ? formatEncryption(client) : '-'}</span>
			</td>
			<td class="col-pkts">
				<span class="mono-value">{formatPackets(client?.packets || 0)}</span>
			</td>
			<td class="col-data">
				<span class="mono-value"
					>{formatDataSize(client?.datasize || client?.dataSize || 0)}</span
				>
			</td>
			<td class="col-first">
				<span class="mono-value">{client ? formatFirstSeen(client) : '-'}</span>
			</td>
			<td class="col-seen">
				<span class="mono-value">{client ? formatLastSeen(client) : '-'}</span>
			</td>
		</tr>
	{/each}
{/if}
{#if device.parentAP}
	{@const ap = lookupDevice(device.parentAP)}
	{@const apRssi = ap ? getRSSI(ap) : 0}
	<tr
		class="sub-row sub-row-parent"
		onclick={(e) => {
			e.stopPropagation();
			if (ap) onRowClick(ap);
		}}
	>
		<td class="col-mac">
			<div class="cell-stack sub-cell">
				<span class="sub-label">AP</span>
				<span class="cell-primary">{ap?.ssid || 'Hidden'}</span>
				<span class="cell-secondary">{device.parentAP}</span>
			</div>
		</td>
		<td class="col-rssi">
			<div class="rssi-cell">
				<span class="signal-indicator" style="background: {getSignalHex(apRssi)}"></span>
				<span class="rssi-value">{apRssi !== 0 ? apRssi : '-'}</span>
			</div>
		</td>
		<td class="col-type">
			<span class="type-badge">{ap?.type || 'AP'}</span>
		</td>
		<td class="col-vendor">
			<span class="vendor-text">{ap?.manufacturer || ap?.manuf || '-'}</span>
		</td>
		<td class="col-ch">
			<span class="mono-value">{ap?.channel || '-'}</span>
		</td>
		<td class="col-freq">
			<span class="mono-value">{formatFreq(ap?.frequency || 0)}</span>
		</td>
		<td class="col-enc">
			<span class="enc-badge">{ap ? formatEncryption(ap) : '-'}</span>
		</td>
		<td class="col-pkts">
			<span class="mono-value">{formatPackets(ap?.packets || 0)}</span>
		</td>
		<td class="col-data">
			<span class="mono-value">{formatDataSize(ap?.datasize || ap?.dataSize || 0)}</span>
		</td>
		<td class="col-first">
			<span class="mono-value">{ap ? formatFirstSeen(ap) : '-'}</span>
		</td>
		<td class="col-seen">
			<span class="mono-value">{ap ? formatLastSeen(ap) : '-'}</span>
		</td>
	</tr>
{/if}

<style>
	@import './device-table-cells.css';

	.sub-row {
		background: var(--palantir-bg-elevated);
	}

	.sub-row :global(td) {
		border-top: 1px solid rgba(255, 255, 255, 0.03);
	}

	.sub-cell {
		padding-left: var(--space-4);
	}

	.sub-label {
		font-size: 9px;
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-wide);
		color: var(--palantir-text-tertiary);
		text-transform: uppercase;
	}

	.sub-row-parent {
		border-top: 1px dashed rgba(255, 255, 255, 0.06);
	}
</style>
