<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { getContext } from 'svelte';

	import type { KismetDevice } from '$lib/kismet/types';
	import { isolatedDeviceMAC, isolateDevice } from '$lib/stores/dashboard/dashboard-store';
	import { kismetStore, setWhitelistMAC } from '$lib/stores/tactical-map/kismet-store';
	import { getSignalBandKey, getSignalHex, signalBands } from '$lib/utils/signal-utils';

	const dashboardMap = getContext<
		{ flyTo: (lat: number, lon: number, zoom?: number) => void } | undefined
	>('dashboardMap');

	let searchQuery = $state('');
	let whitelistInput = $state('');
	let whitelistedMACs: string[] = $state([]);
	let sortColumn: 'mac' | 'rssi' | 'type' | 'channel' | 'packets' | 'data' = $state('rssi');
	let sortDirection: 'asc' | 'desc' = $state('desc');
	let selectedMAC: string | null = $state(null);
	let expandedMAC: string | null = $state(null);
	let hiddenBands = $state(new Set<string>());
	let hideNoSignal = $state(true);
	/** Filter to show only APs with connected clients */
	let showOnlyWithClients = $state(false);

	function toggleBand(key: string) {
		if (hiddenBands.has(key)) {
			hiddenBands.delete(key);
		} else {
			hiddenBands.add(key);
		}
		hiddenBands = new Set(hiddenBands);
	}

	function handleSort(col: typeof sortColumn) {
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
		// If clicking an AP that has clients, toggle isolation mode
		if (device.clients?.length) {
			if ($isolatedDeviceMAC === device.mac) {
				// Deselect — show all devices again
				isolateDevice(null);
				selectedMAC = null;
				expandedMAC = null;
			} else {
				isolateDevice(device.mac);
				selectedMAC = device.mac;
				expandedMAC = device.mac;
			}
		} else if (device.parentAP) {
			// Client device — isolate to its parent AP
			if ($isolatedDeviceMAC === device.parentAP) {
				isolateDevice(null);
				selectedMAC = null;
				expandedMAC = null;
			} else {
				isolateDevice(device.parentAP);
				selectedMAC = device.mac;
			}
		} else {
			// Regular device click
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
		if (lat && lon && dashboardMap) {
			dashboardMap.flyTo(lat, lon, 17);
		}
	}

	function hasConnections(device: KismetDevice): boolean {
		return !!(device.clients?.length || device.parentAP);
	}

	function lookupDevice(mac: string): KismetDevice | undefined {
		return $kismetStore.devices.get(mac);
	}

	/** Get RSSI value, treating 0 as no-signal */
	function getRSSI(device: KismetDevice): number {
		return device.signal?.last_signal ?? 0;
	}

	function formatFreq(freq: number): string {
		if (!freq) return '-';
		if (freq >= 1000000) return `${(freq / 1000000).toFixed(1)}G`;
		if (freq >= 1000) return `${(freq / 1000).toFixed(0)}M`;
		return `${freq}`;
	}

	function formatEncryption(device: KismetDevice): string {
		const enc = device.encryption || device.encryptionType;
		if (!enc || enc.length === 0) return '-';
		if (enc.length === 1 && enc[0] === 'Open') return 'Open';
		return enc.join('/');
	}

	function formatLastSeen(device: KismetDevice): string {
		const ts = device.lastSeen || device.last_seen || device.last_time || 0;
		if (!ts) return '-';
		const msTs = ts < 1e12 ? ts * 1000 : ts;
		const secs = Math.floor((Date.now() - msTs) / 1000);
		if (secs < 0 || isNaN(secs)) return '-';
		if (secs < 5) return 'now';
		if (secs < 60) return `${secs}s`;
		if (secs < 3600) return `${Math.floor(secs / 60)}m`;
		if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
		return `${Math.floor(secs / 86400)}d`;
	}

	function formatPackets(n: number): string {
		if (!n) return '-';
		if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
		if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
		return String(n);
	}

	function formatDataSize(bytes: number): string {
		if (!bytes) return '-';
		if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)}G`;
		if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)}M`;
		if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}K`;
		return `${bytes}B`;
	}

	function formatFirstSeen(device: KismetDevice): string {
		const ts = device.firstSeen || 0;
		if (!ts) return '-';
		const msTs = ts < 1e12 ? ts * 1000 : ts;
		const secs = Math.floor((Date.now() - msTs) / 1000);
		if (secs < 0 || isNaN(secs)) return '-';
		if (secs < 60) return `${secs}s`;
		if (secs < 3600) return `${Math.floor(secs / 60)}m`;
		if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
		return `${Math.floor(secs / 86400)}d`;
	}

	// Filtered and sorted devices
	let devices = $derived.by(() => {
		const all = Array.from($kismetStore.devices.values());
		const q = searchQuery.toLowerCase().trim();
		const isoMac = $isolatedDeviceMAC;

		// If isolated to an AP, only show that AP and its clients
		if (isoMac) {
			const ap = $kismetStore.devices.get(isoMac);
			if (!ap) {
				isolateDevice(null);
				return [];
			}
			const result: KismetDevice[] = [ap];
			if (ap.clients?.length) {
				for (const clientMac of ap.clients) {
					const client = $kismetStore.devices.get(clientMac);
					if (client) result.push(client);
				}
			}
			return result;
		}

		return all
			.filter((d) => {
				const rssi = getRSSI(d);
				if (hideNoSignal && rssi === 0) return false;
				const band = getSignalBandKey(rssi);
				if (hiddenBands.has(band)) return false;
				if (showOnlyWithClients && !(d.clients && d.clients.length > 0)) return false;
				if (!q) return true;
				const mac = (d.mac || '').toLowerCase();
				const ssid = (d.ssid || '').toLowerCase();
				const mfr = (d.manufacturer || d.manuf || '').toLowerCase();
				return mac.includes(q) || ssid.includes(q) || mfr.includes(q);
			})
			.sort((a, b) => {
				let cmp = 0;
				if (sortColumn === 'mac') {
					cmp = (a.mac || '').localeCompare(b.mac || '');
				} else if (sortColumn === 'rssi') {
					const aRssi = getRSSI(a);
					const bRssi = getRSSI(b);
					// 0 = no data, sort below real signals
					const aVal = aRssi === 0 ? -999 : aRssi;
					const bVal = bRssi === 0 ? -999 : bRssi;
					cmp = aVal - bVal;
				} else if (sortColumn === 'type') {
					const order: Record<string, number> = {
						AP: 0,
						Client: 1,
						Bridged: 2,
						'Ad-Hoc': 3
					};
					cmp = (order[a.type] ?? 4) - (order[b.type] ?? 4);
				} else if (sortColumn === 'channel') {
					cmp = (a.channel || 0) - (b.channel || 0);
				} else if (sortColumn === 'packets') {
					cmp = (a.packets || 0) - (b.packets || 0);
				} else if (sortColumn === 'data') {
					cmp = (a.datasize || a.dataSize || 0) - (b.datasize || b.dataSize || 0);
				}
				return sortDirection === 'asc' ? cmp : -cmp;
			});
	});

	function sortIndicator(col: string): string {
		if (sortColumn !== col) return '';
		return sortDirection === 'asc' ? ' ^' : ' v';
	}

	/** Count of APs with clients for the filter badge */
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

		<input
			class="input-field input-field-sm toolbar-search"
			type="text"
			placeholder="Search MAC, SSID, manufacturer..."
			bind:value={searchQuery}
		/>

		<div class="toolbar-separator"></div>

		<div class="band-filters">
			{#each signalBands as band (band.key)}
				<button
					class="band-chip"
					class:hidden-band={hiddenBands.has(band.key)}
					onclick={() => toggleBand(band.key)}
					title={band.label}
				>
					<span class="band-dot" style="background: var({band.cssVar})"></span>
				</button>
			{/each}
			<button
				class="band-chip no-signal-chip"
				class:hidden-band={hideNoSignal}
				onclick={() => (hideNoSignal = !hideNoSignal)}
				title={hideNoSignal ? 'Show devices without signal' : 'Hide devices without signal'}
			>
				<span class="no-signal-label">--</span>
			</button>
			<button
				class="band-chip multi-client-chip"
				class:active-filter={showOnlyWithClients}
				onclick={() => (showOnlyWithClients = !showOnlyWithClients)}
				title={showOnlyWithClients
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
						>MAC / SSID{sortIndicator('mac')}</th
					>
					<th onclick={() => handleSort('rssi')} class="sortable col-rssi"
						>RSSI{sortIndicator('rssi')}</th
					>
					<th onclick={() => handleSort('type')} class="sortable col-type"
						>TYPE{sortIndicator('type')}</th
					>
					<th class="col-vendor">VENDOR</th>
					<th onclick={() => handleSort('channel')} class="sortable col-ch"
						>CH{sortIndicator('channel')}</th
					>
					<th class="col-freq">FREQ</th>
					<th class="col-enc">ENC</th>
					<th onclick={() => handleSort('packets')} class="sortable col-pkts"
						>PKTS{sortIndicator('packets')}</th
					>
					<th onclick={() => handleSort('data')} class="sortable col-data"
						>DATA{sortIndicator('data')}</th
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
			<input
				class="input-field input-field-sm"
				type="text"
				placeholder="MAC address..."
				bind:value={whitelistInput}
				onkeydown={(e) => e.key === 'Enter' && addToWhitelist()}
			/>
			<button class="btn btn-secondary btn-sm" onclick={addToWhitelist}>Add</button>
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
		background: rgba(74, 158, 255, 0.1);
		border: 1px solid rgba(74, 158, 255, 0.25);
		border-radius: var(--radius-sm);
		color: var(--palantir-accent);
		font-size: 10px;
		font-weight: var(--font-weight-semibold);
		padding: 2px 6px;
		cursor: pointer;
		letter-spacing: var(--letter-spacing-wide);
	}

	.back-btn:hover {
		background: rgba(74, 158, 255, 0.2);
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
		background: rgba(74, 158, 255, 0.1);
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
		background: rgba(74, 144, 226, 0.15);
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
		background: rgba(74, 158, 255, 0.06);
		border-bottom: 1px solid rgba(74, 158, 255, 0.15);
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

	.whitelist-input-row .input-field {
		flex: 1;
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
