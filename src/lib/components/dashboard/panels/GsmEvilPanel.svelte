<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import ScanResultsTable from '$lib/components/gsm-evil/ScanResultsTable.svelte';
	import TowerTable from '$lib/components/gsm-evil/TowerTable.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { mccToCountry, mncToCarrier } from '$lib/data/carrier-mappings';
	import { gsmEvilStore, type IMSICapture } from '$lib/stores/gsm-evil-store';
	import { fetchJSON } from '$lib/utils/fetch-json';
	import { groupIMSIsByTower } from '$lib/utils/gsm-tower-utils';

	let imsiCaptureActive = $state(false);
	let imsiPollInterval: ReturnType<typeof setInterval>;

	// Store-managed state via reactive statements
	let selectedFrequency = $derived($gsmEvilStore.selectedFrequency);
	let scanResults = $derived($gsmEvilStore.scanResults);
	let capturedIMSIs = $derived($gsmEvilStore.capturedIMSIs);
	let towerLocations = $derived($gsmEvilStore.towerLocations);
	let towerLookupAttempted = $derived($gsmEvilStore.towerLookupAttempted);

	// Reactive variable for grouped towers that updates when IMSIs or locations change
	let groupedTowers = $derived(
		capturedIMSIs
			? groupIMSIsByTower(capturedIMSIs, mncToCarrier, mccToCountry, towerLocations)
			: []
	);

	// Fetch tower locations
	$effect(() => {
		if (capturedIMSIs.length > 0) {
			const towers = groupIMSIsByTower(
				capturedIMSIs,
				mncToCarrier,
				mccToCountry,
				towerLocations
			);
			towers.forEach(async (tower) => {
				const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`;
				if (!towerLocations[towerId] && !towerLookupAttempted[towerId]) {
					gsmEvilStore.markTowerLookupAttempted(towerId);

					const result = await fetchTowerLocation(
						tower.mcc,
						tower.mnc,
						tower.lac,
						tower.ci
					);
					if (result && result.found) {
						gsmEvilStore.updateTowerLocation(towerId, result.location);
					}
				}
			});
		}
	});

	async function fetchTowerLocation(mcc: string, mnc: string, lac: string, ci: string) {
		return fetchJSON<{ found: boolean; location: { lat: number; lon: number } }>(
			'/api/gsm-evil/tower-location',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mcc, mnc, lac, ci })
			}
		);
	}

	async function fetchIMSIs() {
		const data = await fetchJSON<{ success: boolean; imsis: IMSICapture[] }>(
			'/api/gsm-evil/imsi'
		);
		if (data?.success) gsmEvilStore.setCapturedIMSIs(data.imsis);
	}

	/** Check if GSM Evil is currently running from status response. */
	function isGsmRunning(data: Record<string, unknown>): boolean {
		const details = data.details as Record<string, Record<string, unknown>> | undefined;
		return !!(details?.grgsm?.isRunning || data.status === 'running');
	}

	/** Start IMSI polling when capture is active. */
	function startImsiPolling() {
		imsiCaptureActive = true;
		if (imsiPollInterval) clearInterval(imsiPollInterval);
		imsiPollInterval = setInterval(() => fetchIMSIs(), 2000);
		fetchIMSIs();
	}

	onMount(async () => {
		const data = await fetchJSON<Record<string, unknown>>('/api/gsm-evil/status');
		if (data && isGsmRunning(data)) startImsiPolling();
	});

	onDestroy(() => {
		if (imsiPollInterval) clearInterval(imsiPollInterval);
	});
</script>

<div class="h-full flex flex-row overflow-hidden bg-background">
	<!-- Left Side: Table (Tower or Scan Results) -->
	<div class="flex-1 overflow-auto p-4 flex flex-col gap-4">
		{#if imsiCaptureActive}
			<TowerTable {groupedTowers} {towerLookupAttempted} {selectedFrequency} />
		{:else}
			<div
				class="flex flex-col items-center justify-center h-full text-muted-foreground gap-2"
			>
				<p>GSM Evil is not running.</p>
				<Button variant="outline" href="/gsm-evil">Go to Full Tool</Button>
			</div>
			<!-- Optional: Show scan results if available but not active? -->
			{#if scanResults.length > 0}
				<ScanResultsTable
					{scanResults}
					{selectedFrequency}
					onselect={(freq) => gsmEvilStore.setSelectedFrequency(freq)}
				/>
			{/if}
		{/if}
	</div>
</div>
