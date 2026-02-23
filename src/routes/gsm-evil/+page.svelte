<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import ErrorDialog from '$lib/components/gsm-evil/ErrorDialog.svelte';
	import GsmHeader from '$lib/components/gsm-evil/GsmHeader.svelte';
	import LiveFramesConsole from '$lib/components/gsm-evil/LiveFramesConsole.svelte';
	import ScanConsole from '$lib/components/gsm-evil/ScanConsole.svelte';
	import ScanResultsTable from '$lib/components/gsm-evil/ScanResultsTable.svelte';
	import TowerTable from '$lib/components/gsm-evil/TowerTable.svelte';
	import { mccToCountry, mncToCarrier } from '$lib/data/carrier-mappings';
	import { gsmEvilStore } from '$lib/stores/gsm-evil-store';
	import { groupIMSIsByTower } from '$lib/utils/gsm-tower-utils';
	import { logger } from '$lib/utils/logger';

	import {
		checkActivity,
		fetchIMSIs,
		fetchRealFrames,
		fetchTowerLocationsForIMSIs,
		fetchTowerLocationsForScanResults,
		processScanStream
	} from './gsm-evil-page-logic';

	let imsiCaptureActive = $state(false);
	let imsiPollInterval: ReturnType<typeof setInterval>;

	// Store-managed state via $derived runes
	let selectedFrequency = $derived($gsmEvilStore.selectedFrequency);
	let isScanning = $derived($gsmEvilStore.isScanning);
	let scanResults = $derived($gsmEvilStore.scanResults);
	let capturedIMSIs = $derived($gsmEvilStore.capturedIMSIs);
	let scanProgress = $derived($gsmEvilStore.scanProgress);
	let towerLocations = $derived($gsmEvilStore.towerLocations);
	let towerLookupAttempted = $derived($gsmEvilStore.towerLookupAttempted);
	let scanButtonText = $derived($gsmEvilStore.scanButtonText);

	// Button shows "Stop Scan" (red) when scanning OR when IMSI capture is running
	let isActive = $derived(isScanning || imsiCaptureActive);
	let buttonText = $derived(
		isScanning ? scanButtonText : imsiCaptureActive ? 'Stop Scan' : 'Start Scan'
	);

	// Error dialog state
	let errorDialogOpen = $state(false);
	let errorDialogMessage = $state('');

	// Non-store managed state
	let gsmFrames = $state<string[]>([]);
	let activityStatus = $state({
		hasActivity: false,
		packetCount: 0,
		recentIMSI: false,
		currentFrequency: '947.2',
		message: 'Checking...'
	});

	// Mutable state object passed to extracted logic functions
	let pageState = $derived({
		get imsiCaptureActive() {
			return imsiCaptureActive;
		},
		set imsiCaptureActive(v: boolean) {
			imsiCaptureActive = v;
		},
		get gsmFrames() {
			return gsmFrames;
		},
		set gsmFrames(v: string[]) {
			gsmFrames = v;
		},
		get activityStatus() {
			return activityStatus;
		},
		set activityStatus(v: typeof activityStatus) {
			activityStatus = v;
		}
	});

	// Reactive variable for grouped towers that updates when IMSIs or locations change
	let groupedTowers = $derived(
		capturedIMSIs
			? groupIMSIsByTower(capturedIMSIs, mncToCarrier, mccToCountry, towerLocations)
			: []
	);

	const UNKNOWN_COUNTRY = { name: 'Unknown', flag: '', code: '??' };

	/** Extract cell ID fields with defaults from a scan result. */
	function extractCellFields(r: (typeof scanResults)[number]) {
		const mcc = r.mcc || '';
		const mnc = r.mnc || '';
		const lac = r.lac || '';
		const ci = r.ci || '';
		const mccMnc = `${mcc}-${mnc.padStart(2, '0')}`;
		return { mcc, mnc, lac, ci, mccMnc, towerId: `${mccMnc}-${lac}-${ci}` };
	}

	/** Resolve tower metadata lookups (country, carrier, location). */
	function resolveTowerMeta(
		mcc: string,
		mccMnc: string,
		towerId: string,
		locations: typeof towerLocations
	) {
		return {
			country: mccToCountry[mcc] || UNKNOWN_COUNTRY,
			carrier: mncToCarrier[mccMnc] || 'Unknown',
			location: locations[towerId] || null
		};
	}

	/** Map a scan result with cell info to a detected tower record. */
	function toDetectedTower(r: (typeof scanResults)[number], locations: typeof towerLocations) {
		const cell = extractCellFields(r);
		const meta = resolveTowerMeta(cell.mcc, cell.mccMnc, cell.towerId, locations);
		return {
			frequency: r.frequency,
			...cell,
			...meta,
			frameCount: r.frameCount || 0,
			strength: r.strength
		};
	}

	/** Whether a scan result has cell identification fields. */
	function hasCellInfo(r: (typeof scanResults)[number]): boolean {
		return !!(r.mcc && r.lac && r.ci);
	}

	// Derive detected towers from scan results that have cell info (MCC/MNC/LAC/CI)
	let scanDetectedTowers = $derived(
		scanResults.filter(hasCellInfo).map((r) => toDetectedTower(r, towerLocations))
	);

	// Fetch tower locations when new IMSIs are captured
	$effect(() => {
		if (capturedIMSIs.length > 0) {
			fetchTowerLocationsForIMSIs(capturedIMSIs, towerLocations, towerLookupAttempted);
		}
	});

	// Auto-fetch tower locations for scan-detected towers
	$effect(() => {
		if (scanDetectedTowers.length > 0) {
			fetchTowerLocationsForScanResults(
				scanDetectedTowers,
				towerLocations,
				towerLookupAttempted
			);
		}
	});

	function startPolling() {
		if (imsiPollInterval) clearInterval(imsiPollInterval);
		imsiPollInterval = setInterval(() => {
			fetchIMSIs();
			checkActivity(pageState);
			fetchRealFrames(pageState);
		}, 2000);
	}

	/** Show an error dialog with a message. */
	function showError(message: string) {
		errorDialogMessage = message;
		errorDialogOpen = true;
	}

	/** Handle a failed stop response from the API. */
	function handleStopFailure(response: Response, data: Record<string, unknown>) {
		if (response.ok && data.success) return;
		const errorMsg = data.message || data.error || 'Unknown error';
		logger.error('[GSM] Stop failed', { errorMsg });
		showError(
			`Failed to stop GSM Evil: ${errorMsg}\nProcesses may still be running. Check system status.`
		);
	}

	/** Send the stop command to the GSM Evil API. */
	async function sendStopCommand() {
		try {
			const response = await fetch('/api/gsm-evil/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'stop' })
			});
			handleStopFailure(response, await response.json());
		} catch (error: unknown) {
			logger.error('[GSM] Stop request failed', { error });
			showError('Failed to communicate with server. Processes may still be running.');
		}
	}

	async function handleScanButton() {
		if (!isScanning && !imsiCaptureActive) {
			scanFrequencies();
			return;
		}
		if (isScanning) gsmEvilStore.stopScan();
		if (imsiPollInterval) clearInterval(imsiPollInterval);
		await sendStopCommand();
		imsiCaptureActive = false;
		gsmFrames = [];
	}

	/** Determine if GSM Evil is currently running from status response. */
	function isGsmEvilRunning(data: Record<string, unknown>): boolean {
		const details = data.details as Record<string, Record<string, unknown>> | undefined;
		return !!(details?.grgsm?.running || data.status === 'running');
	}

	/** Start all GSM Evil polling and fetching tasks. */
	function activateGsmCapture() {
		imsiCaptureActive = true;
		startPolling();
		fetchIMSIs();
		checkActivity(pageState);
		fetchRealFrames(pageState);
	}

	onMount(async () => {
		try {
			const data = await (await fetch('/api/gsm-evil/status')).json();
			if (isGsmEvilRunning(data)) activateGsmCapture();
			else gsmEvilStore.completeScan();
		} catch (error) {
			logger.error('[GSM] Status check failed', { error });
		}
	});

	onDestroy(() => {
		if (imsiPollInterval) clearInterval(imsiPollInterval);
	});

	/** Whether the error is an AbortError (user-initiated scan stop). */
	function isAbortError(error: unknown): boolean {
		return error instanceof Error && error.name === 'AbortError';
	}

	/** Whether an error message suggests a network-level failure. */
	const NETWORK_ERROR_KEYWORDS = ['fetch', 'network', 'HTTP'];
	function isNetworkError(msg: string): boolean {
		return NETWORK_ERROR_KEYWORDS.some((kw) => msg.includes(kw));
	}

	/** Handle a scan error that is not an abort. */
	function handleScanError(error: unknown) {
		logger.error('Scan failed', { error });
		const msg = error instanceof Error ? error.message : 'Unknown error';
		if (isNetworkError(msg)) {
			gsmEvilStore.addScanProgress('[ERROR] Network connection lost - check server status');
			gsmEvilStore.setScanStatus('Network error');
		} else {
			gsmEvilStore.addScanProgress(`[ERROR] Scan failed: ${msg}`);
			gsmEvilStore.setScanStatus('Scan failed');
		}
		gsmEvilStore.setScanResults([]);
	}

	/** Fetch the SSE scan stream with timeout and abort support. */
	async function fetchScanStream(): Promise<Response> {
		const abortController = gsmEvilStore.getAbortController();
		const timeoutController = new AbortController();
		const timeoutId = setTimeout(() => timeoutController.abort(), 360000);
		const response = await fetch('/api/gsm-evil/intelligent-scan-stream', {
			method: 'POST',
			signal: abortController?.signal || timeoutController.signal
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		clearTimeout(timeoutId);
		return response;
	}

	async function scanFrequencies() {
		gsmEvilStore.startScan();
		try {
			const response = await fetchScanStream();
			const abortController = gsmEvilStore.getAbortController();
			await processScanStream(response, abortController, pageState, startPolling, () => ({
				scanResults: $gsmEvilStore.scanResults,
				selectedFrequency: $gsmEvilStore.selectedFrequency
			}));
		} catch (error) {
			if (isAbortError(error)) {
				gsmEvilStore.addScanProgress('[SCAN] Scan stopped by user');
				gsmEvilStore.setScanStatus('Scan stopped');
			} else {
				handleScanError(error);
			}
		} finally {
			gsmEvilStore.completeScan();
		}
	}
</script>

<div class="flex flex-col min-h-screen bg-background text-foreground">
	<!-- Header -->
	<GsmHeader {isActive} {buttonText} onscanbutton={handleScanButton} />

	<!-- IMSI Capture Panel (shows after scan starts IMSI capture) — displayed first -->
	{#if imsiCaptureActive}
		<TowerTable {groupedTowers} {towerLookupAttempted} {selectedFrequency} />
	{/if}

	<!-- Frequency Selector Panel (Compact) - Hidden when IMSI capture is active -->
	{#if !imsiCaptureActive}
		<div class="frequency-panel-compact">
			<!-- Scan Results Table -->
			<ScanResultsTable
				{scanResults}
				{selectedFrequency}
				onselect={(freq) => gsmEvilStore.setSelectedFrequency(freq)}
			/>

			<!-- Scan Progress Console -->
			<ScanConsole {scanProgress} {isScanning} />
		</div>
	{/if}

	<!-- Live GSM Frames (shows after scan starts IMSI capture) -->
	{#if imsiCaptureActive}
		<LiveFramesConsole {gsmFrames} {activityStatus} />
	{/if}
</div>

<ErrorDialog bind:open={errorDialogOpen} message={errorDialogMessage} />

<style>
	.frequency-panel-compact {
		background: linear-gradient(135deg, var(--color-muted) 0%, var(--color-background) 100%);
		border-bottom: 1px solid var(--color-border);
		padding: 0.75rem 1rem;
	}
</style>
