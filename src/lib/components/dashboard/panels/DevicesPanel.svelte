<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#999 — Band filter chips, back button, and whitelist remove use custom 24x20px sizing incompatible with shadcn Button -->
<script lang="ts">
	import { getContext } from 'svelte';

	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import type { KismetDevice } from '$lib/kismet/types';
	import {
		activeBands,
		isolatedDeviceMAC,
		isolateDevice,
		toggleBand as toggleGlobalBand
	} from '$lib/stores/dashboard/dashboard-store';
	import { kismetStore, setWhitelistMAC } from '$lib/stores/tactical-map/kismet-store';
	import { getSignalHex, signalBands } from '$lib/utils/signal-utils';

	import { filterAndSortDevices, type SortColumn } from './devices/device-filters';
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
	} from './devices/device-formatters';

	const dashboardMap = getContext<
		{ flyTo: (lat: number, lon: number, zoom?: number) => void } | undefined
	>('dashboardMap');

	let searchQuery = $state('');
	let whitelistInput = $state('');
	let whitelistedMACs: string[] = $state([]);
	let sortColumn: SortColumn = $state('rssi');
	let sortDirection: 'asc' | 'desc' = $state('desc');
	let selectedMAC: string | null = $state(null);
	let expandedMAC: string | null = $state(null);
	let shouldHideNoSignal = $state(true);
	let shouldShowOnlyWithClients = $state(false);

	function handleSort(col: SortColumn) {
		if (sortColumn === col) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = col;
			sortDirection = col === 'mac' ? 'asc' : 'desc';
		}
	}

	function addToWhitelist() {
		const mac = whitelistInput.trim().toUpperCase();
		if (mac && !whitelistedMACs.includes(mac)) {
			whitelistedMACs = [...whitelistedMACs, mac];
			setWhitelistMAC(mac);
			whitelistInput = '';
		}
	}

	function removeFromWhitelist(mac: string) {
		whitelistedMACs = whitelistedMACs.filter((m) => m !== mac);
	}

	function handleRowClick(device: KismetDevice) {
		if (device.clients?.length) {
			if ($isolatedDeviceMAC === device.mac) {
				isolateDevice(null);
				selectedMAC = null;
				expandedMAC = null;
			} else {
				isolateDevice(device.mac);
				selectedMAC = device.mac;
				expandedMAC = device.mac;
			}
		} else if (device.parentAP) {
			if ($isolatedDeviceMAC === device.parentAP) {
				isolateDevice(null);
				selectedMAC = null;
				expandedMAC = null;
			} else {
				isolateDevice(device.parentAP);
				selectedMAC = device.mac;
			}
		} else {
			if (selectedMAC === device.mac) {
				selectedMAC = null;
				expandedMAC = null;
			} else {
				selectedMAC = device.mac;
				expandedMAC = expandedMAC === device.mac ? null : device.mac;
			}
		}
		const lat = device.location?.lat;
		const lon = device.location?.lon;
		if (lat && lon && dashboardMap) dashboardMap.flyTo(lat, lon, 17);
	}

	function lookupDevice(mac: string): KismetDevice | undefined {
		return $kismetStore.devices.get(mac);
	}

	function si(col: string): string {
		return getSortIndicator(sortColumn, sortDirection, col);
	}

	let devices = $derived(
		filterAndSortDevices($kismetStore.devices, $isolatedDeviceMAC, {
			searchQuery,
			shouldHideNoSignal,
			shouldShowOnlyWithClients,
			activeBands: $activeBands,
			sortColumn,
			sortDirection
		})
	);

	// Clear isolation if the isolated AP no longer exists
	$effect(() => {
		const iso = $isolatedDeviceMAC;
		if (iso && !$kismetStore.devices.has(iso)) isolateDevice(null);
	});

	let apsWithClientsCount = $derived.by(() => {
		let count = 0;
		$kismetStore.devices.forEach((d) => {
			if (d.clients && d.clients.length > 0) count++;
		});
		return count;
	});
</script>

