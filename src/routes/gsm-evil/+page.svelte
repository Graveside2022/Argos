<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';

	import ErrorDialog from '$lib/components/gsm-evil/ErrorDialog.svelte';
	import GsmHeader from '$lib/components/gsm-evil/GsmHeader.svelte';
	import LiveFramesConsole from '$lib/components/gsm-evil/LiveFramesConsole.svelte';
	import ScanConsole from '$lib/components/gsm-evil/ScanConsole.svelte';
	import ScanResultsTable from '$lib/components/gsm-evil/ScanResultsTable.svelte';
	import TowerTable from '$lib/components/gsm-evil/TowerTable.svelte';
	import { mccToCountry, mncToCarrier } from '$lib/data/carrier-mappings';
	import { gsmEvilStore } from '$lib/stores/gsm-evil-store';
	import type { FrequencyTestResult } from '$lib/types/gsm';
	import { groupIMSIsByTower } from '$lib/utils/gsm-tower-utils';

	let imsiCaptureActive = false;
	let imsiPollInterval: ReturnType<typeof setInterval>;
	// Store-managed state via reactive statements
	$: selectedFrequency = $gsmEvilStore.selectedFrequency;
	$: isScanning = $gsmEvilStore.isScanning;
	$: scanResults = $gsmEvilStore.scanResults;
	$: capturedIMSIs = $gsmEvilStore.capturedIMSIs;
	$: scanProgress = $gsmEvilStore.scanProgress;

	$: towerLocations = $gsmEvilStore.towerLocations;
	$: towerLookupAttempted = $gsmEvilStore.towerLookupAttempted;
	$: scanButtonText = $gsmEvilStore.scanButtonText;

	// Button shows "Stop Scan" (red) when scanning OR when IMSI capture is running
	$: isActive = isScanning || imsiCaptureActive;
	$: buttonText = isScanning ? scanButtonText : imsiCaptureActive ? 'Stop Scan' : 'Start Scan';

	// Error dialog state
	let errorDialogOpen = false;
	let errorDialogMessage = '';

	// Non-store managed state
	let gsmFrames: string[] = [];
	let activityStatus = {
		hasActivity: false,
		packetCount: 0,
		recentIMSI: false,
		currentFrequency: '947.2',
		message: 'Checking...'
	};

	// Reactive variable for grouped towers that updates when IMSIs or locations change
	$: groupedTowers = capturedIMSIs
		? groupIMSIsByTower(capturedIMSIs, mncToCarrier, mccToCountry, towerLocations)
		: [];

	// Derive detected towers from scan results that have cell info (MCC/MNC/LAC/CI)
	$: scanDetectedTowers = scanResults
		.filter((r) => r.mcc && r.lac && r.ci)
		.map((r) => {
			const mcc = r.mcc || '';
			const mnc = r.mnc || '';
			const lac = r.lac || '';
			const ci = r.ci || '';
			const mccMnc = `${mcc}-${mnc.padStart(2, '0')}`;
			const towerId = `${mccMnc}-${lac}-${ci}`;
			const country = mccToCountry[mcc] || { name: 'Unknown', flag: '', code: '??' };
			const carrier = mncToCarrier[mccMnc] || 'Unknown';
			return {
				frequency: r.frequency,
				mcc,
				mnc,
				mccMnc,
				lac,
				ci,
				towerId,
				country,
				carrier,
				frameCount: r.frameCount || 0,
				strength: r.strength,
				location: towerLocations[towerId] || null
			};
		});

	// Fetch tower locations when new IMSIs are captured
	$: if (capturedIMSIs.length > 0) {
		const towers = groupIMSIsByTower(capturedIMSIs, mncToCarrier, mccToCountry, towerLocations);
		towers.forEach(async (tower) => {
			const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`;
			if (!towerLocations[towerId] && !towerLookupAttempted[towerId]) {
				gsmEvilStore.markTowerLookupAttempted(towerId);

				const result = await fetchTowerLocation(tower.mcc, tower.mnc, tower.lac, tower.ci);
				if (result && result.found) {
					gsmEvilStore.updateTowerLocation(towerId, result.location);
				}
			}
		});
	}

	// Auto-fetch tower locations for scan-detected towers (post-scan cell identity)
	$: if (scanDetectedTowers.length > 0) {
		scanDetectedTowers.forEach(async (tower) => {
			if (!towerLocations[tower.towerId] && !towerLookupAttempted[tower.towerId]) {
				gsmEvilStore.markTowerLookupAttempted(tower.towerId);
				const result = await fetchTowerLocation(tower.mcc, tower.mnc, tower.lac, tower.ci);
				if (result && result.found) {
					gsmEvilStore.updateTowerLocation(tower.towerId, result.location);
				}
			}
		});
	}

	// Fetch tower location
	async function fetchTowerLocation(mcc: string, mnc: string, lac: string, ci: string) {
		try {
			const response = await fetch('/api/gsm-evil/tower-location', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ mcc, mnc, lac, ci })
			});

			if (response.ok) {
				const data = await response.json();
				return data;
			}
		} catch (error) {
			console.error('Failed to fetch tower location:', error);
		}
		return null;
	}

	async function handleScanButton() {
		if (isScanning || imsiCaptureActive) {
			// Stop everything - abort client-side fetch, kill server processes, stop IMSI polling
			if (isScanning) {
				gsmEvilStore.stopScan();
			}

			// Stop IMSI polling
			if (imsiPollInterval) {
				clearInterval(imsiPollInterval);
			}

			// Kill server-side grgsm_livemon_headless and GsmEvil processes
			try {
				const response = await fetch('/api/gsm-evil/control', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'stop' })
				});

				const data = await response.json();

				if (!response.ok || !data.success) {
					const errorMsg = data.message || data.error || 'Unknown error';
					console.error('[GSM] Stop failed:', errorMsg);
					// Show error but still clear UI state
					errorDialogMessage = `Failed to stop GSM Evil: ${errorMsg}\nProcesses may still be running. Check system status.`;
					errorDialogOpen = true;
				} else {
					console.log('[GSM] Stop successful:', data.message);
				}
			} catch (error: unknown) {
				console.error('[GSM] Stop request failed:', error);
				errorDialogMessage =
					'Failed to communicate with server. Processes may still be running.';
				errorDialogOpen = true;
			}

			// Clear UI state after attempting stop
			imsiCaptureActive = false;
			gsmFrames = []; // Clear frames
		} else {
			// Start the scan
			scanFrequencies();
		}
	}

	onMount(async () => {
		console.log('[GSM] Component mounted');

		// Check if GSM Evil is already running (e.g. user navigated away and back)
		try {
			const res = await fetch('/api/gsm-evil/status');
			const data = await res.json();

			// Check if grgsm is running (for live frames) even if overall status is "stopped"
			const grgsmRunning = data.details?.grgsm?.running;
			const bothRunning = data.status === 'running';

			if (grgsmRunning || bothRunning) {
				console.log('[GSM] Detected running grgsm process — starting polling');
				console.log('[GSM] Status details:', {
					grgsm: data.details?.grgsm,
					gsmevil: data.details?.gsmevil,
					overallStatus: data.status
				});

				// Set active state if ANY GSM process is running (so stop button works)
				if (grgsmRunning || bothRunning) {
					imsiCaptureActive = true;
				}

				// Start polling for data
				if (imsiPollInterval) clearInterval(imsiPollInterval);
				imsiPollInterval = setInterval(() => {
					fetchIMSIs();
					checkActivity();
					fetchRealFrames();
				}, 2000);

				// Immediate fetch to populate UI
				fetchIMSIs();
				checkActivity();
				fetchRealFrames();
			} else {
				console.log('[GSM] No GSM processes detected - page in stopped state');
				// Clear any stale scanning state from localStorage
				gsmEvilStore.completeScan();
			}
		} catch (error) {
			console.error('[GSM] Status check failed:', error);
			// Status check failed — page starts in default stopped state
		}
	});

	onDestroy(() => {
		if (imsiPollInterval) {
			clearInterval(imsiPollInterval);
		}
	});

	async function startIMSICapture(frequency: string) {
		if (imsiCaptureActive) return;

		try {
			console.log('[GSM] Starting IMSI capture on', frequency, 'MHz');
			const response = await fetch('/api/gsm-evil/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'start', frequency })
			});

			// Safe: response from /api/gsm-evil/control always returns {success, message} per route contract
			const data = (await response.json()) as { success: boolean; message: string };
			if (response.ok && data.success) {
				imsiCaptureActive = true;
				// Start polling for IMSIs
				if (imsiPollInterval) clearInterval(imsiPollInterval);
				imsiPollInterval = setInterval(() => {
					fetchIMSIs();
					checkActivity();
					fetchRealFrames();
				}, 2000);
				// Initial fetch
				fetchIMSIs();
				checkActivity();
				fetchRealFrames();
				console.log('[GSM] IMSI capture started successfully');
			} else {
				console.error('[GSM] Failed to start IMSI capture:', data.message);
			}
		} catch (error) {
			console.error('[GSM] Error starting IMSI capture:', error);
		}
	}

	async function scanFrequencies() {
		// Start the scan in store - this changes button to "Stop Scan"
		gsmEvilStore.startScan();

		try {
			// Get abort controller for stop functionality
			const abortController = gsmEvilStore.getAbortController();

			// Add client-side timeout (6 minutes) slightly longer than server timeout
			const timeoutController = new AbortController();
			const timeoutId = setTimeout(() => {
				timeoutController.abort();
			}, 360000); // 6 minutes

			// Use the streaming endpoint to show progress
			const response = await fetch('/api/gsm-evil/intelligent-scan-stream', {
				method: 'POST',
				signal: abortController?.signal || timeoutController.signal // This enables the stop button
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			// Clear client timeout since we got a response
			clearTimeout(timeoutId);

			if (!response.body) {
				throw new Error('No response body');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				// Check if user clicked stop
				if (abortController?.signal.aborted) {
					reader.cancel();
					return;
				}

				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const json = JSON.parse(line.slice(6));
							if (json.message) {
								// REAL-TIME PROGRESS - Results populate while scanning
								gsmEvilStore.addScanProgress(json.message);

								// Auto-scroll to bottom
								await tick();
								const progressEl = document.querySelector('.scan-progress-body');
								if (progressEl) {
									progressEl.scrollTop = progressEl.scrollHeight;
								}
							}
							if (json.result) {
								const data = json.result;
								console.log('Scan response:', data);

								if (data.type === 'frequency_result') {
									// REAL-TIME RESULTS - Add individual frequency results as they complete
									console.log('Adding frequency result:', data.result);
									gsmEvilStore.addScanResult(data.result);

									// Update progress status
									gsmEvilStore.setScanStatus(
										`Testing frequencies... ${data.progress.completed}/${data.progress.total} complete`
									);

									// Automatically select the best frequency so far (highest frame count)
									if (data.result.frameCount > 0) {
										// Check if this is better than current selection
										const currentResults = $gsmEvilStore.scanResults;
										const currentSelected = currentResults.find(
											(r) => r.frequency === $gsmEvilStore.selectedFrequency
										);

										if (
											!currentSelected ||
											data.result.frameCount >
												(currentSelected.frameCount || 0)
										) {
											gsmEvilStore.setSelectedFrequency(
												data.result.frequency
											);
										}
									}
								} else if (data.type === 'scan_complete' || data.bestFrequency) {
									// SCAN COMPLETE - Final results processing
									if (data.bestFrequency) {
										console.log(
											'Scan complete! Setting results:',
											data.scanResults
										);
										console.log(
											'Results with cell data:',
											data.scanResults?.filter(
												(r: FrequencyTestResult) => r.mcc
											)
										);
										gsmEvilStore.setSelectedFrequency(data.bestFrequency);
										gsmEvilStore.setScanResults(data.scanResults || []);
										gsmEvilStore.setScanStatus(
											`Found ${data.scanResults?.length || 0} active frequencies. Best: ${data.bestFrequency} MHz`
										);
										gsmEvilStore.addScanProgress('[SCAN] Scan complete!');
										gsmEvilStore.addScanProgress(
											`[SCAN] Found ${data.scanResults?.length || 0} active frequencies`
										);

										// Log cell identity capture status
										const withCellData =
											data.scanResults?.filter(
												(r: FrequencyTestResult) => r.mcc && r.lac && r.ci
											).length || 0;
										console.log(
											`Cell identity captured for ${withCellData}/${data.scanResults?.length || 0} frequencies`
										);
										if (withCellData > 0) {
											gsmEvilStore.addScanProgress(
												`[SCAN] ✓ Cell identity captured for ${withCellData} frequency(ies) - tower data will display below`
											);
										} else {
											gsmEvilStore.addScanProgress(
												'[SCAN] ⚠ No cell identity captured - tower table will not display'
											);
											gsmEvilStore.addScanProgress(
												'[SCAN] 💡 Cell identity requires BCCH channels with System Information messages'
											);
										}

										// Auto-start IMSI capture on the best frequency
										gsmEvilStore.addScanProgress(
											`[SCAN] Starting IMSI capture on ${data.bestFrequency} MHz...`
										);
										startIMSICapture(data.bestFrequency);
									} else {
										gsmEvilStore.setScanStatus('No active frequencies found');
										gsmEvilStore.setScanResults([]);
										gsmEvilStore.addScanProgress(
											'[SCAN] No active frequencies detected'
										);
									}
								}
							}
						} catch (e) {
							console.error('Error parsing SSE data:', e);
						}
					}
				}
			}
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				// User clicked stop or timeout - this is normal
				gsmEvilStore.addScanProgress('[SCAN] Scan stopped by user');
				gsmEvilStore.setScanStatus('Scan stopped');
			} else {
				// Real error - differentiate between network and process errors
				console.error('Scan failed:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';

				if (
					errorMessage.includes('fetch') ||
					errorMessage.includes('network') ||
					errorMessage.includes('HTTP')
				) {
					gsmEvilStore.addScanProgress(
						'[ERROR] Network connection lost - check server status'
					);
					gsmEvilStore.setScanStatus('Network error');
				} else {
					gsmEvilStore.addScanProgress(`[ERROR] Scan failed: ${errorMessage}`);
					gsmEvilStore.setScanStatus('Scan failed');
				}

				gsmEvilStore.setScanResults([]);
			}
		} finally {
			// Always complete the scan - button returns to "Start Scan"
			gsmEvilStore.completeScan();
		}
	}

	async function fetchRealFrames() {
		try {
			const response = await fetch('/api/gsm-evil/live-frames', {
				credentials: 'same-origin' // Ensure cookies are included
			});

			if (response.ok) {
				const data = await response.json();

				// Debug logging
				console.log('[GSM Frames] API response:', {
					success: data.success,
					frameCount: data.frames?.length || 0,
					message: data.message,
					currentTotal: gsmFrames.length
				});

				if (data.success && data.frames && data.frames.length > 0) {
					// Append new frames to existing ones (console-like behavior)
					gsmFrames = [...gsmFrames, ...data.frames];

					// Keep only the last 30 frames to prevent memory issues
					if (gsmFrames.length > 30) {
						gsmFrames = gsmFrames.slice(-30);
					}

					// Auto-scroll to bottom after adding new frames
					await tick();
					const frameDisplay = document.querySelector('.live-frames-console');
					if (frameDisplay) {
						frameDisplay.scrollTop = frameDisplay.scrollHeight;
					}

					console.log('[GSM Frames] Updated, new total:', gsmFrames.length);
				} else {
					console.log('[GSM Frames] No frames in this batch:', data.message);
				}
			} else if (response.status === 401) {
				console.error('[GSM Frames] Authentication failed - session may have expired');
			} else {
				console.error('[GSM Frames] API error:', response.status, response.statusText);
			}
		} catch (error) {
			console.error('[GSM Frames] Failed to fetch:', error);
		}
	}

	async function checkActivity() {
		try {
			const response = await fetch('/api/gsm-evil/activity');
			if (response.ok) {
				const data = await response.json();
				activityStatus = {
					hasActivity: data.hasActivity,
					packetCount: data.packetCount,
					recentIMSI: data.recentIMSI,
					currentFrequency: data.currentFrequency,
					message: data.message
				};
			}
		} catch (error) {
			console.error('Failed to check activity:', error);
		}
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
