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
	import { kismetStore, setWhitelistMAC } from '$lib/stores/tactical-map/kismet-store';

	import { filterAndSortDevices, type SortColumn } from './devices/device-filters';
	import DeviceTable from './devices/DeviceTable.svelte';
	import DeviceToolbar from './devices/DeviceToolbar.svelte';
	import DeviceWhitelist from './devices/DeviceWhitelist.svelte';

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

	function handleSort(col: SortColumn) {
		if (sortColumn === col) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortColumn = col;
		sortDirection = col === 'mac' ? 'asc' : 'desc';
	}

	/** Handle click on an AP (has clients) row. */
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

	/** Handle click on a client (has parentAP) row. */
	function handleClientClick(device: KismetDevice) {
		if ($isolatedDeviceMAC === device.parentAP) {
			isolateDevice(null);
			selectedMAC = null;
			expandedMAC = null;
		} else {
			isolateDevice(device.parentAP!);
			selectedMAC = device.mac;
		}
	}

	/** Handle click on a standalone device row. */
	function handleStandaloneClick(device: KismetDevice) {
		if (selectedMAC === device.mac) {
			selectedMAC = null;
			expandedMAC = null;
		} else {
			selectedMAC = device.mac;
			expandedMAC = expandedMAC === device.mac ? null : device.mac;
		}
	}

	/** Fly the map to a device's location if available. */
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
	<DeviceToolbar
		deviceCount={devices.length}
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

	<DeviceTable
		{devices}
		{selectedMAC}
		{expandedMAC}
		{sortColumn}
		{sortDirection}
		onSort={handleSort}
		onRowClick={handleRowClick}
	/>

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

<style>
	.devices-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--palantir-bg-surface);
	}
</style>
