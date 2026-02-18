<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import ScanResultsTable from '$lib/components/gsm-evil/ScanResultsTable.svelte';
	import TowerTable from '$lib/components/gsm-evil/TowerTable.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { mccToCountry, mncToCarrier } from '$lib/data/carrier-mappings';
	import { gsmEvilStore } from '$lib/stores/gsm-evil-store';
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
		try {
			const response = await fetch('/api/gsm-evil/tower-location', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mcc, mnc, lac, ci })
			});
			if (response.ok) return await response.json();
		} catch (error) {
			console.error('Failed to fetch tower location:', error);
		}
		return null;
	}

	async function fetchIMSIs() {
		try {
			const response = await fetch('/api/gsm-evil/imsi');
			if (response.ok) {
				const data = await response.json();
				if (data.success) {
					gsmEvilStore.setCapturedIMSIs(data.imsis);
				}
			}
		} catch (error) {
			console.error('Failed to fetch IMSIs:', error);
		}
	}

	onMount(async () => {
		// Check if GSM Evil is already running
		try {
			const res = await fetch('/api/gsm-evil/status');
			const data = await res.json();
			const grgsmRunning = data.details?.grgsm?.running;
			const bothRunning = data.status === 'running';

			if (grgsmRunning || bothRunning) {
				imsiCaptureActive = true;
				// Start polling
				if (imsiPollInterval) clearInterval(imsiPollInterval);
				imsiPollInterval = setInterval(() => {
					fetchIMSIs();
				}, 2000);
				// Immediate fetch
				fetchIMSIs();
			}
		} catch (error) {
			console.error('[GSM] Status check failed:', error);
		}
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
