<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { gsmEvilStore } from '$lib/stores/gsm-evil-store';
	import { groupIMSIsByTower, sortTowers } from '$lib/utils/gsm-tower-utils';
	import { mncToCarrier, mccToCountry } from '$lib/data/carrier-mappings';

	let imsiCaptureActive = false;
	let imsiPollInterval: ReturnType<typeof setInterval>;
	// Store-managed state via reactive statements
	$: selectedFrequency = $gsmEvilStore.selectedFrequency;
	$: isScanning = $gsmEvilStore.isScanning;
	$: scanResults = $gsmEvilStore.scanResults;
	$: capturedIMSIs = $gsmEvilStore.capturedIMSIs;
	$: _totalIMSIs = $gsmEvilStore.totalIMSIs;
	$: _scanStatus = $gsmEvilStore.scanStatus;
	$: scanProgress = $gsmEvilStore.scanProgress;
	$: _showScanProgress = $gsmEvilStore.showScanProgress;
	$: towerLocations = $gsmEvilStore.towerLocations;
	$: towerLookupAttempted = $gsmEvilStore.towerLookupAttempted;
	$: scanButtonText = $gsmEvilStore.scanButtonText;

	// Button shows "Stop Scan" (red) when scanning OR when IMSI capture is running
	$: isActive = isScanning || imsiCaptureActive;
	$: buttonText = isScanning ? scanButtonText : imsiCaptureActive ? 'Stop Scan' : 'Start Scan';

	// Non-store managed state
	let gsmFrames: string[] = [];
	let activityStatus = {
		hasActivity: false,
		packetCount: 0,
		recentIMSI: false,
		currentFrequency: '947.2',
		message: 'Checking...'
	};
	let expandedTowers: Set<string> = new Set(); // Track which tower rows are expanded
	let timestampTicker = 0; // Increment to force timestamp recalculation
	let timestampInterval: ReturnType<typeof setInterval>;

	// Sorting state
	type SortColumn =
		| 'carrier'
		| 'country'
		| 'location'
		| 'lac'
		| 'mccMnc'
		| 'devices'
		| 'lastSeen';
	let sortColumn: SortColumn = 'devices'; // Default sort by device count
	let sortDirection: 'asc' | 'desc' = 'desc';

	// Real-time frequency parsing state
	let _currentFrequencyData: any = {};

	// Reactive variable for grouped towers that updates when IMSIs or locations change
	$: groupedTowers = capturedIMSIs
		? sortTowers(
				groupIMSIsByTower(capturedIMSIs, mncToCarrier, mccToCountry, towerLocations),
				sortColumn,
				sortDirection
			)
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

	// Debug reactive statement
	$: if (scanResults.length > 0) {
		// console.log('scanResults updated:', scanResults.length, 'items');
	}

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

	// Handle column header click for sorting
	function handleSort(column: SortColumn) {
		if (sortColumn === column) {
			// Toggle direction if same column
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			// New column - default to descending for numbers, ascending for text
			sortColumn = column;
			sortDirection = ['devices', 'lastSeen'].includes(column) ? 'desc' : 'asc';
		}
	}

	// Toggle tower row expansion
	function toggleTowerExpansion(towerId: string) {
		if (expandedTowers.has(towerId)) {
			expandedTowers.delete(towerId);
		} else {
			expandedTowers.add(towerId);
		}
		// Trigger reactivity
		expandedTowers = new Set(expandedTowers);
	}

	// Format timestamp for display
	function formatTimestamp(timestamp: string): string {
		// Force reactive dependency on ticker to update "X ago" times
		void timestampTicker;

		// Parse custom format: "21:49:40 2026-02-09" -> "2026-02-09T21:49:40"
		let date: Date;
		if (timestamp.includes(' ') && timestamp.split(' ').length === 2) {
			const [time, dateStr] = timestamp.split(' ');
			date = new Date(`${dateStr}T${time}`);
		} else {
			date = new Date(timestamp);
		}

		// Check if date is valid
		if (isNaN(date.getTime())) {
			return timestamp; // Return original if can't parse
		}

		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffSecs / 60);
		const diffHours = Math.floor(diffMins / 60);

		// Show relative time for recent detections
		if (diffSecs < 60) {
			return `${diffSecs}s ago`;
		} else if (diffMins < 60) {
			return `${diffMins}m ago`;
		} else if (diffHours < 24) {
			return `${diffHours}h ago`;
		}

		// Show date/time for older detections
		const timeStr = date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		const dateStr = date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
		return `${dateStr} ${timeStr}`;
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

	// Lookup tower location and update display
	// async function lookupTowerLocation(tower: any) {
	// 	const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`;
	// 	const result = await fetchTowerLocation(tower.mcc, tower.mnc, tower.lac, tower.ci);
	//
	// 	if (result && result.found) {
	// 		towerLocations[towerId] = result.location;
	// 		// Force re-render
	// 		towerLocations = { ...towerLocations };
	// 	}
	// }

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
					alert(
						`Failed to stop GSM Evil: ${errorMsg}\nProcesses may still be running. Check system status.`
					);
				} else {
					console.log('[GSM] Stop successful:', data.message);
				}
			} catch (error: unknown) {
				console.error('[GSM] Stop request failed:', error);
				alert('Failed to communicate with server. Processes may still be running.');
			}

			// Clear UI state after attempting stop
			imsiCaptureActive = false;
			// gsmEvilStore.clearResults(); // COMMENTED: preserve IMSI data
			gsmFrames = []; // Clear frames
		} else {
			// Start the scan
			scanFrequencies();
		}
	}

	onMount(async () => {
		console.log('[GSM] Component mounted');

		// Start timestamp ticker for reactive "X ago" updates
		timestampInterval = setInterval(() => {
			timestampTicker++;
		}, 10000); // Update every 10 seconds

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
		if (timestampInterval) {
			clearInterval(timestampInterval);
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
											data.scanResults?.filter((r: any) => r.mcc)
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
												(r: any) => r.mcc && r.lac && r.ci
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

<div class="gsm-evil-container">
	<!-- Header -->
	<header class="header">
		<div class="header-container">
			<div class="header-content">
				<!-- Left Section - Logo and Title -->
				<div class="header-left">
					<!-- Back to Console Button -->
					<a href="/" class="control-btn back-btn-style">
						<span class="font-bold">Back to Console</span>
					</a>
					<div class="title-section">
						<div class="title-wrapper">
							<div class="icon-wrapper">
								<svg class="icon" fill="currentColor" viewBox="0 0 24 24">
									<path
										d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1M12,18A1,1 0 0,0 13,17A1,1 0 0,0 12,16A1,1 0 0,0 11,17A1,1 0 0,0 12,18M8,8H16V10H8V8M8,11H13V13H8V11Z"
									></path>
								</svg>
							</div>
							<div class="flex flex-col">
								<h1
									class="font-heading text-h4 font-semibold tracking-tight leading-tight"
								>
									<span class="gsm-brand">GSM</span>
									<span class="evil-brand">Evil</span>
								</h1>
								<span class="subtitle font-bold"> Cellular Network Analysis </span>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Section - Buttons -->
				<div class="flex items-center gap-3">
					{#if imsiCaptureActive}
						<div class="flex items-center gap-2 text-xs mr-2">
							<div class="status-indicator-small active"></div>
							<span class="text-green-400 font-semibold">IMSI Capture Active</span>
						</div>
					{/if}

					<button
						class="control-btn {isActive ? 'scan-btn-red' : 'scan-btn-green'}"
						onclick={handleScanButton}
					>
						<span class="font-bold">{buttonText}</span>
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- IMSI Capture Panel (shows after scan starts IMSI capture) — displayed first -->
	{#if imsiCaptureActive}
		<div class="scan-results-table" style="margin: 0 1rem; margin-top: 0.5rem;">
			<h4 class="table-title">
				<span style="color: #dc2626;">IMSI</span> Capture
			</h4>
			<div class="tower-groups" style="padding: 0.75rem;">
				{#if capturedIMSIs.length > 0}
					<div class="tower-header">
						<button
							class="header-sortable header-carrier"
							onclick={() => handleSort('carrier')}
							title="Click to sort by Carrier"
						>
							Carrier
							{#if sortColumn === 'carrier'}
								<span class="sort-indicator"
									>{sortDirection === 'asc' ? '▲' : '▼'}</span
								>
							{/if}
						</button>
						<span class="tower-separator">|</span>
						<button
							class="header-sortable header-country"
							onclick={() => handleSort('country')}
							title="Click to sort by Country"
						>
							Country
							{#if sortColumn === 'country'}
								<span class="sort-indicator"
									>{sortDirection === 'asc' ? '▲' : '▼'}</span
								>
							{/if}
						</button>
						<span class="tower-separator">|</span>
						<button
							class="header-sortable header-location"
							onclick={() => handleSort('location')}
							title="Click to sort by Location"
						>
							Cell Tower Location
							{#if sortColumn === 'location'}
								<span class="sort-indicator"
									>{sortDirection === 'asc' ? '▲' : '▼'}</span
								>
							{/if}
						</button>
						<span class="tower-separator">|</span>
						<button
							class="header-sortable header-lac"
							onclick={() => handleSort('lac')}
							title="Click to sort by LAC/CI"
						>
							LAC/CI
							{#if sortColumn === 'lac'}
								<span class="sort-indicator"
									>{sortDirection === 'asc' ? '▲' : '▼'}</span
								>
							{/if}
						</button>
						<span class="tower-separator">|</span>
						<button
							class="header-sortable header-mcc"
							onclick={() => handleSort('mccMnc')}
							title="Click to sort by MCC-MNC"
						>
							MCC-MNC
							{#if sortColumn === 'mccMnc'}
								<span class="sort-indicator"
									>{sortDirection === 'asc' ? '▲' : '▼'}</span
								>
							{/if}
						</button>
						<span class="tower-separator">|</span>
						<button
							class="header-sortable header-devices"
							onclick={() => handleSort('devices')}
							title="Click to sort by Device Count"
						>
							Devices
							{#if sortColumn === 'devices'}
								<span class="sort-indicator"
									>{sortDirection === 'asc' ? '▲' : '▼'}</span
								>
							{/if}
						</button>
						<span class="tower-separator">|</span>
						<button
							class="header-sortable header-time"
							onclick={() => handleSort('lastSeen')}
							title="Click to sort by Last Seen"
						>
							Last Seen
							{#if sortColumn === 'lastSeen'}
								<span class="sort-indicator"
									>{sortDirection === 'asc' ? '▲' : '▼'}</span
								>
							{/if}
						</button>
					</div>
					{#each groupedTowers as tower}
						{@const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`}
						{@const isExpanded = expandedTowers.has(towerId)}
						<div>
							<div
								class="tower-line tower-line-clickable {isExpanded
									? 'tower-line-expanded'
									: ''}"
								onclick={() => toggleTowerExpansion(towerId)}
								role="button"
								tabindex="0"
							>
								<span class="tower-expand-icon">{isExpanded ? '▼' : '▶'}</span>
								<span
									class="tower-carrier {tower.carrier === 'Unknown'
										? 'text-yellow-500'
										: ''}">{tower.carrier}</span
								>
								<span class="tower-separator">|</span>
								<span class="tower-country"
									>{tower.country.flag} {tower.country.code}</span
								>
								<span class="tower-separator">|</span>
								<span class="tower-location">
									{#if tower.location}
										<span class="text-green-400"
											>{tower.location.lat.toFixed(4)}, {tower.location.lon.toFixed(
												4
											)}</span
										>
									{:else if !towerLookupAttempted[towerId]}
										<span class="text-xs text-yellow-500">Looking up...</span>
									{:else}
										<span class="text-xs" style="color: #94a3b8;">Roaming</span>
									{/if}
								</span>
								<span class="tower-separator">|</span>
								<span
									class="tower-lac {tower.carrier === 'Unknown'
										? 'text-yellow-500'
										: ''}">{tower.lac}/{tower.ci}</span
								>
								<span class="tower-separator">|</span>
								<span
									class="tower-mcc {tower.carrier === 'Unknown'
										? 'text-yellow-500'
										: ''}">{tower.mccMnc}</span
								>
								<span class="tower-separator">|</span>
								<span class="tower-devices">{tower.count}</span>
								<span class="tower-separator">|</span>
								<span class="tower-time text-gray-400">
									{formatTimestamp(tower.lastSeen.toISOString())}
								</span>
							</div>

							<!-- Expanded Device List -->
							{#if isExpanded}
								<div class="device-list-expanded">
									<div class="device-list-header">
										<span class="device-header-imsi">IMSI</span>
										<span class="device-header-tmsi">TMSI</span>
										<span class="device-header-time">Detected</span>
									</div>
									{#each tower.devices.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) as device}
										<div class="device-list-row">
											<span class="device-imsi">{device.imsi}</span>
											<span class="device-tmsi">{device.tmsi || 'N/A'}</span>
											<span class="device-time text-gray-400">
												{formatTimestamp(device.timestamp)}
											</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{:else}
					<div class="frame-line text-gray-500">No IMSIs captured yet...</div>
					<div class="frame-line text-gray-600">
						Listening for mobile devices on {selectedFrequency} MHz
					</div>
					<div class="frame-line text-gray-600">
						IMSI sniffer is active - devices will appear here
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Frequency Selector Panel (Compact) - Hidden when IMSI capture is active -->
	{#if !imsiCaptureActive}
		<div class="frequency-panel-compact">
			<div class="frequency-container">
				<!-- Scan Results Table -->
				<div class="scan-results-table">
					<h4 class="table-title"><span style="color: #dc2626;">Scan</span> Results</h4>
					<div class="table-container">
						{#if scanResults.length > 0}
							<table class="frequency-table">
								<thead>
									<tr>
										<th>Frequency</th>
										<th>Signal</th>
										<th>Quality</th>
										<th>Channel Type</th>
										<th>GSM Frames</th>
										<th>Activity</th>
										<th>Action</th>
									</tr>
								</thead>
								<tbody>
									{#each scanResults.sort((a, b) => (b.frameCount || 0) - (a.frameCount || 0)) as result}
										<tr
											class={selectedFrequency === result.frequency
												? 'selected'
												: ''}
										>
											<td class="freq-cell">{result.frequency} MHz</td>
											<td class="signal-cell"
												>{result.power !== undefined && result.power > -100
													? result.power.toFixed(1) + ' dBm'
													: result.strength || 'N/A'}</td
											>
											<td>
												<span
													class="quality-badge {result.strength
														.toLowerCase()
														.replace(' ', '-')}">{result.strength}</span
												>
											</td>
											<td>
												{#if result.channelType}
													<span
														class="channel-type {result.controlChannel
															? 'control'
															: ''}">{result.channelType}</span
													>
												{:else}
													<span class="channel-type unknown">-</span>
												{/if}
											</td>
											<td class="frames-cell">
												{#if result.frameCount !== undefined}
													<span class="frame-count"
														>{result.frameCount}</span
													>
												{:else}
													<span class="no-data">-</span>
												{/if}
											</td>
											<td class="activity-cell">
												{#if result.hasGsmActivity}
													<span class="activity-yes">✓</span>
												{:else}
													<span class="activity-no">✗</span>
												{/if}
											</td>
											<td>
												<button
													class="select-btn {selectedFrequency ===
													result.frequency
														? 'selected'
														: ''}"
													onclick={() =>
														gsmEvilStore.setSelectedFrequency(
															result.frequency
														)}
												>
													{selectedFrequency === result.frequency
														? 'Selected'
														: 'Select'}
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{:else}
							<div class="empty-table">
								<p class="text-gray-500">No results available</p>
							</div>
						{/if}
					</div>
					{#if scanResults.length > 0}
						<p class="table-footer">
							Found {scanResults.length} active frequencies • Sorted by GSM frame count
						</p>
					{/if}
				</div>

				<!-- Scan Progress Console -->
				<div class="scan-progress-console">
					<div class="console-header">
						<span class="console-title">CONSOLE</span>
						{#if isScanning}
							<span class="console-status">SCANNING...</span>
						{:else if scanProgress.length > 0}
							<span class="console-status">COMPLETE</span>
						{/if}
					</div>
					<div class="console-body">
						{#if scanProgress.length > 0}
							{#each scanProgress as line}
								<div
									class="console-line {line.startsWith('[ERROR]')
										? 'error'
										: line.startsWith('[CMD]')
											? 'command'
											: line.startsWith('[TEST')
												? 'test'
												: line.includes('=====')
													? 'header'
													: ''}"
								>
									{line}
								</div>
							{/each}
							{#if isScanning}
								<div class="console-cursor">█</div>
							{/if}
						{:else}
							<div class="console-line text-gray-500">
								Click 'Start Scan' to begin
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Live GSM Frames (shows after scan starts IMSI capture) -->
	{#if imsiCaptureActive}
		<div class="scan-results-table" style="margin: 0 1rem; margin-top: 0.5rem;">
			<h4 class="table-title">
				<span style="color: #dc2626;">Live</span> GSM Frames
				<span class="text-xs text-gray-400 ml-2" style="font-weight: normal;">
					<span style="color: white;">Listening on</span>
					<span style="color: #dc2626; font-weight: 600;"
						>{activityStatus.currentFrequency} MHz</span
					>
					<span style="color: #gray; margin-left: 1rem;">• {gsmFrames.length} frames</span
					>
				</span>
			</h4>
			<div
				class="live-frames-console"
				style="padding: 0.75rem; max-height: calc(100vh - 350px); min-height: 600px; overflow-y: auto; font-family: monospace; font-size: 0.75rem; background: rgba(0, 0, 0, 0.8);"
			>
				{#if gsmFrames.length > 0}
					{#each gsmFrames as frame, i}
						<div
							class="frame-line {i === gsmFrames.length - 1 ? 'text-green-400' : ''}"
						>
							{frame}
						</div>
					{/each}
				{:else}
					<div class="frame-line text-gray-500">Waiting for GSM frames...</div>
					<div class="frame-line text-gray-600 text-xs">
						{#if activityStatus.packetCount > 0}
							Processing {activityStatus.packetCount} packets/sec
						{:else}
							Listening for GSM traffic on {activityStatus.currentFrequency} MHz
						{/if}
					</div>
					<div class="frame-line text-gray-600 text-xs">
						{#if capturedIMSIs.length > 0}
							✓ Capturing IMSIs ({capturedIMSIs.length} devices detected)
						{:else}
							IMSI sniffer active - devices will appear when detected
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.gsm-evil-container {
		background-color: #000;
		color: #fff;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.header {
		background: linear-gradient(to bottom, rgba(139, 0, 0, 0.1), rgba(0, 0, 0, 0.95));
		border-bottom: 1px solid rgba(255, 0, 0, 0.2);
		position: relative;
		z-index: 50;
	}

	.header-container {
		max-width: 100%;
		margin: 0 auto;
		padding: 0 1rem;
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 64px;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.title-section {
		display: flex;
		align-items: center;
	}

	.title-wrapper {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.icon-wrapper {
		padding: 0.75rem;
		border-radius: 0.75rem;
		background: linear-gradient(135deg, rgba(255, 0, 0, 0.2) 0%, rgba(139, 0, 0, 0.1) 100%);
		border: 1px solid rgba(255, 0, 0, 0.2);
		box-shadow:
			0 8px 25px rgba(255, 0, 0, 0.2),
			0 0 15px rgba(255, 0, 0, 0.15);
	}

	.icon {
		width: 24px;
		height: 24px;
		color: #dc2626;
	}

	.gsm-brand {
		color: #dc2626;
		/* text-shadow: 0 0 20px rgba(255, 0, 0, 0.5); */
	}

	.evil-brand {
		color: #e8eaed;
		font-weight: bold;
	}

	.subtitle {
		font-family: 'Courier New', monospace;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #9ca3af;
	}

	/* Control Buttons */
	.control-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		position: relative;
		overflow: hidden;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.control-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-settings {
		background: rgba(31, 41, 55, 0.5);
		border: 1px solid rgba(75, 85, 99, 0.3);
		color: #9ca3af;
	}

	.btn-settings:hover {
		background: rgba(31, 41, 55, 0.8);
		color: #d1d5db;
		border-color: rgba(107, 114, 128, 0.5);
	}

	/* Animations */
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	/* Utility classes */
	.flex {
		display: flex;
	}

	.flex-col {
		flex-direction: column;
	}

	.items-center {
		align-items: center;
	}

	.gap-3 {
		gap: 0.75rem;
	}

	.text-xs {
		font-size: 0.75rem;
		line-height: 1rem;
	}

	.font-mono {
		font-family: 'Courier New', monospace;
	}

	.text-gray-400 {
		color: #9ca3af;
	}

	.font-medium {
		font-weight: 500;
	}

	.font-semibold {
		font-weight: 600;
	}

	.font-bold {
		font-weight: 700;
	}

	.text-white {
		color: #e8eaed;
	}

	.text-green-500 {
		color: #10b981;
	}

	.text-red-500 {
		color: #ef4444;
	}

	.ml-2 {
		margin-left: 0.5rem;
	}

	.w-4 {
		width: 1rem;
	}

	.h-4 {
		height: 1rem;
	}

	.w-5 {
		width: 1.25rem;
	}

	.h-5 {
		height: 1.25rem;
	}

	.space-y-2 > * + * {
		margin-top: 0.5rem;
	}

	.text-sm {
		font-size: 0.875rem;
	}

	.text-gray-500 {
		color: #6b7280;
	}

	.text-xl {
		font-size: 1.25rem;
	}

	.max-w-md {
		max-width: 28rem;
	}

	.mb-2 {
		margin-bottom: 0.5rem;
	}

	.mb-4 {
		margin-bottom: 1rem;
	}

	.mt-4 {
		margin-top: 1rem;
	}

	.z-50 {
		z-index: 50;
	}

	/* Green Start Scan Button */
	.scan-btn-green {
		background: linear-gradient(135deg, #4ade80 0%, #38a56d 100%) !important;
		border: 1px solid rgba(34, 197, 94, 0.3) !important;
		color: white !important;
		box-shadow:
			0 4px 15px rgba(34, 197, 94, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.scan-btn-green:hover:not(:disabled) {
		background: linear-gradient(135deg, #4ade80 0%, #4ade80 100%) !important;
		box-shadow:
			0 6px 20px rgba(34, 197, 94, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	/* Red Stop Scan Button */
	.scan-btn-red {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
		border: 1px solid rgba(239, 68, 68, 0.3) !important;
		color: white !important;
		box-shadow:
			0 4px 15px rgba(239, 68, 68, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.scan-btn-red:hover:not(:disabled) {
		background: linear-gradient(135deg, #f87171 0%, #ef4444 100%) !important;
		box-shadow:
			0 6px 20px rgba(239, 68, 68, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	/* Red Clear Button */
	.clear-btn-red {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
		border: 1px solid rgba(239, 68, 68, 0.3) !important;
		color: white !important;
		box-shadow:
			0 4px 15px rgba(239, 68, 68, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.clear-btn-red:hover:not(:disabled) {
		background: linear-gradient(135deg, #f87171 0%, #ef4444 100%) !important;
		box-shadow:
			0 6px 20px rgba(239, 68, 68, 0.4),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	/* Back to Console Button - muted gray style */
	.back-btn-style {
		background: rgba(55, 65, 81, 0.3);
		border: 1px solid rgba(55, 65, 81, 0.4);
		color: #d1d5db;
		text-decoration: none;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
	}

	.back-btn-style:hover {
		background: rgba(55, 65, 81, 0.4);
		border-color: rgba(55, 65, 81, 0.5);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	/* Compact Frequency Panel */
	.frequency-panel-compact {
		background: linear-gradient(135deg, #1a1d23 0%, #0e1116 100%);
		border-bottom: 1px solid #2c2f36;
		padding: 0.75rem 1rem;
	}

	.freq-selection {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.5rem;
	}

	.scan-status-inline {
		font-size: 0.75rem;
		color: #60a5fa;
		font-style: italic;
		margin-left: 1rem;
	}

	/* Large Console for Scan Progress */
	.scan-progress-console {
		margin: 1rem 0;
		background: #000;
		border: 2px solid #2c2f36;
		border-radius: 0.5rem;
		overflow: hidden;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
	}

	.console-header {
		background: linear-gradient(to right, #1a1d23, #25282f);
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #35383f;
	}

	.console-title {
		font-size: 1rem;
		font-weight: 600;
		color: #e8eaed;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.console-status {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.75rem;
		color: #fbbf24;
		animation: pulse 2s infinite;
	}

	.console-body {
		padding: 1rem;
		height: 400px;
		overflow-y: auto;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.6;
		background: rgba(0, 0, 0, 0.8);
	}

	.console-line {
		color: #9ca3af;
		white-space: pre-wrap;
		word-break: break-all;
		margin-bottom: 0.25rem;
	}

	.console-line.error {
		color: #ef4444;
		font-weight: bold;
	}

	.console-line.command {
		color: #4ade80;
	}

	.console-line.test {
		color: #60a5fa;
	}

	.console-line.header {
		color: #fbbf24;
		font-weight: bold;
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.console-cursor {
		display: inline-block;
		animation: blink 1s infinite;
		color: #4ade80;
		font-weight: bold;
	}

	/* Custom scrollbar for console */
	.console-body::-webkit-scrollbar {
		width: 10px;
	}

	.console-body::-webkit-scrollbar-track {
		background: #1a1d23;
		border-radius: 5px;
	}

	.console-body::-webkit-scrollbar-thumb {
		background: #35383f;
		border-radius: 5px;
		border: 1px solid #2c2f36;
	}

	.console-body::-webkit-scrollbar-thumb:hover {
		background: #3e4149;
	}

	/* Scan Results Table */
	.scan-results-table {
		margin-top: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #2c2f36;
		border-radius: 0.5rem;
		padding: 1rem;
	}

	.table-title {
		font-size: 1rem;
		font-weight: 600;
		color: #fff;
		margin-bottom: 1rem;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.table-container {
		overflow-x: auto;
		border-radius: 0.375rem;
		border: 1px solid #2c2f36;
		min-height: 300px;
		max-height: 400px;
		overflow-y: auto;
	}

	.frequency-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.frequency-table thead {
		background: linear-gradient(135deg, #25282f 0%, #1a1d23 100%);
	}

	.frequency-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #fff;
		border-bottom: 2px solid #35383f;
		text-transform: uppercase;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
	}

	.frequency-table tbody tr {
		background: rgba(255, 255, 255, 0.02);
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		transition: all 0.2s ease;
	}

	.frequency-table tbody tr:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.frequency-table tbody tr.selected {
		background: rgba(34, 197, 94, 0.1);
		border-left: 3px solid #4ade80;
	}

	.frequency-table td {
		padding: 0.75rem 1rem;
		color: #e5e7eb;
	}

	.freq-cell {
		font-weight: 600;
		font-family: 'Courier New', monospace;
		color: #fff;
	}

	.frequency-table .signal-cell {
		color: #9ca3af !important;
		font-family: 'Courier New', monospace;
	}

	.signal-bar {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.signal-value {
		font-weight: 600;
		color: #fff;
	}

	.signal-meter {
		width: 100px;
		height: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		overflow: hidden;
	}

	.signal-fill {
		height: 100%;
		background: linear-gradient(to right, #ef4444, #fbbf24, #4ade80);
		transition: width 0.3s ease;
	}

	.quality-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.quality-badge.excellent {
		background: rgba(147, 51, 234, 0.2);
		color: #9333ea;
		border: 1px solid rgba(147, 51, 234, 0.3);
	}
	.quality-badge.very-strong {
		background: rgba(16, 185, 129, 0.2);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.quality-badge.strong {
		background: rgba(74, 222, 128, 0.2);
		color: #4ade80;
		border: 1px solid rgba(74, 222, 128, 0.3);
	}

	.quality-badge.good {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
		border: 1px solid rgba(251, 191, 36, 0.3);
	}

	.quality-badge.moderate {
		background: rgba(245, 158, 11, 0.2);
		color: #f59e0b;
		border: 1px solid rgba(245, 158, 11, 0.3);
	}

	.quality-badge.weak {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.channel-type {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		font-family: monospace;
	}

	.channel-type.control {
		background: rgba(59, 130, 246, 0.2);
		color: #3b82f6;
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

	.channel-type.unknown {
		color: #6b7280;
	}

	.channel-type:not(.control):not(.unknown) {
		background: rgba(107, 114, 128, 0.2);
		color: #9ca3af;
		border: 1px solid rgba(107, 114, 128, 0.3);
	}

	.frames-cell {
		text-align: center;
	}

	.frame-count {
		font-weight: 600;
		color: #60a5fa;
		font-family: 'Courier New', monospace;
	}

	.no-data {
		color: #6b7280;
		font-style: italic;
	}

	.activity-cell {
		text-align: center;
	}

	.activity-yes {
		color: #4ade80;
		font-size: 1.25rem;
		font-weight: bold;
	}

	.activity-no {
		color: #ef4444;
		font-size: 1.25rem;
		font-weight: bold;
	}

	.select-btn {
		padding: 0.375rem 0.75rem;
		background: linear-gradient(135deg, #25282f 0%, #1a1d23 100%);
		border: 1px solid #35383f;
		border-radius: 0.25rem;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		text-transform: uppercase;
	}

	.select-btn:hover {
		background: linear-gradient(135deg, #35383f 0%, #25282f 100%);
		border-color: #3e4149;
	}

	.select-btn.selected {
		background: linear-gradient(135deg, #4ade80 0%, #38a56d 100%);
		border-color: rgba(34, 197, 94, 0.5);
		color: #fff;
		cursor: default;
	}

	.table-footer {
		text-align: center;
		font-size: 0.75rem;
		color: #9ca3af;
		margin-top: 1rem;
		font-style: italic;
	}

	.empty-table {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		text-align: center;
		color: #9ca3af;
	}

	.empty-table p {
		margin: 0;
	}

	@keyframes blink {
		0%,
		50% {
			opacity: 1;
		}
		51%,
		100% {
			opacity: 0;
		}
	}

	.text-red-500 {
		color: #dc2626;
	}

	.tower-groups {
		margin: 0;
		padding: 0;
	}

	.tower-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0;
		font-size: 0.8125rem;
		font-family: monospace;
		white-space: nowrap;
	}

	.tower-line:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.tower-mcc {
		color: #94a3b8;
		font-size: 0.75rem;
		min-width: 70px;
		text-align: center;
	}

	.tower-carrier {
		color: #f1f5f9;
		font-weight: 500;
		min-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
	}

	.tower-flag {
		font-size: 1rem;
	}

	.tower-country {
		min-width: 120px;
		font-size: 0.75rem;
		color: #f1f5f9;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}

	.tower-separator {
		color: #475569;
		font-size: 0.7rem;
		padding: 0 0.25rem;
	}

	.tower-devices {
		color: #3b82f6;
		font-weight: 600;
		min-width: 90px;
		text-align: center;
	}

	.header-time {
		min-width: 120px;
		text-align: center;
	}

	/* Sortable header styles */
	.header-sortable {
		background: none;
		border: none;
		color: #64748b;
		cursor: pointer;
		font-family: monospace;
		font-weight: bold;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		transition: all 0.2s;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		user-select: none;
	}

	.header-sortable:hover {
		color: #3b82f6;
		background-color: rgba(59, 130, 246, 0.1);
		border-radius: 4px;
	}

	.sort-indicator {
		color: #3b82f6;
		font-size: 0.7rem;
		margin-left: 0.25rem;
	}

	.tower-time {
		min-width: 120px;
		font-family: monospace;
		font-size: 0.75rem;
		text-align: center;
	}

	.tower-line-clickable {
		cursor: pointer;
		transition:
			background-color 0.2s,
			border-left 0.2s;
		border-left: 3px solid transparent;
	}

	.tower-line-clickable:hover {
		background-color: rgba(59, 130, 246, 0.1);
		border-left-color: #3b82f6;
	}

	.tower-line-expanded {
		background-color: rgba(59, 130, 246, 0.15);
		border-left-color: #3b82f6;
	}

	.tower-expand-icon {
		display: inline-block;
		width: 20px;
		color: #3b82f6;
		font-size: 0.7rem;
		margin-right: 0.5rem;
	}

	.device-list-expanded {
		background: rgba(0, 0, 0, 0.3);
		border-left: 3px solid #3b82f6;
		margin: 0.5rem 0 0.5rem 1.5rem;
		padding: 0.75rem;
		border-radius: 4px;
	}

	.device-list-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #374151;
		margin-bottom: 0.5rem;
		font-weight: 600;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.device-list-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 0;
		font-family: monospace;
		font-size: 0.75rem;
		border-bottom: 1px solid #1f2937;
	}

	.device-list-row:last-child {
		border-bottom: none;
	}

	.device-header-imsi,
	.device-imsi {
		flex: 2;
		color: #10b981;
	}

	.device-header-tmsi,
	.device-tmsi {
		flex: 1;
		color: #60a5fa;
	}

	.device-header-time,
	.device-time {
		flex: 1;
		text-align: right;
	}

	.tower-lac {
		color: #94a3b8;
		font-family: monospace;
		font-size: 0.75rem;
		min-width: 80px;
		text-align: center;
	}

	.tower-new {
		color: #ef4444;
		font-weight: bold;
		margin-left: 0.5rem;
		animation: blink 1s linear infinite;
	}

	.tower-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0;
		font-size: 0.75rem;
		font-family: monospace;
		font-weight: bold;
		color: #64748b;
		border-bottom: 1px solid #2c2f36;
		margin-bottom: 0.4rem;
	}

	.header-mcc {
		min-width: 70px;
		text-align: center;
	}

	.header-carrier {
		min-width: 140px;
		text-align: center;
	}

	.header-country {
		min-width: 120px;
		text-align: center;
		font-size: 0.7rem;
	}

	.header-devices {
		min-width: 90px;
		text-align: center;
	}

	.header-lac {
		min-width: 80px;
		text-align: center;
	}

	.header-status {
		min-width: 50px;
		text-align: center;
	}

	.header-location {
		min-width: 160px;
		text-align: center;
	}

	.tower-location {
		min-width: 160px;
		font-family: monospace;
		font-size: 0.75rem;
		color: #9ca3af;
		text-align: center;
	}

	.tower-status {
		min-width: 45px;
		text-align: center;
		font-weight: bold;
	}

	.tower-status {
		min-width: 50px;
		text-align: center;
		font-weight: bold;
	}

	.status-ok {
		color: #10b981;
	}

	.status-unknown {
		color: #f59e0b;
	}

	.status-suspicious {
		color: #ef4444;
		animation: blink 1s linear infinite;
	}

	.status-fake {
		color: #dc2626;
		font-weight: bold;
	}

	.frame-line {
		color: #9ca3af;
		line-height: 1.1;
		white-space: nowrap;
		font-size: 0.75rem;
		font-family: 'Courier New', monospace;
		font-weight: bold;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 0.1rem 0;
	}

	.text-green-400 {
		color: #4ade80;
	}

	.text-yellow-500 {
		color: #eab308;
	}

	.text-orange-400 {
		color: #f97316;
	}

	.blink {
		animation: blink 1s ease-in-out infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.status-indicator.inactive {
		background: #6b7280;
	}

	.status-indicator.pulse {
		animation: pulse 2s infinite;
	}

	.status-indicator-small {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		transition: all 0.3s ease;
	}

	.status-indicator-small.active {
		background: #10b981;
		box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
	}

	.status-indicator-small.inactive {
		background: #6b7280;
	}

	.status-text {
		color: #e5e7eb;
		font-size: 0.875rem;
	}

	.status-detail {
		font-size: 0.75rem;
		margin-left: auto;
	}

	@keyframes pulse {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
		100% {
			opacity: 1;
		}
	}

	.status-text {
		font-size: 0.875rem;
		font-weight: 500;
		color: #fff;
	}

	.status-detail {
		font-size: 0.75rem;
		color: #6b7280;
		margin-left: auto;
		font-family: 'Courier New', monospace;
	}

	/* Splash Screen Styles */
	@keyframes pulse-wave {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.3;
		}
		50% {
			transform: scale(1.1);
			opacity: 0.1;
		}
	}

	/* Live GSM Frames Console */
	.live-frames-console {
		background: rgba(0, 0, 0, 0.9);
		border: 1px solid #2c2f36;
		border-radius: 4px;
	}

	.frame-line {
		white-space: pre-wrap;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.7rem;
		line-height: 1.4;
		padding: 0.2rem 0;
		color: #9ca3af;
	}
</style>
