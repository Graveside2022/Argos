<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	
	let iframeUrl = '';
	let isLoading = true;
	let hasError = false;
	let errorMessage = '';
	let gsmStatus: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
	let statusCheckInterval: ReturnType<typeof setInterval>;
	let detailedStatus: any = null;
	let selectedFrequency = '947.2';
	let isScanning = false;
	let gsmFrames: string[] = [];
	let frameUpdateInterval: ReturnType<typeof setInterval>;
	let activityStatus = {
		hasActivity: false,
		packetCount: 0,
		recentIMSI: false,
		currentFrequency: '947.2',
		message: 'Checking...'
	};
	let scanResults: { frequency: string; power: number; strength: string; frameCount?: number; hasGsmActivity?: boolean; channelType?: string; controlChannel?: boolean }[] = [];
	let showScanResults = false;
	let capturedIMSIs: any[] = [];
	let totalIMSIs = 0;
	let scanStatus = '';
	let scanProgress: string[] = [];
	let showScanProgress = false;
	
	function clearResults() {
		scanProgress = [];
		scanResults = [];
		scanStatus = '';
		showScanProgress = false;
		showScanResults = false;
	}

	onMount(() => {
		// GSM Evil runs on port 80 on the same host
		const host = window.location.hostname;
		// Default to IMSI sniffer page for better UX
		iframeUrl = `http://${host}:80/imsi`;
		
		// Check initial GSM Evil status
		checkGSMStatus().catch((error) => {
			console.error('Initial GSM status check failed:', error);
		});
		
		// Set up periodic status checks
		statusCheckInterval = setInterval(() => {
			checkGSMStatus().catch((error) => {
				console.error('Periodic GSM status check failed:', error);
			});
		}, 5000);
		
		// Start frame update interval
		startFrameUpdates();
	});
	
	onDestroy(() => {
		if (statusCheckInterval) {
			clearInterval(statusCheckInterval);
		}
		if (frameUpdateInterval) {
			clearInterval(frameUpdateInterval);
		}
	});
	
	async function checkGSMStatus() {
		try {
			// Use the new status endpoint
			const response = await fetch('/api/gsm-evil/status');
			
			if (response.ok) {
				const data = await response.json();
				detailedStatus = data.details;
				
				// Only update status if we're not in a transitional state
				if (gsmStatus !== 'starting' && gsmStatus !== 'stopping') {
					const isRunning = data.status === 'running';
					if (isRunning && gsmStatus === 'stopped') {
						console.log('GSM Evil detected as running');
						gsmStatus = 'running';
						hasError = false;
						// Ensure iframe URL points to IMSI sniffer when GSM Evil is already running
						const host = window.location.hostname;
						iframeUrl = `http://${host}:80/imsi`;
					} else if (!isRunning && gsmStatus === 'running') {
						console.log('GSM Evil detected as stopped');
						gsmStatus = 'stopped';
					}
				}
			}
		} catch (error) {
			console.error('Error checking GSM Evil status:', error);
		}
	}
	
	async function startGSMEvil() {
		console.log('Starting GSM Evil...');
		if (gsmStatus === 'starting' || gsmStatus === 'stopping') {
			console.log('GSM Evil is already changing state');
			return;
		}
		
		gsmStatus = 'starting';
		
		try {
			const response = await fetch('/api/gsm-evil/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'start', frequency: selectedFrequency })
			});
			
			const data = await response.json() as { success: boolean; message: string };
			console.log('Start response:', data);
			
			if (response.ok && data.success) {
				// Wait a bit for the service to fully start
				setTimeout(() => {
					gsmStatus = 'running';
					hasError = false;
					isLoading = true; // Reset loading state for iframe
					// Update iframe URL to IMSI sniffer page and force reload
					const host = window.location.hostname;
					iframeUrl = `http://${host}:80/imsi`;
					// Force reload iframe with a slight delay to ensure GSM Evil is ready
					setTimeout(() => {
						const iframe = document.querySelector('iframe');
						if (iframe) {
							iframe.src = iframeUrl; // Load IMSI sniffer page
						}
					}, 2000);
					checkGSMStatus();
				}, 3000);
			} else {
				throw new Error(data.message || 'Failed to start GSM Evil');
			}
		} catch (error) {
			console.error('Failed to start GSM Evil:', error);
			gsmStatus = 'stopped';
			hasError = true;
			errorMessage = error instanceof Error ? error.message : 'Failed to start GSM Evil';
		}
	}
	
	async function stopGSMEvil() {
		if (gsmStatus === 'starting' || gsmStatus === 'stopping') return;
		
		console.log('Stopping GSM Evil...');
		gsmStatus = 'stopping';
		
		try {
			const response = await fetch('/api/gsm-evil/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'stop' })
			});
			
			const data = await response.json() as { success: boolean; message: string };
			console.log('Stop response:', data);
			
			if (response.ok && data.success) {
				gsmStatus = 'stopped';
				hasError = false;
				console.log('GSM Evil stopped successfully');
			} else {
				throw new Error(data.message || 'Failed to stop GSM Evil');
			}
		} catch (error) {
			console.error('Failed to stop GSM Evil:', error);
			gsmStatus = 'running';
			hasError = true;
			errorMessage = error instanceof Error ? error.message : 'Failed to stop GSM Evil';
		}
	}
	
	function toggleGSMEvil() {
		console.log('Toggle GSM Evil, current status:', gsmStatus);
		if (gsmStatus === 'running') {
			console.log('GSM Evil is running, stopping...');
			stopGSMEvil().catch((error) => {
				console.error('Error stopping GSM Evil:', error);
			});
		} else if (gsmStatus === 'stopped') {
			console.log('GSM Evil is stopped, starting...');
			startGSMEvil().catch((error) => {
				console.error('Error starting GSM Evil:', error);
			});
		} else {
			console.log('GSM Evil is in state:', gsmStatus, '- not starting or stopping');
		}
	}
	
	function handleIframeLoad() {
		isLoading = false;
		hasError = false;
	}
	
	function handleIframeError() {
		isLoading = false;
		if (gsmStatus === 'stopped') {
			hasError = true;
			errorMessage = 'GSM Evil interface not available. Click "Start GSM Evil" to begin.';
		}
	}
	
	async function scanFrequencies() {
		if (gsmStatus !== 'stopped') {
			alert('Please stop GSM Evil before scanning frequencies');
			return;
		}
		
		isScanning = true;
		showScanResults = true;  // Always show results table
		showScanProgress = true;
		scanProgress = [];
		scanStatus = '';
		
		try {
			// Use streaming endpoint for real-time progress
			const response = await fetch('/api/gsm-evil/intelligent-scan-stream', {
				method: 'POST'
			});
			
			if (!response.ok) {
				throw new Error('Scan request failed');
			}
			
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();
			
			if (!reader) {
				throw new Error('No response body');
			}
			
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				
				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');
				
				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const data = JSON.parse(line.slice(6));
							
							if (data.message) {
								// Add progress message
								scanProgress = [...scanProgress, data.message];
								// Auto-scroll to bottom
								setTimeout(() => {
									const consoleBody = document.querySelector('.console-body');
									if (consoleBody) {
										consoleBody.scrollTop = consoleBody.scrollHeight;
									}
								}, 10);
							}
							
							if (data.result) {
								// Handle final result
								if (data.result.success && data.result.bestFrequency) {
									selectedFrequency = data.result.bestFrequency;
									scanResults = data.result.scanResults || [];
									scanStatus = `Selected ${data.result.bestFrequency} MHz with ${data.result.bestFrequencyFrames} GSM frames`;
									console.log('Scan complete. Results:', scanResults.length, 'frequencies');
									// Force UI update with small delay
									setTimeout(() => {
										scanResults = [...scanResults];
									}, 100);
								}
							}
						} catch (e) {
							console.error('Failed to parse SSE data:', e);
						}
					}
				}
			}
		} catch (error) {
			console.error('Scan failed:', error);
			scanProgress = [...scanProgress, `[ERROR] ${error}`];
			
			// Fallback to regular scan
			try {
				scanProgress = [...scanProgress, '[FALLBACK] Attempting basic RF power scan...'];
				const fallbackResponse = await fetch('/api/gsm-evil/scan', {
					method: 'POST'
				});
				
				if (fallbackResponse.ok) {
					const data = await fallbackResponse.json();
					if (data.strongestFrequency) {
						selectedFrequency = data.strongestFrequency;
						scanResults = data.scanResults || [];
						scanProgress = [...scanProgress, `[FALLBACK] Selected ${data.strongestFrequency} MHz (strongest signal)`];
					}
				}
			} catch (fallbackError) {
				scanProgress = [...scanProgress, '[ERROR] Fallback scan also failed'];
			}
		} finally {
			isScanning = false;
		}
	}
	
	async function fetchRealFrames() {
		try {
			const response = await fetch('/api/gsm-evil/frames');
			if (response.ok) {
				const data = await response.json();
				if (data.frames && data.frames.length > 0) {
					gsmFrames = data.frames;
				}
			}
		} catch (error) {
			console.error('Failed to fetch GSM frames:', error);
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
					capturedIMSIs = data.imsis;
					totalIMSIs = data.total;
				}
			}
		} catch (error) {
			console.error('Failed to fetch IMSIs:', error);
		}
	}
	
	function startFrameUpdates() {
		// Fetch real frames and activity every 2 seconds when GSM Evil is running
		frameUpdateInterval = setInterval(() => {
			if (gsmStatus === 'running') {
				fetchRealFrames();
				checkActivity();
				fetchIMSIs();
			}
		}, 2000);
		
		// Initial fetch if already running
		if (gsmStatus === 'running') {
			fetchRealFrames();
			checkActivity();
			fetchIMSIs();
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
					<a
						href="/"
						class="back-btn"
					>
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
						</svg>
						Back to Console
					</a>
					<div class="title-section">
						<div class="title-wrapper">
							<div class="icon-wrapper">
								<svg class="icon" fill="currentColor" viewBox="0 0 24 24">
									<path d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1M12,18A1,1 0 0,0 13,17A1,1 0 0,0 12,16A1,1 0 0,0 11,17A1,1 0 0,0 12,18M8,8H16V10H8V8M8,11H13V13H8V11Z"></path>
								</svg>
							</div>
							<div class="flex flex-col">
								<h1 class="font-heading text-h4 font-semibold tracking-tight leading-tight">
									<span class="gsm-brand">GSM</span>
									<span class="evil-brand">Evil</span>
								</h1>
								<span class="subtitle font-bold">
									Cellular Network Analysis
								</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Section - Buttons -->
				<div class="flex items-center gap-3">
					<!-- Status Debug Info -->
					<div class="text-xs font-mono">
						<span class="text-white font-bold">Status:</span>
						<span class="{gsmStatus === 'running' ? 'text-green-500' : 'text-red-500'} font-bold">{gsmStatus}</span>
					</div>
					
					<!-- Start/Stop GSM Evil Button (moved to left) -->
					<button
						on:click={toggleGSMEvil}
						disabled={gsmStatus === 'starting' || gsmStatus === 'stopping'}
						class="control-btn
						{gsmStatus === 'stopped' ? 'btn-start' : ''}
						{gsmStatus === 'running' ? 'btn-stop' : ''}
						{gsmStatus === 'starting' || gsmStatus === 'stopping' ? 'btn-loading' : ''}"
					>
						{#if gsmStatus === 'stopped'}
							<span class="font-bold">Start GSM Evil</span>
						{:else if gsmStatus === 'running'}
							<span class="font-bold">Stop GSM Evil</span>
						{:else if gsmStatus === 'starting'}
							<span class="font-bold">Starting...</span>
						{:else}
							<span class="font-bold">Stopping...</span>
						{/if}
					</button>
					
					<!-- Start Scan and Clear Results Buttons (only show when stopped) -->
					{#if gsmStatus === 'stopped'}
						<button
							class="control-btn scan-btn-yellow"
							on:click={scanFrequencies}
							disabled={isScanning}
						>
							{#if isScanning}
								<span class="font-bold">Scanning...</span>
							{:else}
								<span class="font-bold">Start Scan</span>
							{/if}
						</button>
						
						<button
							class="control-btn clear-btn-blue"
							on:click={clearResults}
						>
							<span class="font-bold">Clear Results</span>
						</button>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<!-- Frequency Selector Panel (Compact) -->
	{#if gsmStatus === 'stopped'}
		<div class="frequency-panel-compact">
			<div class="frequency-container">
				<!-- Scan Progress Console (Always visible) -->
				<div class="scan-progress-console">
					<div class="console-header">
						<span class="console-title">CONSOLE</span>
						<span class="console-status">{isScanning ? 'SCANNING...' : scanProgress.length > 0 ? 'COMPLETE' : 'READY'}</span>
					</div>
					<div class="console-body">
						{#if scanProgress.length > 0}
							{#each scanProgress as line}
								<div class="console-line {line.startsWith('[ERROR]') ? 'error' : line.startsWith('[CMD]') ? 'command' : line.startsWith('[TEST') ? 'test' : line.includes('=====') ? 'header' : ''}">
									{line}
								</div>
							{/each}
							{#if isScanning}
								<div class="console-cursor">█</div>
							{/if}
						{:else}
							<div class="console-line text-gray-500">Frequency scanner console ready.</div>
							<div class="console-line text-gray-500">Click "Scan Area" to begin scanning for GSM frequencies.</div>
							<div class="console-line text-gray-500">The scanner will test multiple frequencies and show real-time progress here.</div>
						{/if}
					</div>
				</div>
				
				<!-- Scan Results Table (Always visible) -->
				<div class="scan-results-table">
					<h4 class="table-title">Frequency Scan Results</h4>
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
										<tr class="{selectedFrequency === result.frequency ? 'selected' : ''}">
											<td class="freq-cell">{result.frequency} MHz</td>
											<td class="signal-cell">{result.power.toFixed(1)} dB</td>
											<td>
												<span class="quality-badge {result.strength.toLowerCase().replace(' ', '-')}">{result.strength}</span>
											</td>
											<td>
												{#if result.channelType}
													<span class="channel-type {result.controlChannel ? 'control' : ''}">{result.channelType}</span>
												{:else}
													<span class="channel-type unknown">-</span>
												{/if}
											</td>
											<td class="frames-cell">
												{#if result.frameCount !== undefined}
													<span class="frame-count">{result.frameCount}</span>
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
													class="select-btn {selectedFrequency === result.frequency ? 'selected' : ''}"
													on:click={() => selectedFrequency = result.frequency}
												>
													{selectedFrequency === result.frequency ? 'Selected' : 'Select'}
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{:else}
							<div class="empty-table">
								<p class="text-gray-500">No scan results yet. Click "Scan Area" to search for GSM frequencies.</p>
								<p class="text-gray-600 text-sm mt-2">The scanner will automatically detect active GSM channels in your area.</p>
							</div>
						{/if}
					</div>
					{#if scanResults.length > 0}
						<p class="table-footer">
							Found {scanResults.length} active frequencies • Sorted by GSM frame count
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Status Panel (when running) -->
	{#if gsmStatus === 'running' && detailedStatus}
		<div class="status-panel">
			<div class="status-grid">
				<!-- IMSI Capture Status -->
				<div class="status-card">
					<div class="status-card-header">
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
						</svg>
						<span class="font-semibold">IMSI Capture</span>
						<span class="text-xs text-gray-400 ml-2">(Live Data) • {detailedStatus.dataCollection.active ? 'Receiving' : 'No Data'}</span>
					</div>
					<div class="frame-monitor">
						<div class="frame-header">
							{#if totalIMSIs > 0}
								<span class="text-xs text-green-400 blink">● {totalIMSIs} IMSIs captured</span>
							{:else}
								<span class="text-xs text-yellow-400">● Waiting for IMSIs</span>
							{/if}
						</div>
						<div class="frame-display">
							{#if capturedIMSIs.length > 0}
								<div class="imsi-header text-xs text-gray-500 mb-1">
									<span style="width: 140px; display: inline-block;">IMSI</span>
									<span style="width: 80px; display: inline-block;">MCC/MNC</span>
									<span>Time</span>
								</div>
								{#each capturedIMSIs.slice(0, 4) as imsi, i}
									<div class="frame-line {i === 0 ? 'text-green-400' : ''}">
										<span style="width: 140px; display: inline-block; font-family: monospace;">{imsi.imsi}</span>
										<span style="width: 80px; display: inline-block;">{imsi.mcc}/{imsi.mnc}</span>
										<span class="text-xs">{imsi.timestamp.split(' ')[0]}</span>
									</div>
								{/each}
							{:else}
								<div class="frame-line text-gray-500">No IMSIs captured yet...</div>
								<div class="frame-line text-gray-600">Waiting for mobile devices...</div>
								<div class="frame-line text-gray-600">IMSI sniffer is active</div>
								<div class="frame-line text-gray-600">-- -- -- -- -- -- -- --</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- GSM Capture Status -->
				<div class="status-card">
					<div class="status-card-header">
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
						</svg>
						<span class="font-semibold">GSM Capture</span>
					</div>
					<div class="frame-monitor">
						<div class="frame-header">
							<span class="text-xs text-gray-400">Raw GSM Frames</span>
							<span class="text-xs text-gray-400">
								{activityStatus.currentFrequency} MHz • {activityStatus.message}
							</span>
						</div>
						<div class="frame-display">
							{#if gsmFrames.length > 0}
								{#each gsmFrames.slice(0, 6) as frame, i}
									<div class="frame-line {i === 0 ? 'text-green-400' : ''}">{frame}</div>
								{/each}
							{:else}
								<div class="frame-line text-gray-500">No GSM frames captured yet...</div>
								<div class="frame-line text-gray-600">Waiting for GSM data...</div>
								{#if !activityStatus.hasActivity}
									<div class="frame-line text-yellow-500">No GSM data detected - try different frequencies</div>
								{/if}
								<div class="frame-line text-gray-600">-- -- -- -- -- -- -- --</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Radio Monitor Status -->
				<div class="status-card">
					<div class="status-card-header">
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
							<path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
						</svg>
						<span class="font-semibold">Radio Monitor</span>
					</div>
					<div class="status-card-content">
						<div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
							<div style="display: flex; align-items: center; gap: 0.75rem;">
								<div class="status-indicator {detailedStatus.grgsm.running ? 'active' : 'inactive'}"></div>
								<span class="status-text font-medium">GSM Demodulator (gr-gsm)</span>
							</div>
							<div style="display: flex; align-items: center; gap: 0.75rem;">
								<div class="status-indicator {detailedStatus.gsmevil.webInterface ? 'active' : 'inactive'}"></div>
								<span class="status-text font-medium">Web Interface (Port 80)</span>
							</div>
							<div style="display: flex; align-items: center; gap: 0.75rem;">
								<div class="status-indicator {detailedStatus.grgsm.running ? 'active' : 'inactive'}"></div>
								<span class="status-text font-medium">HackRF One SDR</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	<div class="relative" style="height: calc(100vh - {gsmStatus === 'running' && detailedStatus ? '144px' : gsmStatus === 'stopped' ? '120px' : '64px'});">
		{#if gsmStatus === 'starting'}
			<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800 z-50">
				<div class="text-center max-w-md">
					<div class="inline-flex items-center justify-center w-20 h-20 mb-4">
						<svg class="animate-spin h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-white mb-2">Starting GSM Evil</h3>
					<p class="text-gray-400 mb-4">Frequency: <span class="text-green-500 font-mono">{selectedFrequency} MHz</span></p>
					<div class="space-y-2 text-sm text-gray-500">
						<p>1. Initializing radio hardware...</p>
						<p>2. Tuning to frequency...</p>
						<p>3. Starting web interface...</p>
						<p>4. Enabling IMSI sniffer...</p>
						<p class="text-xs mt-4">This takes 10-15 seconds</p>
					</div>
				</div>
			</div>
		{/if}
		

		{#if gsmStatus === 'stopped' && !isLoading}
			<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
				<div class="text-center max-w-2xl mx-auto p-8">
					<!-- Phone Icon -->
					<div class="relative mb-8">
						<svg class="w-32 h-32 text-red-500 mx-auto opacity-80" fill="currentColor" viewBox="0 0 24 24">
							<path d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1M12,18A1,1 0 0,0 13,17A1,1 0 0,0 12,16A1,1 0 0,0 11,17A1,1 0 0,0 12,18M8,8H16V10H8V8M8,11H13V13H8V11Z"></path>
						</svg>
					</div>
					
					<!-- Main Content -->
					<div class="space-y-6">
						<div>
							<h1 class="text-4xl font-bold text-white mb-2">
								<span class="text-red-400">GSM EVIL 2</span> IMSI Catcher
							</h1>
							<div class="h-1 w-32 bg-gradient-to-r from-red-500 to-red-800 mx-auto rounded-full"></div>
						</div>
						
						<p class="text-xl text-gray-300 leading-relaxed">
							Advanced cellular network interception and analysis platform
						</p>
						
						<!-- Feature Grid -->
						<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-12">
							<div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
								<svg class="w-8 h-8 text-red-400 mb-3" fill="currentColor" viewBox="0 0 20 20">
									<path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
									<path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
								</svg>
								<h3 class="text-white font-semibold mb-2">IMSI Capture</h3>
								<p class="text-gray-400 text-sm">
									Intercept and log subscriber identity numbers
								</p>
							</div>
							
							<div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
								<svg class="w-8 h-8 text-red-400 mb-3" fill="currentColor" viewBox="0 0 20 20">
									<path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
									<path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
								</svg>
								<h3 class="text-white font-semibold mb-2">SMS Interception</h3>
								<p class="text-gray-400 text-sm">
									Capture and decode text messages in real-time
								</p>
							</div>
							
							<div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
								<svg class="w-8 h-8 text-red-400 mb-3" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l3.707 3.707A1 1 0 0018 17.414V6a1 1 0 00-.293-.707z" clip-rule="evenodd"/>
								</svg>
								<h3 class="text-white font-semibold mb-2">GSM Analysis</h3>
								<p class="text-gray-400 text-sm">
									Monitor GSM900/1800 bands with HackRF SDR
								</p>
							</div>
						</div>
						
						<!-- Start Button -->
						<button
							on:click={startGSMEvil}
							class="inline-flex items-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-4 focus:ring-red-900 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
						>
							<svg class="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
							</svg>
							Start GSM Evil 2
						</button>
						
						<!-- Status Message -->
						<p class="text-gray-400 text-sm mt-6">
							Ensure HackRF is connected and gr-gsm is properly configured
						</p>
						<p class="text-gray-400 text-sm mt-2">
							IMSI sniffer interface will open automatically after starting
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- GSM Evil Interface (when running) -->
		{#if gsmStatus === 'running'}
			<iframe
				src={iframeUrl}
				title="GSM Evil Interface"
				class="w-full h-full border-0"
				style="display: {isLoading ? 'none' : 'block'}"
				on:load={handleIframeLoad}
				on:error={handleIframeError}
			></iframe>
			{#if isLoading}
				<div class="absolute inset-0 flex items-center justify-center bg-black">
					<div class="text-center">
						<div class="inline-flex items-center justify-center w-16 h-16 mb-4">
							<svg class="animate-spin h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
						<p class="text-gray-400 font-mono">Loading IMSI Sniffer interface...</p>
						<p class="text-xs text-gray-500 mt-2">IMSI capture will start automatically</p>
					</div>
				</div>
			{/if}
		{/if}
	</div>
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

	.back-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #9ca3af;
		text-decoration: none;
		font-size: 0.875rem;
		transition: all 0.2s ease;
	}

	.back-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.2);
		color: #fff;
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
		box-shadow: 0 8px 25px rgba(255, 0, 0, 0.2), 0 0 15px rgba(255, 0, 0, 0.15);
	}

	.icon {
		width: 24px;
		height: 24px;
		color: #ff0000;
	}

	.gsm-brand {
		color: #ff0000;
		text-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
	}

	.evil-brand {
		color: #ffffff;
		font-weight: bold;
	}

	.subtitle {
		font-family: 'Courier New', monospace;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #9CA3AF;
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

	.btn-start {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		border: 1px solid rgba(16, 185, 129, 0.3);
		color: white;
		box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.btn-start:hover:not(:disabled) {
		background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
		box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	.btn-stop {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: white;
		box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.btn-stop:hover:not(:disabled) {
		background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
		box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	.btn-loading {
		background: linear-gradient(135deg, #fb923c 0%, #ea580c 100%);
		border: 1px solid rgba(251, 146, 60, 0.3);
		color: white;
		box-shadow: 0 4px 15px rgba(251, 146, 60, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
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
		color: #ffffff;
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

	/* Yellow Scan Button */
	.scan-btn-yellow {
		background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important;
		border: 1px solid rgba(251, 191, 36, 0.3) !important;
		color: white !important;
		box-shadow: 0 4px 15px rgba(251, 191, 36, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.scan-btn-yellow:hover:not(:disabled) {
		background: linear-gradient(135deg, #fcd34d 0%, #fbbf24 100%) !important;
		box-shadow: 0 6px 20px rgba(251, 191, 36, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	/* Blue Clear Button */
	.clear-btn-blue {
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
		border: 1px solid rgba(37, 99, 235, 0.3) !important;
		color: white !important;
		box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.clear-btn-blue:hover:not(:disabled) {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
		box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}

	/* Compact Frequency Panel */
	.frequency-panel-compact {
		background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
		border-bottom: 1px solid #333;
		padding: 0.75rem 1rem;
	}

	.frequency-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.5rem;
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
		border: 2px solid #333;
		border-radius: 0.5rem;
		overflow: hidden;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
	}

	.console-header {
		background: linear-gradient(to right, #1a1a1a, #2a2a2a);
		padding: 0.75rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #444;
	}

	.console-title {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		font-weight: bold;
		color: #22c55e;
		letter-spacing: 0.05em;
	}

	.console-status {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.75rem;
		color: #fbbf24;
		animation: pulse 2s infinite;
	}

	.console-body {
		padding: 1rem;
		max-height: 400px;
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
		color: #22c55e;
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
		color: #22c55e;
		font-weight: bold;
	}

	/* Custom scrollbar for console */
	.console-body::-webkit-scrollbar {
		width: 10px;
	}

	.console-body::-webkit-scrollbar-track {
		background: #1a1a1a;
		border-radius: 5px;
	}

	.console-body::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 5px;
		border: 1px solid #333;
	}

	.console-body::-webkit-scrollbar-thumb:hover {
		background: #555;
	}

	/* Scan Results Table */
	.scan-results-table {
		margin-top: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #333;
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
		border: 1px solid #333;
	}

	.frequency-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.frequency-table thead {
		background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
	}

	.frequency-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #fff;
		border-bottom: 2px solid #444;
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
		border-left: 3px solid #22c55e;
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
		background: linear-gradient(to right, #ef4444, #fbbf24, #22c55e);
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
		background: rgba(52, 211, 153, 0.2);
		color: #34d399;
		border: 1px solid rgba(52, 211, 153, 0.3);
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
		color: #22c55e;
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
		background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
		border: 1px solid #444;
		border-radius: 0.25rem;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		text-transform: uppercase;
	}

	.select-btn:hover {
		background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
		border-color: #555;
	}

	.select-btn.selected {
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
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
		padding: 3rem 2rem;
		text-align: center;
		color: #9ca3af;
	}

	.empty-table p {
		margin: 0;
	}


	@keyframes blink {
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
	}

	/* Status Panel */
	.status-panel {
		background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
		border-bottom: 1px solid #333;
		padding: 1rem;
	}

	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.status-card {
		background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
		border: 1px solid #444;
		border-radius: 0.375rem;
		padding: 1rem;
		transition: all 0.3s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.status-card:hover {
		background: linear-gradient(135deg, #333 0%, #222 100%);
		border-color: #555;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
	}

	.status-card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #fff;
		margin-bottom: 0.75rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.status-card-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.875rem;
	}

	.status-indicator {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		transition: all 0.3s ease;
	}

	.status-indicator.active {
		background: #10b981;
		box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
	}

	.status-card-header svg {
		color: #ef4444;
		opacity: 0.9;
	}

	.status-card.expanded {
		grid-column: span 2;
	}

	.frame-monitor {
		margin-top: 0.75rem;
	}

	.frame-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.frame-display {
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid #333;
		border-radius: 0.25rem;
		padding: 0.5rem;
		font-family: 'Courier New', monospace;
		font-size: 0.75rem;
		max-height: 100px;
		overflow-y: auto;
	}

	.frame-line {
		color: #9ca3af;
		line-height: 1.4;
		white-space: pre;
	}

	.text-green-400 {
		color: #4ade80;
	}

	.blink {
		animation: blink 1s ease-in-out infinite;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.status-indicator.inactive {
		background: #6b7280;
	}

	.status-indicator.pulse {
		animation: pulse 2s infinite;
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
		0% { opacity: 1; }
		50% { opacity: 0.5; }
		100% { opacity: 1; }
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
		0%, 100% { transform: scale(1); opacity: 0.3; }
		50% { transform: scale(1.1); opacity: 0.1; }
	}

</style>