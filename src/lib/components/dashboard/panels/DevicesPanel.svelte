<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { getContext } from 'svelte';

	import type { KismetDevice } from '$lib/kismet/types';
	import {
		activeBands,
		isolatedDeviceMAC,
		isolateDevice,
		toggleBand as toggleGlobalBand
	} from '$lib/stores/dashboard/dashboard-store';
	import {
		busyAPs,
		fetchReconData,
		gpsTracked,
		hiddenNetworks,
		reconAlerts,
		reconStatus,
		reconTargets,
		weakSecurityTargets,
		wpsTargets
	} from '$lib/stores/dashboard/recon-store';
	import { kismetStore, setWhitelistMAC } from '$lib/stores/tactical-map/kismet-store';

	import { filterAndSortDevices, type SortColumn } from './devices/device-filters';
	import DeviceSubTabs from './devices/DeviceSubTabs.svelte';
	import DeviceTable from './devices/DeviceTable.svelte';
	import DeviceToolbar from './devices/DeviceToolbar.svelte';
	import DeviceWhitelist from './devices/DeviceWhitelist.svelte';
	import {
		BUSY_EXTRA_COLUMNS,
		GPS_EXTRA_COLUMNS,
		INTEL_DESCRIPTIONS,
		INTEL_TABS,
		WPS_EXTRA_COLUMNS
	} from './devices/intel-tab-config';
	import IntelCategoryView from './devices/IntelCategoryView.svelte';

	const dashboardMap = getContext<
		{ flyTo: (lat: number, lon: number, zoom?: number) => void } | undefined
	>('dashboardMap');

	let searchQuery = $state('');
	let whitelistedMACs: string[] = $state([]);
	let sortColumn: SortColumn = $state('rssi');
	let sortDirection: 'asc' | 'desc' = $state('desc');
	let selectedMAC: string | null = $state(null);
	let expandedMAC: string | null = $state(null);
	let shouldHideNoSignal = $state(true);
	let shouldShowOnlyWithClients = $state(false);
	let activeSubTab = $state('all');

	/* ── Sort / row click handlers ──────────────────── */

	function handleSort(col: SortColumn) {
		if (sortColumn === col) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortColumn = col;
		sortDirection = col === 'mac' ? 'asc' : 'desc';
	}

	function handleApClick(device: KismetDevice) {
		if ($isolatedDeviceMAC === device.mac) {
			isolateDevice(null);
			selectedMAC = null;
			expandedMAC = null;
		} else {
			isolateDevice(device.mac);
			selectedMAC = device.mac;
			expandedMAC = device.mac;
		}
	}

	function handleClientClick(device: KismetDevice) {
		if ($isolatedDeviceMAC === device.parentAP) {
			isolateDevice(null);
			selectedMAC = null;
			expandedMAC = null;
		} else {
			isolateDevice(device.parentAP ?? '');
			selectedMAC = device.mac;
		}
	}

	function handleStandaloneClick(device: KismetDevice) {
		if (selectedMAC === device.mac) {
			selectedMAC = null;
			expandedMAC = null;
		} else {
			selectedMAC = device.mac;
			expandedMAC = expandedMAC === device.mac ? null : device.mac;
		}
	}

	function flyToDevice(device: KismetDevice) {
		const loc = device.location;
		if (loc?.lat && loc.lon && dashboardMap) dashboardMap.flyTo(loc.lat, loc.lon, 17);
	}

	function handleRowClick(device: KismetDevice) {
		if (device.clients?.length) handleApClick(device);
		else if (device.parentAP) handleClientClick(device);
		else handleStandaloneClick(device);
		flyToDevice(device);
	}

	function clearIsolation() {
		isolateDevice(null);
		selectedMAC = null;
		expandedMAC = null;
	}

	function triggerRecon() {
		fetchReconData({ type: 'all', sort: 'signal' });
	}

	/* ── Device filtering for ALL tab ───────────────── */

	const RENDER_CAP = 200;

	let allDevices = $derived(
		filterAndSortDevices($kismetStore.devices, $isolatedDeviceMAC, {
			searchQuery,
			shouldHideNoSignal,
			shouldShowOnlyWithClients,
			activeBands: $activeBands,
			sortColumn,
			sortDirection
		})
	);

	let renderedDevices = $derived(allDevices.slice(0, RENDER_CAP));

	/* ── Tab counts (derived from recon data) ───────── */

	let subTabCounts = $derived({
		all: allDevices.length,
		'weak-security': $weakSecurityTargets.length,
		wps: $wpsTargets.length,
		hidden: $hiddenNetworks.length,
		'busy-aps': $busyAPs.length,
		gps: $gpsTracked.length,
		alerts: $reconAlerts.length,
		whitelist: 0
	});

	/* ── Lifecycle ──────────────────────────────────── */

	$effect(() => {
		if ($isolatedDeviceMAC && !$kismetStore.devices.has($isolatedDeviceMAC)) {
			isolateDevice(null);
		}
	});

	$effect(() => {
		if ($reconStatus === 'idle') triggerRecon();
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
	<DeviceToolbar
		deviceCount={allDevices.length}
		renderedCount={renderedDevices.length}
		isolatedMAC={$isolatedDeviceMAC}
		{searchQuery}
		activeBands={$activeBands}
		{shouldHideNoSignal}
		{shouldShowOnlyWithClients}
		{apsWithClientsCount}
		onClearIsolation={clearIsolation}
		onSearchChange={(q) => (searchQuery = q)}
		onToggleBand={toggleGlobalBand}
		onToggleNoSignal={() => (shouldHideNoSignal = !shouldHideNoSignal)}
		onToggleOnlyWithClients={() => (shouldShowOnlyWithClients = !shouldShowOnlyWithClients)}
	/>

	<DeviceSubTabs
		activeTab={activeSubTab}
		counts={subTabCounts}
		tabs={INTEL_TABS}
		onTabChange={(tab) => (activeSubTab = tab)}
	/>

	{#if activeSubTab === 'whitelist'}
		<div class="whitelist-view">
			<DeviceWhitelist
				{whitelistedMACs}
				onAdd={(mac) => {
					whitelistedMACs = [...whitelistedMACs, mac];
					setWhitelistMAC(mac);
				}}
				onRemove={(mac) => {
					whitelistedMACs = whitelistedMACs.filter((m) => m !== mac);
				}}
			/>
		</div>
	{:else if activeSubTab === 'weak-security'}
		<IntelCategoryView
			title="Weak Security"
			description={INTEL_DESCRIPTIONS['weak-security']}
			targets={$weakSecurityTargets}
			reconStatus={$reconStatus}
			onRefresh={triggerRecon}
		/>
	{:else if activeSubTab === 'wps'}
		<IntelCategoryView
			title="WPS Targets"
			description={INTEL_DESCRIPTIONS.wps}
			targets={$wpsTargets}
			reconStatus={$reconStatus}
			onRefresh={triggerRecon}
			extraColumns={WPS_EXTRA_COLUMNS}
		/>
	{:else if activeSubTab === 'hidden'}
		<IntelCategoryView
			title="Hidden Networks"
			description={INTEL_DESCRIPTIONS.hidden}
			targets={$hiddenNetworks}
			reconStatus={$reconStatus}
			onRefresh={triggerRecon}
		/>
	{:else if activeSubTab === 'busy-aps'}
		<IntelCategoryView
			title="Busy Access Points"
			description={INTEL_DESCRIPTIONS['busy-aps']}
			targets={$busyAPs}
			reconStatus={$reconStatus}
			onRefresh={triggerRecon}
			extraColumns={BUSY_EXTRA_COLUMNS}
		/>
	{:else if activeSubTab === 'gps'}
		<IntelCategoryView
			title="GPS Tracked"
			description={INTEL_DESCRIPTIONS.gps}
			targets={$gpsTracked}
			reconStatus={$reconStatus}
			onRefresh={triggerRecon}
			extraColumns={GPS_EXTRA_COLUMNS}
		/>
	{:else if activeSubTab === 'alerts'}
		<IntelCategoryView
			title="Security Alerts"
			description={INTEL_DESCRIPTIONS.alerts}
			targets={$reconTargets}
			alerts={$reconAlerts}
			reconStatus={$reconStatus}
			onRefresh={triggerRecon}
		/>
	{:else}
		<DeviceTable
			devices={renderedDevices}
			{selectedMAC}
			{expandedMAC}
			{sortColumn}
			{sortDirection}
			onSort={handleSort}
			onRowClick={handleRowClick}
		/>
	{/if}
</div>

<style>
	.devices-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--card);
	}

	.whitelist-view {
		flex: 1;
		overflow: auto;
	}
</style>