<div class="devices-panel">
	<!-- Toolbar row -->
	<div class="panel-toolbar">
		<span class="panel-title">DEVICES</span>
		<span class="device-count">{devices.length}</span>

		{#if $isolatedDeviceMAC}
			<button
				class="back-btn"
				onclick={() => {
					isolateDevice(null);
					selectedMAC = null;
					expandedMAC = null;
				}}
				title="Back to all devices"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg
				>
				All
			</button>
		{/if}

		<div class="toolbar-separator"></div>

		<Input
			class="toolbar-search h-7 text-xs"
			type="text"
			placeholder="Search MAC, SSID, manufacturer..."
			bind:value={searchQuery}
		/>

		<div class="toolbar-separator"></div>

		<div class="band-filters">
			{#each signalBands as band (band.key)}
				<button
					class="band-chip"
					class:hidden-band={!$activeBands.has(band.key)}
					onclick={() => toggleGlobalBand(band.key)}
					title={band.label}
				>
					<span class="band-dot" style="background: var({band.cssVar})"></span>
				</button>
			{/each}
			<button
				class="band-chip no-signal-chip"
				class:hidden-band={shouldHideNoSignal}
				onclick={() => (shouldHideNoSignal = !shouldHideNoSignal)}
				title={shouldHideNoSignal
					? 'Show devices without signal'
					: 'Hide devices without signal'}
			>
				<span class="no-signal-label">--</span>
			</button>
			<button
				class="band-chip multi-client-chip"
				class:active-filter={shouldShowOnlyWithClients}
				onclick={() => (shouldShowOnlyWithClients = !shouldShowOnlyWithClients)}
				title={shouldShowOnlyWithClients
					? 'Show all devices'
					: 'Show only APs with connected clients'}
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					><circle cx="12" cy="5" r="3" /><line x1="12" y1="8" x2="12" y2="14" /><line
						x1="12"
						y1="14"
						x2="6"
						y2="20"
					/><line x1="12" y1="14" x2="18" y2="20" /></svg
				>
				{#if apsWithClientsCount > 0}
					<span class="filter-badge">{apsWithClientsCount}</span>
				{/if}
			</button>
		</div>
	</div>

	<!-- Device table -->
	<div class="table-scroll">
		<table class="data-table data-table-compact">
			<thead>
				<tr>
					<th onclick={() => handleSort('mac')} class="sortable col-mac"
						>MAC / SSID{si('mac')}</th
					>
					<th onclick={() => handleSort('rssi')} class="sortable col-rssi"
						>RSSI{si('rssi')}</th
					>
					<th onclick={() => handleSort('type')} class="sortable col-type"
						>TYPE{si('type')}</th
					>
					<th class="col-vendor">VENDOR</th>
					<th onclick={() => handleSort('channel')} class="sortable col-ch"
						>CH{si('channel')}</th
					>
					<th class="col-freq">FREQ</th>
					<th class="col-enc">ENC</th>
					<th onclick={() => handleSort('packets')} class="sortable col-pkts"
						>PKTS{si('packets')}</th
					>
					<th onclick={() => handleSort('data')} class="sortable col-data"
						>DATA{si('data')}</th
					>
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
						onclick={() => handleRowClick(device)}
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
											class:expanded={expandedMAC === device.mac}
											>&#8250;</span
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
								<span
									class="signal-indicator"
									style="background: {getSignalHex(rssi)}"
								></span>
								<span class="rssi-value">{rssi !== 0 ? rssi : '-'}</span>
							</div>
						</td>
						<td class="col-type">
							<span class="type-badge">{device.type || '-'}</span>
						</td>
						<td class="col-vendor">
							<span class="vendor-text"
								>{device.manufacturer || device.manuf || '-'}</span
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
						{#if device.clients?.length}
							{#each device.clients as clientMac (clientMac)}
								{@const client = lookupDevice(clientMac)}
								{@const clientRssi = client ? getRSSI(client) : 0}
								<tr
									class="sub-row"
									onclick={(e) => {
										e.stopPropagation();
										if (client) handleRowClick(client);
									}}
								>
									<td class="col-mac">
										<div class="cell-stack sub-cell">
											<span class="cell-primary"
												>{client?.ssid || 'Hidden'}</span
											>
											<span class="cell-secondary">{clientMac}</span>
										</div>
									</td>
									<td class="col-rssi">
										<div class="rssi-cell">
											<span
												class="signal-indicator"
												style="background: {getSignalHex(clientRssi)}"
											></span>
											<span class="rssi-value"
												>{clientRssi !== 0 ? clientRssi : '-'}</span
											>
										</div>
									</td>
									<td class="col-type">
										<span class="type-badge">{client?.type || 'Client'}</span>
									</td>
									<td class="col-vendor">
										<span class="vendor-text"
											>{client?.manufacturer || client?.manuf || '-'}</span
										>
									</td>
									<td class="col-ch">
										<span class="mono-value">{client?.channel || '-'}</span>
									</td>
									<td class="col-freq">
										<span class="mono-value"
											>{formatFreq(client?.frequency || 0)}</span
										>
									</td>
									<td class="col-enc">
										<span class="enc-badge"
											>{client ? formatEncryption(client) : '-'}</span
										>
									</td>
									<td class="col-pkts">
										<span class="mono-value"
											>{formatPackets(client?.packets || 0)}</span
										>
									</td>
									<td class="col-data">
										<span class="mono-value"
											>{formatDataSize(
												client?.datasize || client?.dataSize || 0
											)}</span
										>
									</td>
									<td class="col-first">
										<span class="mono-value"
											>{client ? formatFirstSeen(client) : '-'}</span
										>
									</td>
									<td class="col-seen">
										<span class="mono-value"
											>{client ? formatLastSeen(client) : '-'}</span
										>
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
									if (ap) handleRowClick(ap);
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
										<span
											class="signal-indicator"
											style="background: {getSignalHex(apRssi)}"
										></span>
										<span class="rssi-value">{apRssi !== 0 ? apRssi : '-'}</span
										>
									</div>
								</td>
								<td class="col-type">
									<span class="type-badge">{ap?.type || 'AP'}</span>
								</td>
								<td class="col-vendor">
									<span class="vendor-text"
										>{ap?.manufacturer || ap?.manuf || '-'}</span
									>
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
									<span class="mono-value">{formatPackets(ap?.packets || 0)}</span
									>
								</td>
								<td class="col-data">
									<span class="mono-value"
										>{formatDataSize(ap?.datasize || ap?.dataSize || 0)}</span
									>
								</td>
								<td class="col-first">
									<span class="mono-value">{ap ? formatFirstSeen(ap) : '-'}</span>
								</td>
								<td class="col-seen">
									<span class="mono-value">{ap ? formatLastSeen(ap) : '-'}</span>
								</td>
							</tr>
						{/if}
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

	<!-- Whitelist -->
	<section class="whitelist-section">
		<div class="section-label">WHITELIST ({whitelistedMACs.length})</div>

		<div class="whitelist-input-row">
			<Input
				class="h-7 text-xs flex-1"
				type="text"
				placeholder="MAC address..."
				bind:value={whitelistInput}
				onkeydown={(e) => e.key === 'Enter' && addToWhitelist()}
			/>
			<Button variant="secondary" size="sm" onclick={addToWhitelist}>Add</Button>
		</div>

		{#if whitelistedMACs.length > 0}
			<div class="whitelist-items">
				{#each whitelistedMACs as mac (mac)}
					<div class="whitelist-item">
						<span class="whitelist-mac">{mac}</span>
						<button class="whitelist-remove" onclick={() => removeFromWhitelist(mac)}>
							<svg
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<line x1="18" y1="6" x2="6" y2="18" /><line
									x1="6"
									y1="6"
									x2="18"
									y2="18"
								/>
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.devices-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--palantir-bg-surface);
	}

	.panel-toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--palantir-border-subtle);
		flex-shrink: 0;
	}

	.panel-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-secondary);
	}

	.device-count {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-accent);
		font-variant-numeric: tabular-nums;
	}

	.back-btn {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		background: color-mix(in srgb, var(--palantir-accent) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--palantir-accent) 25%, transparent);
		border-radius: var(--radius-sm);
		color: var(--palantir-accent);
		font-size: 10px;
		font-weight: var(--font-weight-semibold);
		padding: 2px 6px;
		cursor: pointer;
		letter-spacing: var(--letter-spacing-wide);
	}

	.back-btn:hover {
		background: color-mix(in srgb, var(--palantir-accent) 20%, transparent);
	}

	.toolbar-separator {
		width: 1px;
		height: 16px;
		background: var(--palantir-border-subtle);
		flex-shrink: 0;
	}

	.toolbar-search {
		flex: 1;
		min-width: 120px;
	}

	.band-filters {
		display: flex;
		gap: var(--space-1);
		align-items: center;
		flex-shrink: 0;
	}

	.band-chip {
		width: 24px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--palantir-border-subtle);
		border-radius: var(--radius-sm);
		background: transparent;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.band-chip.hidden-band {
		opacity: 0.25;
	}

	.band-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.no-signal-chip {
		margin-left: 2px;
	}

	.no-signal-label {
		font-size: 10px;
		font-weight: var(--font-weight-semibold);
		color: var(--palantir-text-tertiary);
		line-height: 1;
	}

	.multi-client-chip {
		position: relative;
		width: auto;
		padding: 0 4px;
		gap: 2px;
		color: var(--palantir-text-tertiary);
	}

	.multi-client-chip.active-filter {
		opacity: 1;
		border-color: var(--palantir-accent);
		color: var(--palantir-accent);
		background: color-mix(in srgb, var(--palantir-accent) 10%, transparent);
	}

	.filter-badge {
		font-family: var(--font-mono);
		font-size: 8px;
		color: var(--palantir-accent);
		line-height: 1;
	}

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
		background: var(--palantir-bg-elevated);
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-wider);
		color: var(--palantir-text-tertiary);
		text-align: left;
		padding: var(--space-2) var(--space-2);
		border-bottom: 1px solid var(--palantir-border-default);
		white-space: nowrap;
	}

	td {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	tbody tr:hover {
		background: var(--palantir-bg-hover);
	}

	.sortable {
		cursor: pointer;
		user-select: none;
	}

	.sortable:hover {
		color: var(--palantir-text-secondary);
	}

	/* Column widths */
	.col-mac {
		min-width: 160px;
	}
	.col-rssi {
		min-width: 62px;
		white-space: nowrap;
	}
	.col-type {
		min-width: 52px;
		white-space: nowrap;
	}
	.col-vendor {
		min-width: 80px;
		max-width: 140px;
	}
	.col-ch {
		min-width: 30px;
		text-align: center;
		white-space: nowrap;
	}
	.col-freq {
		min-width: 44px;
		white-space: nowrap;
	}
	.col-enc {
		min-width: 50px;
		white-space: nowrap;
	}
	.col-pkts {
		min-width: 44px;
		text-align: right;
		white-space: nowrap;
	}
	.col-data {
		min-width: 44px;
		text-align: right;
		white-space: nowrap;
	}
	.col-first {
		min-width: 40px;
		text-align: right;
		white-space: nowrap;
	}
	.col-seen {
		min-width: 40px;
		text-align: right;
		white-space: nowrap;
	}

	.cell-stack {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.cell-primary {
		font-size: var(--text-xs);
		color: var(--palantir-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cell-secondary {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--palantir-text-tertiary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rssi-cell {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.signal-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.rssi-value {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}

	.type-badge {
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--palantir-text-secondary);
	}

	.vendor-text {
		font-size: 10px;
		color: var(--palantir-text-tertiary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: block;
		max-width: 160px;
	}

	.mono-value {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--palantir-text-tertiary);
		font-variant-numeric: tabular-nums;
	}

	.enc-badge {
		font-size: 10px;
		color: var(--palantir-text-tertiary);
		letter-spacing: 0.02em;
	}

	.row-chevron {
		display: inline-block;
		font-size: 11px;
		color: var(--palantir-text-tertiary);
		transition: transform 0.15s ease;
		margin-right: 2px;
	}

	.row-chevron.expanded {
		transform: rotate(90deg);
	}

	.client-count {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--palantir-accent);
		background: color-mix(in srgb, var(--palantir-accent) 15%, transparent);
		padding: 0 4px;
		border-radius: 3px;
		margin-left: 4px;
		vertical-align: middle;
	}

	.sub-row {
		background: var(--palantir-bg-elevated);
	}

	.sub-row td {
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

	.isolated-parent {
		background: color-mix(in srgb, var(--palantir-accent) 6%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--palantir-accent) 15%, transparent);
	}

	.empty-row {
		text-align: center;
		color: var(--palantir-text-tertiary);
		font-style: italic;
		padding: var(--space-6) var(--space-3) !important;
	}

	/* Whitelist */
	.whitelist-section {
		padding: var(--space-3);
		border-top: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	.section-label {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
	}

	.whitelist-input-row {
		display: flex;
		gap: var(--space-2);
	}

	.whitelist-items {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.whitelist-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-1) var(--space-2);
		background: var(--palantir-bg-elevated);
		border-radius: var(--radius-sm);
	}

	.whitelist-mac {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-primary);
	}

	.whitelist-remove {
		background: none;
		border: none;
		color: var(--palantir-text-tertiary);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
	}

	.whitelist-remove:hover {
		color: var(--palantir-error);
	}
</style>
