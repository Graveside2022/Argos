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
	let scanResults: { frequency: string; power: number; strength: string; frameCount?: number; hasGsmActivity?: boolean }[] = [];
	let showScanResults = false;
	let capturedIMSIs: any[] = [];
	let totalIMSIs = 0;
	let scanStatus = '';

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
		showScanResults = false;
		scanStatus = 'Performing intelligent scan... Testing for GSM frame activity';
		
		try {
			// Use intelligent scan that tests for actual GSM frames
			const response = await fetch('/api/gsm-evil/intelligent-scan', {
				method: 'POST'
			});
			
			if (response.ok) {
				const data = await response.json();
				if (data.bestFrequency) {
					selectedFrequency = data.bestFrequency;
					// Store scan results
					if (data.scanResults && data.scanResults.length > 0) {
						scanResults = data.scanResults;
						showScanResults = true;
					}
					// Show scan summary
					if (data.message) {
						console.log('Intelligent scan results:', data.message);
						scanStatus = `Selected ${data.bestFrequency} MHz with ${data.bestFrequencyFrames} GSM frames`;
					}
				}
			} else {
				// Fallback to regular scan if intelligent scan fails
				const fallbackResponse = await fetch('/api/gsm-evil/scan', {
					method: 'POST'
				});
				
				if (fallbackResponse.ok) {
					const data = await fallbackResponse.json();
					if (data.strongestFrequency) {
						selectedFrequency = data.strongestFrequency;
						scanResults = data.scanResults || [];
						showScanResults = true;
						scanStatus = 'Using RF power scan (fallback mode)';
					}
				}
			}
		} catch (error) {
			console.error('Scan failed:', error);
			alert('Failed to scan frequencies');
			scanStatus = '';
		} finally {
			isScanning = false;
			// Clear status after a few seconds
			setTimeout(() => {
				scanStatus = '';
			}, 5000);
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
					
					<!-- Start/Stop GSM Evil Button -->
					<button
						on:click={toggleGSMEvil}
						disabled={gsmStatus === 'starting' || gsmStatus === 'stopping'}
						class="control-btn
						{gsmStatus === 'stopped' ? 'btn-start' : ''}
						{gsmStatus === 'running' ? 'btn-stop' : ''}
						{gsmStatus === 'starting' || gsmStatus === 'stopping' ? 'btn-loading' : ''}"
					>
						{#if gsmStatus === 'stopped'}
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
							</svg>
							<span class="font-bold">Start GSM Evil</span>
						{:else if gsmStatus === 'running'}
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
							</svg>
							<span class="font-bold">Stop GSM Evil</span>
						{:else if gsmStatus === 'starting'}
							<svg class="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 10.586V7z" clip-rule="evenodd" />
							</svg>
							Starting...
						{:else}
							<svg class="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 10.586V7z" clip-rule="evenodd" />
							</svg>
							Stopping...
						{/if}
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Frequency Selector Panel -->
	{#if gsmStatus === 'stopped'}
		<div class="frequency-panel">
			<div class="frequency-container">
				<div class="frequency-header">
					<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
						<path d="M14.064 2.64a1 1 0 011.296 1.408l-1 1.25a1 1 0 11-1.568-1.248l1-1.25a1 1 0 01.272-.16zM5.936 2.64a1 1 0 01.272.16l1 1.25a1 1 0 01-1.568 1.248l-1-1.25A1 1 0 015.936 2.64zM10 6a4 4 0 00-4 4c0 .601.132 1.17.368 1.68l-3.076 3.076a1 1 0 101.414 1.414l3.076-3.076A3.978 3.978 0 0010 14a4 4 0 000-8zm0 2a2 2 0 110 4 2 2 0 010-4z"/>
					</svg>
					<h3 class="text-lg font-semibold text-white">Select Frequency</h3>
				</div>
				
				<div class="frequency-options">
					<button
						class="freq-btn scan-btn-blue"
						on:click={scanFrequencies}
						disabled={isScanning}
					>
						{#if isScanning}
							<svg class="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 10.586V7z" clip-rule="evenodd" />
							</svg>
							Scanning...
						{:else}
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
							</svg>
							Scan Area
						{/if}
					</button>
				</div>
				
				<div class="selected-freq-display">
					Selected: <span class="text-green-500 font-bold">{selectedFrequency} MHz</span>
				</div>
				
				{#if scanStatus}
					<div class="scan-status">
						{scanStatus}
					</div>
				{/if}
				
				{#if showScanResults && scanResults.length > 0}
					<div class="scan-results">
						<h4 class="text-sm font-semibold text-gray-300 mb-2">Scan Results - All Active Frequencies:</h4>
						<div class="scan-results-grid">
							{#each scanResults as result}
								<button
									class="scan-result-btn {selectedFrequency === result.frequency ? 'selected' : ''}"
									on:click={() => selectedFrequency = result.frequency}
									title="{result.power.toFixed(1)} dB{result.frameCount !== undefined ? ` - ${result.frameCount} frames` : ''}"
								>
									<span class="freq-value">{result.frequency} MHz</span>
									<span class="freq-power">{result.power.toFixed(1)} dB</span>
									<span class="freq-strength {result.strength.toLowerCase().replace(' ', '-')}">{result.strength}</span>
									{#if result.frameCount !== undefined}
										<span class="freq-frames {result.hasGsmActivity ? 'active' : 'inactive'}">
											{result.frameCount} frames {result.hasGsmActivity ? '✓' : ''}
										</span>
									{/if}
								</button>
							{/each}
						</div>
						<p class="text-xs text-gray-400 mt-2">Found {scanResults.length} active frequencies. Click any to select.</p>
					</div>
				{/if}
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
	<div class="relative" style="height: calc(100vh - {gsmStatus === 'running' && detailedStatus ? '144px' : gsmStatus === 'stopped' ? '200px' : '64px'});">
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
		
		{#if isLoading && gsmStatus !== 'starting'}
			<div class="absolute inset-0 flex items-center justify-center bg-gray-900">
				<div class="text-center">
					<div class="inline-flex items-center justify-center w-16 h-16 mb-4">
						<svg class="animate-spin h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
					<p class="text-gray-400 font-mono">Loading GSM Evil Interface...</p>
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

	/* Frequency Panel */
	.frequency-panel {
		background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
		border-bottom: 1px solid #333;
		padding: 1.5rem 1rem;
	}

	.frequency-container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.frequency-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
		justify-content: center;
	}

	.frequency-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.freq-btn {
		background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
		border: 1px solid #444;
		border-radius: 0.375rem;
		padding: 0.75rem;
		color: white;
		cursor: pointer;
		transition: all 0.3s ease;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.freq-btn:hover {
		background: linear-gradient(135deg, #333 0%, #222 100%);
		border-color: #555;
		transform: translateY(-1px);
	}

	.freq-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.freq-selected {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
		border-color: rgba(16, 185, 129, 0.5) !important;
		box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
	}

	.scan-btn {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		border-color: rgba(239, 68, 68, 0.5);
	}
	
	.scan-btn-blue {
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
		border-color: rgba(37, 99, 235, 0.5) !important;
		color: white;
		min-width: 200px;
		font-weight: 600;
		box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
	}
	
	.scan-btn-blue:hover {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
		border-color: rgba(59, 130, 246, 0.5) !important;
		transform: translateY(-1px);
		box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
	}
	
	.scan-btn-blue:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	.scan-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
	}

	.freq-value {
		font-size: 1rem;
		font-weight: 600;
	}

	.freq-strength {
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.selected-freq-display {
		text-align: center;
		font-size: 0.875rem;
		color: #9ca3af;
	}
	
	.scan-status {
		text-align: center;
		font-size: 0.875rem;
		color: #60a5fa;
		margin-top: 0.5rem;
		font-style: italic;
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
	
	/* Scan Results Styles */
	.scan-results {
		margin-top: 1rem;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid #333;
		border-radius: 0.5rem;
	}
	
	.scan-results-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	
	.scan-result-btn {
		padding: 0.5rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid #333;
		border-radius: 0.25rem;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
	}
	
	.scan-result-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: #666;
	}
	
	.scan-result-btn.selected {
		background: rgba(34, 197, 94, 0.2);
		border-color: rgb(34, 197, 94);
	}
	
	.freq-strength {
		font-size: 0.625rem;
		padding: 0.125rem 0.25rem;
		border-radius: 0.125rem;
		background: rgba(255, 255, 255, 0.1);
	}
	
	.freq-frames {
		font-size: 0.625rem;
		padding: 0.125rem 0.25rem;
		border-radius: 0.125rem;
		margin-top: 0.125rem;
	}
	
	.freq-frames.active {
		background: rgba(34, 197, 94, 0.2);
		color: rgb(34, 197, 94);
	}
	
	.freq-frames.inactive {
		background: rgba(239, 68, 68, 0.2);
		color: rgb(248, 113, 113);
	}
	
	.freq-strength.very-strong {
		color: #10b981;
		background: rgba(16, 185, 129, 0.2);
	}
	
	.freq-strength.strong {
		color: #34d399;
		background: rgba(52, 211, 153, 0.2);
	}
	
	.freq-strength.good {
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.2);
	}
	
	.freq-strength.moderate {
		color: #f59e0b;
		background: rgba(245, 158, 11, 0.2);
	}
	
	.freq-strength.weak {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.2);
	}
	
	.freq-power {
		font-size: 0.875rem;
		font-weight: 600;
		color: #fff;
		margin: 0.25rem 0;
	}

</style>