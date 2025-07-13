<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { hackrfAPI } from '$lib/services/hackrf/api';
	import { spectrumData, sweepStatus, cycleStatus, connectionStatus } from '$lib/stores/hackrf';

	let frequencies: Array<{ id: number; value: number | string }> = [{ id: 1, value: 2400 }];
	let cycleTime = 10;
	let isStarted = false;
	let currentFrequencyDisplay = '--';
	let switchTimer = '--';
	let timerProgress = 0;
	let dbLevelValue = '--.--';
	let signalStrengthText = 'No Signal';
	let targetFrequency = '--';
	let detectedFrequency = '--';
	let frequencyOffset = '--';
	let statusMessage = '';
	let signalFillWidth = '0%';
	let dbIndicatorPosition = '0%';
	let dbCurrentValue = '-90 dB';

	let frequencyCounter = 1;
	let _timerInterval: ReturnType<typeof setInterval> | null = null;
	let _progressInterval: ReturnType<typeof setInterval> | null = null;
	let localTimerInterval: ReturnType<typeof setInterval> | null = null;
	let localTimeRemaining = 0;
	let isSwitching = false;
	const SWITCH_DELAY = 3; // seconds for frequency switch

	function addFrequency() {
		frequencyCounter++;
		frequencies = [...frequencies, { id: frequencyCounter, value: '' }];
	}

	function removeFrequency(id: number) {
		frequencies = frequencies.filter((f) => f.id !== id);
	}

	async function startCycling() {
		if (frequencies.length === 0 || !frequencies.some((f) => f.value)) {
			alert('Please add at least one frequency');
			return;
		}

		try {
			const validFreqs = frequencies
				.filter((f) => f.value)
				.map((f) => ({
					start: Number(f.value) - 10,
					stop: Number(f.value) + 10,
					step: 1
				}));

			// Starting sweep with frequencies
			const _response = await hackrfAPI.startSweep(validFreqs, cycleTime);
			// Start sweep response received
			statusMessage = 'Sweep started successfully';

			// Store target frequencies for offset calculation
			const validFreqValues = frequencies.filter((f) => f.value);
			if (validFreqValues.length > 0) {
				currentFrequencyDisplay = validFreqValues[0].value + ' MHz';
				targetFrequency = validFreqValues[0].value + ' MHz';
			}

			// Start local timer as backup
			startLocalTimer();
		} catch (error) {
			// Failed to start sweep
			// Properly handle error type
			if (error instanceof Error) {
				statusMessage = 'Failed to start sweep: ' + error.message;
			} else {
				statusMessage = 'Failed to start sweep: ' + String(error);
			}
		}
	}

	async function stopCycling() {
		try {
			// Stop button clicked

			const _response = await hackrfAPI.stopSweep();
			// Stop sweep response received

			statusMessage = 'Sweep stopped';
			resetDisplays();
			// Force update isStarted in case store doesn't update quickly enough
			isStarted = false;
			// Stop local timer
			stopLocalTimer();

			// Force update the stores manually as backup
			sweepStatus.set({
				active: false,
				startFreq: 0,
				endFreq: 0,
				currentFreq: 0,
				progress: 0
			});

			cycleStatus.set({
				active: false,
				currentCycle: 0,
				totalCycles: 0,
				progress: 0
			});

			// Stop completed
		} catch (error) {
			// Failed to stop sweep

			// Properly handle error type
			if (error instanceof Error) {
				statusMessage = 'Failed to stop sweep: ' + error.message;
			} else {
				statusMessage = 'Failed to stop sweep';
			}
		}
	}

	// Manual reconnect function
	function reconnectToHackRF() {
		// Manual reconnect initiated
		statusMessage = 'Reconnecting...';
		void hackrfAPI.reconnect();
	}

	function startLocalTimer() {
		// Always clear existing timer before starting new one
		stopLocalTimer();
		localTimeRemaining = cycleTime;

		// Update immediately
		switchTimer = localTimeRemaining + 's';
		timerProgress = 0;

		localTimerInterval = setInterval(() => {
			if (isSwitching) {
				// Don't count down during switch
				return;
			}

			localTimeRemaining--;
			if (localTimeRemaining <= 0) {
				// Start switching phase
				isSwitching = true;
				statusMessage = 'Switching frequency...';

				// Show switching in timer
				switchTimer = 'Switching...';

				// Clear signal analysis during switch
				dbLevelValue = '--.--';
				signalStrengthText = 'Switching...';
				detectedFrequency = '--';
				frequencyOffset = '--';
				updateSignalIndicator(-100); // Reset signal bar

				// Update frequency display after a short delay to match backend
				setTimeout(() => {
					const validFreqs = frequencies.filter((f) => f.value);
					if (validFreqs.length > 0) {
						// Valid frequencies: validFreqs.map(f => f.value)
						// Current display: currentFrequencyDisplay

						// Find current frequency more reliably
						let currentIndex = -1;
						for (let i = 0; i < validFreqs.length; i++) {
							const freqValue = String(validFreqs[i].value);
							// Checking if "${currentFrequencyDisplay}" includes "${freqValue}"
							if (currentFrequencyDisplay.includes(freqValue)) {
								currentIndex = i;
								// Found match at index: i
								break;
							}
						}

						// Current frequency: currentFrequencyDisplay, Index: currentIndex

						// If not found (shouldn't happen), default to 0
						if (currentIndex === -1) {
							// Could not find current frequency index, defaulting to 0
							currentIndex = 0;
						}

						const nextIndex = (currentIndex + 1) % validFreqs.length;
						// Calculation: currentIndex + 1 = (currentIndex + 1) mod validFreqs.length = nextIndex
						// Next frequency will be: validFreqs[nextIndex].value

						currentFrequencyDisplay = validFreqs[nextIndex].value + ' MHz';
						targetFrequency = validFreqs[nextIndex].value + ' MHz';

						// Switched to frequency: currentFrequencyDisplay
					}

					// Reset timer after switch
					localTimeRemaining = cycleTime;
					isSwitching = false;
					statusMessage = 'Sweep running';
				}, SWITCH_DELAY * 1000);
			}

			// Update timer display only when not switching
			if (!isSwitching) {
				switchTimer = localTimeRemaining + 's';
				timerProgress = ((cycleTime - localTimeRemaining) / cycleTime) * 100;
			}
		}, 1000);
	}

	function stopLocalTimer() {
		if (localTimerInterval) {
			clearInterval(localTimerInterval);
			localTimerInterval = null;
		}
		isSwitching = false;
	}

	// Update current frequency based on cycle
	$: if (
		$cycleStatus &&
		typeof $cycleStatus === 'object' &&
		$cycleStatus !== null &&
		'active' in $cycleStatus &&
		$cycleStatus.active
	) {
		const validFreqs = frequencies.filter((f) => f.value);
		if ('currentCycle' in $cycleStatus && typeof $cycleStatus.currentCycle === 'number') {
			const currentIndex = ($cycleStatus.currentCycle - 1) % validFreqs.length;
			if (validFreqs[currentIndex]) {
				targetFrequency = validFreqs[currentIndex].value + ' MHz';
			}
		}
	}

	function resetDisplays() {
		currentFrequencyDisplay = '--';
		switchTimer = '--';
		timerProgress = 0;
		dbLevelValue = '--.--';
		signalStrengthText = 'No Signal';
		targetFrequency = '--';
		detectedFrequency = '--';
		frequencyOffset = '--';
	}

	function loadFrequencies() {
		// Placeholder for load frequencies functionality
		// Load frequencies clicked
	}

	async function openSpectrumAnalyzer() {
		// Stop the sweep if it's running
		if (isStarted) {
			// Stopping sweep before opening spectrum analyzer...
			await stopCycling();
		}

		// Navigate to the viewspectrum page
		window.location.href = '/viewspectrum';
	}

	// Subscribe to stores
	$: if ($spectrumData && !isSwitching) {
		// Spectrum data update: $spectrumData
		// Update signal analysis displays
		if (
			typeof $spectrumData === 'object' &&
			$spectrumData !== null &&
			'peak_power' in $spectrumData &&
			$spectrumData.peak_power !== undefined
		) {
			const peakPower = $spectrumData.peak_power;
			dbLevelValue = peakPower.toFixed(2);
			updateSignalStrength(peakPower);
			updateSignalIndicator(peakPower);
		}

		if (
			typeof $spectrumData === 'object' &&
			$spectrumData !== null &&
			'peak_freq' in $spectrumData &&
			$spectrumData.peak_freq !== undefined
		) {
			// Check if the detected frequency is reasonably close to our target
			const detectedFreqMHz = $spectrumData.peak_freq;
			const targetFreqMHz = parseFloat(targetFrequency);

			// Only update if we're within reasonable range (±50 MHz) of target
			// This helps filter out stale data from previous frequency
			if (!isNaN(targetFreqMHz) && Math.abs(detectedFreqMHz - targetFreqMHz) < 50) {
				detectedFrequency = detectedFreqMHz.toFixed(2) + ' MHz';
				const offset = detectedFreqMHz - targetFreqMHz;
				frequencyOffset = (offset >= 0 ? '+' : '') + offset.toFixed(2) + ' MHz';
			} else {
				// Data is likely from previous frequency, ignore it
				// Ignoring stale frequency data: detectedFreqMHz MHz (target: targetFreqMHz MHz)
			}
		}
	}

	// Subscribe to sweep status
	$: {
		// === SWEEP STATUS UPDATE ===
		// New sweep status: $sweepStatus
		// Previous isStarted: isStarted
		if (typeof $sweepStatus === 'object' && $sweepStatus !== null && 'active' in $sweepStatus) {
			isStarted = $sweepStatus.active;
		}
		// New isStarted: isStarted
		if (
			typeof $sweepStatus === 'object' &&
			$sweepStatus !== null &&
			'currentFreq' in $sweepStatus &&
			$sweepStatus.currentFreq
		) {
			const currentFreq = $sweepStatus.currentFreq;
			currentFrequencyDisplay = (currentFreq / 1e6).toFixed(2) + ' MHz';
		}
	}

	// Subscribe to cycle status
	$: if ($cycleStatus && typeof $cycleStatus === 'object' && $cycleStatus !== null) {
		// Cycle status update: $cycleStatus
		if ('active' in $cycleStatus && $cycleStatus.active) {
			// Don't override if local timer is running
			if (
				'timeRemaining' in $cycleStatus &&
				$cycleStatus.timeRemaining !== undefined &&
				$cycleStatus.timeRemaining > 0
			) {
				switchTimer = Math.ceil($cycleStatus.timeRemaining / 1000) + 's';
			}
			if (
				'progress' in $cycleStatus &&
				$cycleStatus.progress !== undefined &&
				$cycleStatus.progress > 0
			) {
				timerProgress = $cycleStatus.progress;
			}
		} else if (!isStarted) {
			// Only reset if truly not started
			switchTimer = '--';
			timerProgress = 0;
		}
	}

	// Subscribe to connection status and update status message
	$: {
		if (
			typeof $connectionStatus === 'object' &&
			$connectionStatus !== null &&
			'error' in $connectionStatus &&
			$connectionStatus.error
		) {
			const error = $connectionStatus.error;
			if (error.includes('No data received')) {
				statusMessage = 'Connection stale - attempting to reconnect...';
			} else if (error.includes('Recovering')) {
				statusMessage = error;
			} else if (error === 'Connection lost') {
				statusMessage = 'Connection lost - please refresh connection';
			} else if (error && error.includes('please refresh page')) {
				statusMessage = 'Connection failed - click Reconnect button';
			}
		}
	}

	// Connect to data stream on mount
	onMount(() => {
		// [onMount] Initializing HackRF page
		void hackrfAPI.connectToDataStream();

		// Set up connection health check
		const healthCheckInterval = setInterval(() => {
			if (
				typeof $connectionStatus === 'object' &&
				$connectionStatus !== null &&
				'connected' in $connectionStatus &&
				$connectionStatus.connected === false &&
				isStarted
			) {
				// [Health Check] Connection lost while sweep is active
				// Try to reconnect
				void hackrfAPI.connectToDataStream();
			}
		}, 10000); // Check every 10 seconds

		return () => {
			clearInterval(healthCheckInterval);
		};
	});

	onDestroy(() => {
		// [onDestroy] Cleaning up HackRF page
		void hackrfAPI.disconnectDataStream();
		stopLocalTimer();
		// Clear any other intervals that might be running
		if (_timerInterval) clearInterval(_timerInterval);
		if (_progressInterval) clearInterval(_progressInterval);
	});

	function updateSignalStrength(db: number) {
		if (db < -90) signalStrengthText = 'No Signal';
		else if (db < -70) signalStrengthText = 'Very Weak';
		else if (db < -50) signalStrengthText = 'Weak';
		else if (db < -30) signalStrengthText = 'Moderate';
		else if (db < -10) signalStrengthText = 'Strong';
		else signalStrengthText = 'Very Strong';
	}

	function updateSignalIndicator(db: number) {
		// Clamp between -90 and -10
		const clampedDb = Math.max(-90, Math.min(-10, db));
		const percentage = ((clampedDb + 90) / 80) * 100;

		signalFillWidth = percentage + '%';
		dbIndicatorPosition = percentage + '%';
		dbCurrentValue = clampedDb.toFixed(0) + ' dB';

		// Update fill gradient based on signal strength
		const fill = document.getElementById('signalIndicatorFill');
		if (fill) {
			if (db < -70)
				fill.className =
					'signal-indicator-fill h-full transition-[width] duration-300 ease-in-out relative z-[1] rounded-md gradient-weak';
			else if (db < -50)
				fill.className =
					'signal-indicator-fill h-full transition-[width] duration-300 ease-in-out relative z-[1] rounded-md gradient-moderate';
			else if (db < -30)
				fill.className =
					'signal-indicator-fill h-full transition-[width] duration-300 ease-in-out relative z-[1] rounded-md gradient-strong';
			else
				fill.className =
					'signal-indicator-fill h-full transition-[width] duration-300 ease-in-out relative z-[1] rounded-md gradient-very-strong';
		}

		// Update indicator position
		const indicator = document.getElementById('dbCurrentIndicator');
		if (indicator) {
			indicator.style.left = dbIndicatorPosition;
		}

		// Update current value display
		const valueDisplay = document.getElementById('dbCurrentValue');
		if (valueDisplay) {
			valueDisplay.textContent = dbCurrentValue;
		}
	}
</script>

<!-- Main Container with Black Background -->
<div class="relative min-h-screen bg-bg-primary overflow-x-hidden font-body">
	<!-- Header -->
	<header
		class="sticky top-0 z-50 backdrop-blur-2xl bg-bg-primary/80 border-b border-border-primary/50 shadow-xl"
	>
		<div class="container mx-auto px-4 lg:px-8 max-w-7xl">
			<div class="flex items-center justify-between h-16">
				<!-- Brand/Logo Section -->
				<div class="flex items-center space-x-4">
					<!-- Back to Console Button -->
					<a
						href="/"
						class="flex items-center space-x-2 px-4 py-2 rounded-lg glass-button hover:bg-bg-hover/20 transition-all duration-200"
					>
						<svg
							class="w-5 h-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 19l-7-7m0 0l7-7m-7 7h18"
							></path>
						</svg>
						<span class="font-medium text-sm">Back to Console</span>
					</a>

					<div class="flex items-center space-x-3">
						<!-- Animated Logo Icon -->
						<!-- Brand Text -->
						<div class="flex flex-col">
							<h1
								class="font-heading text-h4 font-semibold tracking-tight leading-tight"
							>
								<span class="hackrf-brand">HackRF</span>
								<span class="sweep-brand font-bold">Sweep</span>
							</h1>
							<span
								class="font-mono text-caption uppercase tracking-widest"
								style="color: #9CA3AF !important;">SDR Monitoring Platform</span
							>
						</div>
					</div>
				</div>

				<!-- Status Indicators & Actions -->
				<div class="flex items-center space-x-4">
					<!-- Connection Status -->
					<div
						class="hidden md:flex items-center space-x-3 px-3 py-2 status-panel rounded-lg"
					>
						<div class="flex items-center space-x-2">
							<div
								class="status-indicator w-2 h-2 rounded-full shadow-neon-cyan-sm"
								style="background: {$connectionStatus.connected
									? '#10b981'
									: $connectionStatus.connecting
										? '#FBBF24'
										: '#EF4444'};"
							></div>
							<span class="font-mono text-caption text-text-secondary">
								{#if $connectionStatus.error}
									{$connectionStatus.error}
								{:else if $connectionStatus.connecting}
									Connecting...
								{:else if $connectionStatus.connected}
									Connected
								{:else}
									Disconnected
								{/if}
							</span>
						</div>
						<div class="w-px h-4 bg-border-primary"></div>
						<div class="flex items-center space-x-2">
							<span class="font-mono text-caption text-text-muted">Mode:</span>
							<span class="font-mono text-caption text-neon-cyan font-semibold"
								>Sweep</span
							>
						</div>
					</div>

					<!-- Mobile Menu Button -->
					<button
						id="mobileMenuButton"
						class="lg:hidden p-2 glass-button rounded-lg"
						aria-expanded="false"
						aria-controls="mobileMenu"
						aria-label="Toggle mobile menu"
					>
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
							></path>
						</svg>
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Dashboard Grid -->
	<div class="container mx-auto px-4 lg:px-8 max-w-7xl py-8">
		<div class="grid grid-cols-1 xl:grid-cols-3 gap-8 lg:gap-12">
			<!-- Control Panel Section -->
			<div class="xl:col-span-1">
				<div class="sticky top-24 space-y-8">
					<!-- Frequency Configuration Card -->
					<div
						class="saasfly-feature-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-bg-card/90 hover:via-bg-card/70 hover:to-bg-card/50 transition-all duration-300"
					>
						<div class="flex items-center mb-6">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: linear-gradient(135deg, rgba(52, 211, 153, 0.2) 0%, rgba(52, 211, 153, 0.1) 100%) !important; border: 1px solid rgba(52, 211, 153, 0.2) !important; box-shadow: 0 8px 25px rgba(52, 211, 153, 0.2), 0 0 15px rgba(52, 211, 153, 0.15) !important;"
							>
								<svg
									class="w-6 h-6 frequency-config-icon group-hover:scale-110 transition-transform duration-300"
									fill="currentColor"
									viewBox="0 0 24 24"
									style="color: #34d399 !important;"
								>
									<path d="M3 12h4l3-9 4 18 3-9h4M3 3v18M21 3v18" />
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-xl font-semibold frequency-config-header mb-1 transition-colors duration-300"
								>
									Frequency Configuration
								</h3>
								<p
									class="text-sm text-text-muted group-hover:text-text-secondary transition-colors duration-300"
								>
									Manage target frequencies
								</p>
							</div>
						</div>

						<div class="space-y-6">
							<div>
								<div
									class="block text-sm font-medium text-text-muted mb-3 uppercase tracking-wide"
								>
									Frequencies
								</div>
								<div class="space-y-3 mb-6 max-h-[300px] overflow-y-auto">
									{#each frequencies as freq (freq.id)}
										<div
											class="frequency-item saasfly-interactive-card flex items-center gap-3 p-4 bg-gradient-to-r from-bg-card/40 to-bg-card/20 rounded-xl border border-border-primary/40 hover:border-border-hover/50 hover:bg-gradient-to-r hover:from-bg-card/60 hover:to-bg-card/40 hover:shadow-md transition-all duration-300"
										>
											<span
												class="font-mono text-sm text-text-muted font-semibold min-w-[24px] text-center bg-neon-cyan/10 rounded-lg px-2 py-1"
												>{freq.id}</span
											>
											<div class="flex-1 relative">
												<label class="sr-only" for="freq-{freq.id}"
													>Frequency {freq.id} in MHz</label
												>
												<input
													id="freq-{freq.id}"
													type="number"
													bind:value={freq.value}
													placeholder="Enter frequency"
													class="glass-input font-mono w-full pl-3 pr-12 py-2 bg-bg-input/80 border border-border-primary/60 rounded-lg text-text-primary outline-none focus:border-neon-cyan focus:bg-bg-input focus:shadow-neon-cyan-sm transition-all duration-300"
												/>
												<span
													class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-text-secondary font-medium pointer-events-none"
													>MHz</span
												>
											</div>
											{#if frequencies.length > 1}
												<button
													on:click={() => removeFrequency(freq.id)}
													class="remove-frequency-btn p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
													aria-label="Remove frequency {freq.id}"
												>
													<svg
														class="w-4 h-4"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<path
															fill-rule="evenodd"
															d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
														/>
													</svg>
												</button>
											{/if}
										</div>
									{/each}
								</div>
								<button
									on:click={addFrequency}
									class="saasfly-btn saasfly-btn-add w-full"
								>
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
										/>
									</svg>
									Add Frequency
								</button>
							</div>
						</div>
					</div>

					<!-- Sweep Control Card -->
					<div
						class="saasfly-feature-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-bg-card/90 hover:via-bg-card/70 hover:to-bg-card/50 transition-all duration-300"
					>
						<div class="flex items-center mb-6">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 212, 255, 0.1) 100%) !important; border: 1px solid rgba(0, 212, 255, 0.2) !important; box-shadow: 0 8px 25px rgba(0, 212, 255, 0.2), 0 0 15px rgba(0, 212, 255, 0.15) !important;"
							>
								<svg
									class="w-6 h-6 group-hover:scale-110 transition-transform duration-300"
									fill="currentColor"
									viewBox="0 0 20 20"
									style="color: #00d4ff !important;"
								>
									<path
										d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
									/>
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-xl font-semibold sweep-control-header mb-1 transition-colors duration-300"
								>
									Sweep Control
								</h3>
								<p
									class="text-sm text-text-muted group-hover:text-text-secondary transition-colors duration-300"
								>
									Configure frequency cycling
								</p>
							</div>
						</div>

						<div class="space-y-6">
							<div>
								<label
									for="cycleTimeInput"
									class="block text-sm font-medium text-text-muted mb-3 uppercase tracking-wide"
									>Cycle Time (seconds)</label
								>
								<input
									id="cycleTimeInput"
									type="number"
									bind:value={cycleTime}
									min="1"
									max="30"
									placeholder="1-30"
									class="w-full px-4 py-3 bg-bg-input/80 border border-border-primary/60 rounded-xl text-text-primary outline-none focus:border-accent-primary focus:bg-bg-input focus:shadow-lg focus:shadow-accent-primary/20 transition-all duration-300"
								/>
							</div>

							<div class="grid grid-cols-1 gap-3">
								<button
									on:click={startCycling}
									disabled={isStarted}
									class="saasfly-btn saasfly-btn-start w-full"
								>
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
										/>
									</svg>
									Start Sweep
								</button>
								<button
									on:click={() => {
										// Stop button clicked! isStarted: isStarted
										void stopCycling();
									}}
									disabled={!isStarted}
									class="saasfly-btn saasfly-btn-stop w-full"
								>
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path
											fill-rule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v6a1 1 0 11-2 0V7z"
										/>
									</svg>
									Stop Sweep
								</button>

								{#if isStarted}
									<button
										on:click={async () => {
											try {
												const _response = await fetch(
													'/api/hackrf/emergency-stop',
													{ method: 'POST' }
												);
												void _response.json();
												// Emergency stop response ignored

												// Force reset everything
												isStarted = false;
												statusMessage = 'Emergency stop executed';
												resetDisplays();
												stopLocalTimer();

												// Force update stores
												sweepStatus.set({
													active: false,
													startFreq: 0,
													endFreq: 0,
													currentFreq: 0,
													progress: 0
												});

												cycleStatus.set({
													active: false,
													currentCycle: 0,
													totalCycles: 0,
													progress: 0
												});
											} catch {
												// Emergency stop failed
												statusMessage = 'Emergency stop failed';
											}
										}}
										class="saasfly-btn w-full mt-2 bg-red-600/20 border-red-500/40 hover:bg-red-600/30 hover:border-border-hover/50 text-red-400"
									>
										<svg
											class="w-4 h-4"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fill-rule="evenodd"
												d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
												clip-rule="evenodd"
											/>
										</svg>
										Force Stop
									</button>
								{/if}
							</div>

							{#if $connectionStatus.error}
								<div
									class="mt-4 p-3 rounded-lg text-sm {$connectionStatus.error.includes(
										'please refresh'
									)
										? 'bg-red-500/10 border border-red-500/20 text-red-400'
										: 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'} {$connectionStatus.error.includes(
										'Recovering'
									) || $connectionStatus.error.includes('Reconnecting')
										? 'animate-pulse'
										: ''}"
								>
									<div class="flex items-center justify-between">
										<div class="flex items-center space-x-2">
											{#if $connectionStatus.error.includes('Recovering') || $connectionStatus.error.includes('Reconnecting')}
												<svg
													class="w-4 h-4 animate-spin"
													fill="currentColor"
													viewBox="0 0 20 20"
												>
													<path
														d="M10 3v2a5 5 0 0 0 0 10v2a7 7 0 1 1 0-14z"
													/>
												</svg>
											{:else}
												<svg
													class="w-4 h-4"
													fill="currentColor"
													viewBox="0 0 20 20"
												>
													<path
														fill-rule="evenodd"
														d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
														clip-rule="evenodd"
													/>
												</svg>
											{/if}
											<span>{$connectionStatus.error}</span>
										</div>
										{#if $connectionStatus.error.includes('please refresh') || $connectionStatus.error.includes('stale')}
											<button
												on:click={reconnectToHackRF}
												class="px-3 py-1 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 rounded transition-colors"
											>
												Reconnect
											</button>
										{/if}
									</div>
								</div>
							{/if}

							{#if statusMessage}
								<div
									class="mt-4 p-3 rounded-lg text-sm {statusMessage.includes(
										'Failed'
									) || statusMessage.includes('error')
										? 'bg-red-500/10 border border-red-500/20 text-red-400'
										: statusMessage.includes('Refreshing') ||
											  statusMessage.includes('Recovering')
											? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
											: 'bg-green-500/10 border border-green-500/20 text-green-400'}"
								>
									{statusMessage}
								</div>
							{/if}
						</div>
					</div>

					<!-- Analysis Tools Card -->
					<div
						class="saasfly-feature-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-bg-card/90 hover:via-bg-card/70 hover:to-bg-card/50 transition-all duration-300"
					>
						<div class="flex items-center mb-6">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(168, 85, 247, 0.1) 100%) !important; border: 1px solid rgba(168, 85, 247, 0.2) !important; box-shadow: 0 8px 25px rgba(168, 85, 247, 0.2), 0 0 15px rgba(168, 85, 247, 0.15) !important;"
							>
								<svg
									class="w-6 h-6 group-hover:scale-110 transition-transform duration-300"
									fill="currentColor"
									viewBox="0 0 20 20"
									style="color: #a855f7 !important;"
								>
									<path
										fill-rule="evenodd"
										d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01.293.707V12a1 1 0 01-.293.707l-2.293 2.293H8a1 1 0 010 2H4a1 1 0 01-1-1v-4a1 1 0 01.293-.707L5.586 9 3.293 6.707A1 1 0 013 6V4zm8-2a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-.293.707L14.414 7l2.293 2.293A1 1 0 0117 10v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293A1 1 0 0111 10V8a1 1 0 01.293-.707L13.586 5H12a1 1 0 010-2z"
									/>
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-xl font-semibold external-tools-header mb-1 transition-colors duration-300"
								>
									Analysis Tools
								</h3>
								<p
									class="text-sm text-text-muted group-hover:text-text-secondary transition-colors duration-300"
								>
									External analysis utilities
								</p>
							</div>
						</div>

						<div class="space-y-3">
							<button
								on:click={loadFrequencies}
								class="saasfly-btn saasfly-btn-load w-full relative"
							>
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
									/>
								</svg>
								<span class="button-text">Load Frequencies</span>
								<div
									class="loading-spinner hidden absolute inset-0 flex items-center justify-center bg-accent-primary/10 rounded-xl"
								>
									<div
										class="w-5 h-5 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin"
									></div>
								</div>
							</button>
							<button
								on:click={openSpectrumAnalyzer}
								class="saasfly-btn saasfly-btn-spectrum w-full"
							>
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path
										d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
									/>
								</svg>
								View Spectrum
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Monitoring Section -->
			<div class="xl:col-span-2">
				<div class="space-y-8">
					<!-- Cycle Status Card -->
					<div
						class="saasfly-dashboard-card cycle-status-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/90 via-bg-card/70 to-bg-card/50 border border-border-primary/50 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-bg-card/95 hover:via-bg-card/75 hover:to-bg-card/55 transition-all duration-300"
					>
						<div class="flex items-center mb-8">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: linear-gradient(135deg, rgba(251, 146, 60, 0.2) 0%, rgba(251, 146, 60, 0.1) 100%) !important; border: 1px solid rgba(251, 146, 60, 0.2) !important; box-shadow: 0 8px 25px rgba(251, 146, 60, 0.2), 0 0 15px rgba(251, 146, 60, 0.15) !important;"
							>
								<svg
									class="w-6 h-6 group-hover:scale-110 transition-transform duration-300"
									fill="currentColor"
									viewBox="0 0 20 20"
									style="color: #fb923c !important;"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707L11 12.414V6z"
									/>
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-2xl font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors duration-300"
								>
									Cycle Status
								</h3>
								<p
									class="text-text-muted group-hover:text-text-secondary transition-colors duration-300"
								>
									Real-time sweep monitoring
								</p>
							</div>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
							<div
								class="saasfly-info-card p-6 bg-gradient-to-br from-accent-primary/10 to-accent-primary/5 rounded-xl border border-accent-primary/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-accent-primary/15 hover:to-accent-primary/8 hover:shadow-lg hover:shadow-accent-primary/20 transition-all duration-300"
							>
								<div
									class="text-sm font-medium uppercase tracking-wide mb-2"
									style="color: #525252 !important;"
								>
									Next Frequency
								</div>
								<div class="font-mono text-3xl font-bold text-accent-primary">
									{currentFrequencyDisplay}
								</div>
							</div>
							<div
								class="saasfly-info-card p-6 bg-gradient-to-br from-neon-cyan/10 to-neon-cyan/5 rounded-xl border border-neon-cyan/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-neon-cyan/15 hover:to-neon-cyan/8 hover:shadow-lg hover:shadow-neon-cyan/20 transition-all duration-300"
							>
								<div
									class="text-sm font-medium uppercase tracking-wide mb-2"
									style="color: #525252 !important;"
								>
									Next Switch In
								</div>
								<div class="font-mono text-3xl font-bold text-neon-cyan">
									{switchTimer}
								</div>
							</div>
						</div>

						<div class="h-2 bg-bg-secondary rounded-full overflow-hidden">
							<div
								id="timerProgressBar"
								class="h-full bg-gradient-to-r from-accent-primary to-accent-hover rounded-full transition-[width] duration-100 ease-linear"
								style="width: {timerProgress}%"
							></div>
						</div>
					</div>

					<!-- Signal Analysis Card -->
					<div
						class="saasfly-dashboard-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/90 via-bg-card/70 to-bg-card/50 border border-border-primary/50 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-bg-card/95 hover:via-bg-card/75 hover:to-bg-card/55 transition-all duration-300"
					>
						<div class="flex items-center mb-8">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: linear-gradient(135deg, rgba(250, 204, 21, 0.2) 0%, rgba(250, 204, 21, 0.1) 100%) !important; border: 1px solid rgba(250, 204, 21, 0.2) !important; box-shadow: 0 8px 25px rgba(250, 204, 21, 0.2), 0 0 15px rgba(250, 204, 21, 0.15) !important;"
							>
								<svg
									class="w-6 h-6 group-hover:scale-110 transition-transform duration-300"
									fill="currentColor"
									viewBox="0 0 20 20"
									style="color: #facc15 !important;"
								>
									<path
										d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
									/>
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-2xl font-semibold text-white mb-1 group-hover:text-yellow-400 transition-colors duration-300"
								>
									Signal Analysis
								</h3>
								<p
									class="text-text-muted group-hover:text-text-secondary transition-colors duration-300"
								>
									Real-time signal strength monitoring and frequency analysis
								</p>
							</div>
						</div>

						<!-- Signal Metrics Grid -->
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
							<div
								class="saasfly-metric-card p-6 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-xl border border-orange-400/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-orange-500/15 hover:to-orange-500/8 hover:shadow-lg hover:shadow-orange-400/20 transition-all duration-300"
							>
								<div
									class="text-sm text-text-muted font-medium uppercase tracking-wide mb-2"
								>
									dB Level
								</div>
								<div class="font-mono text-2xl font-bold text-orange-400">
									{dbLevelValue}
								</div>
							</div>
							<div
								class="saasfly-metric-card p-6 bg-gradient-to-br from-signal-strong/10 to-signal-strong/5 rounded-xl border border-signal-strong/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-signal-strong/15 hover:to-signal-strong/8 hover:shadow-lg hover:shadow-signal-strong/20 transition-all duration-300"
							>
								<div
									class="text-sm text-text-muted font-medium uppercase tracking-wide mb-2"
								>
									Signal Strength
								</div>
								<div class="text-2xl font-bold text-signal-none">
									{signalStrengthText}
								</div>
							</div>
							<div
								class="saasfly-metric-card p-6 bg-gradient-to-br from-neon-cyan/10 to-neon-cyan/5 rounded-xl border border-neon-cyan/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-neon-cyan/15 hover:to-neon-cyan/8 hover:shadow-lg hover:shadow-neon-cyan/20 transition-all duration-300"
							>
								<div
									class="text-sm text-text-muted font-medium uppercase tracking-wide mb-2"
								>
									Target
								</div>
								<div class="font-mono text-2xl font-bold text-neon-cyan">
									{targetFrequency}
								</div>
							</div>
							<div
								class="saasfly-metric-card p-6 bg-gradient-to-br from-accent-primary/10 to-accent-primary/5 rounded-xl border border-accent-primary/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-accent-primary/15 hover:to-accent-primary/8 hover:shadow-lg hover:shadow-accent-primary/20 transition-all duration-300"
							>
								<div
									class="text-sm text-text-muted font-medium uppercase tracking-wide mb-2"
								>
									Detected
								</div>
								<div class="font-mono text-2xl font-bold text-accent-primary">
									{detectedFrequency}
								</div>
							</div>
							<div
								class="saasfly-metric-card p-6 bg-gradient-to-br from-purple-400/10 to-purple-400/5 rounded-xl border border-purple-400/20 hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-purple-400/15 hover:to-purple-400/8 hover:shadow-lg hover:shadow-purple-400/20 transition-all duration-300"
							>
								<div
									class="text-sm text-text-muted font-medium uppercase tracking-wide mb-2"
								>
									Offset
								</div>
								<div class="font-mono text-2xl font-bold text-purple-400">
									{frequencyOffset}
								</div>
							</div>
						</div>

						<!-- Signal Visualization -->
						<div class="relative pb-20">
							<div
								class="text-sm text-text-muted uppercase tracking-wide mb-8 text-center font-medium"
							>
								Signal Strength Scale
							</div>
							<div
								class="signal-indicator h-8 bg-bg-input rounded-lg relative border border-border-primary shadow-inner hover:cursor-crosshair"
							>
								<div
									class="signal-indicator-fill h-full transition-[width] duration-300 ease-in-out relative z-[1] rounded-md"
									id="signalIndicatorFill"
									style="width: {signalFillWidth}"
								></div>
								<div
									class="absolute top-[-8px] w-[2px] h-[calc(100%+16px)] bg-accent-primary shadow-lg transition-[left] duration-300 ease-in-out z-[3] before:content-[''] before:absolute before:top-[-4px] before:left-1/2 before:-translate-x-1/2 before:w-0 before:h-0 before:border-l-[6px] before:border-l-transparent before:border-r-[6px] before:border-r-transparent before:border-t-[6px] before:border-t-accent-primary"
									id="dbCurrentIndicator"
									style="left: {dbIndicatorPosition}"
								>
									<span
										class="font-mono absolute top-[-32px] left-1/2 -translate-x-1/2 bg-bg-card border border-accent-primary rounded px-2 py-1 text-xs font-semibold text-accent-primary whitespace-nowrap pointer-events-none"
										id="dbCurrentValue">{dbCurrentValue}</span
									>
								</div>
								<div
									class="absolute top-0 left-0 right-0 h-full flex justify-between items-center pointer-events-none z-[2]"
								>
									<!-- All markers with dB values prominently displayed -->
									<div
										class="absolute h-full w-px bg-white/50 top-0 left-0 hover:bg-white/40"
										data-db="-90"
									>
										<span
											class="font-mono absolute top-full mt-2 text-sm text-signal-weak -translate-x-1/4 whitespace-nowrap font-bold"
											>-90</span
										>
									</div>
									<div
										class="absolute h-1/2 w-px bg-white/20 top-1/4 left-[12.5%] hover:bg-white/30"
										data-db="-80"
									>
										<span
											class="font-mono absolute top-full mt-2 text-sm text-signal-weak -translate-x-1/2 whitespace-nowrap font-bold"
											>-80</span
										>
									</div>
									<div
										class="absolute h-full w-px bg-white/50 top-0 left-1/4 hover:bg-white/40"
										data-db="-70"
									>
										<span
											class="font-mono absolute top-full mt-2 text-sm text-blue-400 -translate-x-1/2 whitespace-nowrap font-bold"
											>-70</span
										>
									</div>
									<div
										class="absolute h-1/2 w-px bg-white/20 top-1/4 left-[37.5%] hover:bg-white/30"
										data-db="-60"
									>
										<span
											class="font-mono absolute top-full mt-2 text-sm text-signal-moderate -translate-x-1/2 whitespace-nowrap font-bold"
											>-60</span
										>
									</div>
									<div
										class="absolute h-full w-px bg-white/50 top-0 left-1/2 hover:bg-white/40"
										data-db="-50"
									>
										<span
											class="font-mono absolute top-full mt-2 text-sm text-signal-moderate -translate-x-1/2 whitespace-nowrap font-bold"
											>-50</span
										>
									</div>
									<div
										class="absolute h-1/2 w-px bg-white/20 top-1/4 left-[62.5%] hover:bg-white/30"
										data-db="-40"
									>
										<span
											class="font-mono absolute top-full mt-2 text-sm text-signal-strong -translate-x-1/2 whitespace-nowrap font-bold"
											>-40</span
										>
									</div>
									<div
										class="absolute h-full w-px bg-white/50 top-0 left-3/4 hover:bg-white/40"
										data-db="-30"
									>
										<span
											class="font-mono absolute top-full mt-2 text-sm text-signal-strong -translate-x-1/2 whitespace-nowrap font-bold"
											>-30</span
										>
									</div>
									<div
										class="absolute h-1/2 w-px bg-white/20 top-1/4 left-[87.5%] hover:bg-white/30"
										data-db="-20"
									>
										<span
											class="font-mono absolute top-full mt-2 text-sm text-signal-very-strong -translate-x-1/2 whitespace-nowrap font-bold"
											>-20</span
										>
									</div>
									<div
										class="absolute h-full w-px bg-white/50 top-0 left-full hover:bg-white/40"
										data-db="-10"
									>
										<span
											class="font-mono absolute top-full mt-2 text-sm text-signal-very-strong -translate-x-3/4 whitespace-nowrap font-bold"
											>-10</span
										>
									</div>
								</div>
							</div>
							<div class="flex justify-between mt-16 px-2 absolute w-full bottom-0">
								<span
									class="text-xs text-signal-weak uppercase tracking-widest font-semibold"
									>← WEAK</span
								>
								<span
									class="text-xs text-signal-very-strong uppercase tracking-widest font-semibold"
									>STRONG →</span
								>
							</div>
						</div>
					</div>

					<!-- System Status Card -->
					<div
						class="saasfly-feature-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 hover:bg-gradient-to-br hover:from-bg-card/90 hover:via-bg-card/70 hover:to-bg-card/50 transition-all duration-300"
					>
						<div class="flex items-center mb-6">
							<div
								class="p-3 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-xl mr-4 border border-green-400/20 group-hover:border-border-hover/50 group-hover:shadow-lg group-hover:shadow-green-400/20 transition-all duration-300"
							>
								<svg
									class="w-6 h-6 text-green-400 group-hover:scale-110 transition-transform duration-300"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									/>
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-xl font-semibold text-white mb-1 transition-colors duration-300"
								>
									System Status
								</h3>
								<p
									class="text-sm text-text-muted group-hover:text-text-secondary transition-colors duration-300"
								>
									Current system information
								</p>
							</div>
						</div>
						<div
							class="saasfly-status-card text-text-secondary min-h-[3rem] flex items-center px-4 py-3 bg-gradient-to-r from-bg-card/30 to-bg-card/20 rounded-xl border border-border-primary/30 hover:border-border-hover/50 hover:bg-gradient-to-r hover:from-bg-card/40 hover:to-bg-card/30 hover:shadow-lg hover:shadow-neon-cyan/10 transition-all duration-300"
						>
							{statusMessage || 'Ready to start monitoring'}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<footer class="py-12 border-t border-border-primary/20">
		<div class="container mx-auto px-4 lg:px-8 max-w-7xl">
			<div class="flex flex-col md:flex-row justify-between items-center">
				<div class="flex items-center space-x-3 mb-4 md:mb-0">
					<div></div>
				</div>
				<div class="flex items-center space-x-6 text-sm text-text-muted">
					<span
						><span class="hackrf-brand">HackRF</span>
						<span class="sweep-brand">Sweep</span></span
					>
					<button class="hover:text-accent-primary transition-colors"
						>Documentation</button
					>
					<button class="hover:text-accent-primary transition-colors">Support</button>
				</div>
			</div>
		</div>
	</footer>
</div>

<style>
	/* Neon Glow Effects */
	:global(h1),
	:global(h2),
	:global(h3),
	:global(.text-glow) {
		text-shadow:
			0 0 10px rgba(0, 212, 255, 0.5),
			0 0 20px rgba(0, 212, 255, 0.3),
			0 0 30px rgba(0, 212, 255, 0.1);
		animation: textGlow 3s ease-in-out infinite;
	}

	@keyframes textGlow {
		0%,
		100% {
			text-shadow:
				0 0 10px rgba(0, 212, 255, 0.5),
				0 0 20px rgba(0, 212, 255, 0.3),
				0 0 30px rgba(0, 212, 255, 0.1);
		}
		50% {
			text-shadow:
				0 0 15px rgba(0, 212, 255, 0.7),
				0 0 30px rgba(0, 212, 255, 0.5),
				0 0 45px rgba(0, 212, 255, 0.3);
		}
	}

	/* Cyan neon glow for buttons */
	:global(button) {
		transition: all 0.3s ease;
		position: relative;
	}

	:global(button:hover) {
		background-color: rgba(0, 212, 255, 0.1) !important;
		border-color: rgba(0, 212, 255, 0.5) !important;
		box-shadow:
			0 0 10px rgba(0, 212, 255, 0.5),
			0 0 20px rgba(0, 212, 255, 0.3),
			0 0 30px rgba(0, 212, 255, 0.1),
			inset 0 0 10px rgba(0, 212, 255, 0.1) !important;
		color: #00d4ff !important;
	}

	/* Glass panels with neon accent */
	:global(.glass-panel) {
		background: rgba(17, 17, 17, 0.6) !important;
		backdrop-filter: blur(12px) !important;
		-webkit-backdrop-filter: blur(12px) !important;
		border: 1px solid rgba(255, 255, 255, 0.1) !important;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.4),
			0 2px 12px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.05),
			inset 0 0 20px rgba(255, 255, 255, 0.02),
			0 0 20px rgba(0, 212, 255, 0.05);
	}

	/* Saasfly card styles */
	:global(.saasfly-feature-card) {
		position: relative;
		overflow: hidden;
	}

	:global(.saasfly-feature-card::before) {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.4), transparent);
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	:global(.saasfly-feature-card:hover::before) {
		opacity: 1;
	}

	/* Signal indicator styles */
	:global(.signal-indicator) {
		background-image: repeating-linear-gradient(
			90deg,
			transparent,
			transparent 12.4%,
			rgba(255, 255, 255, 0.05) 12.5%,
			rgba(255, 255, 255, 0.05) 12.6%
		);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	:global(.signal-indicator-fill.gradient-weak) {
		background: #60a5fa;
	}

	:global(.signal-indicator-fill.gradient-moderate) {
		background: linear-gradient(to right, #60a5fa 0%, #60a5fa 40%, #fbbf24 70%, #fbbf24 100%);
	}

	:global(.signal-indicator-fill.gradient-strong) {
		background: linear-gradient(
			to right,
			#60a5fa 0%,
			#60a5fa 30%,
			#fbbf24 45%,
			#fbbf24 55%,
			#ff6b35 80%,
			#ff6b35 100%
		);
	}

	:global(.signal-indicator-fill.gradient-very-strong) {
		background: linear-gradient(
			to right,
			#60a5fa 0%,
			#60a5fa 25%,
			#fbbf24 40%,
			#fbbf24 50%,
			#ff6b35 65%,
			#ff6b35 75%,
			#dc2626 90%,
			#dc2626 100%
		);
	}

	/* Button styles */
	:global(.saasfly-btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
		transition-property: all;
		transition-duration: 200ms;
	}

	:global(.saasfly-btn:focus) {
		outline: none;
		box-shadow:
			0 0 0 2px var(--bg-primary),
			0 0 0 4px currentColor;
	}

	/* Start button - Cyan gradient */
	:global(.saasfly-btn-start) {
		background: linear-gradient(135deg, #0ea5e9 0%, #0891b2 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(14, 165, 233, 0.3),
			0 0 20px rgba(14, 165, 233, 0.1) !important;
	}

	:global(.saasfly-btn-start:hover:not(:disabled)) {
		background: linear-gradient(135deg, #0284c7 0%, #0e7490 100%) !important;
		box-shadow:
			0 4px 12px rgba(14, 165, 233, 0.4),
			0 0 30px rgba(14, 165, 233, 0.2) !important;
		transform: translateY(-1px);
	}

	/* Stop button - Red gradient */
	:global(.saasfly-btn-stop) {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(239, 68, 68, 0.3),
			0 0 20px rgba(239, 68, 68, 0.1) !important;
	}

	:global(.saasfly-btn-stop:hover:not(:disabled)) {
		background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
		box-shadow:
			0 4px 12px rgba(239, 68, 68, 0.4),
			0 0 30px rgba(239, 68, 68, 0.2) !important;
		transform: translateY(-1px);
	}

	/* Load button - Purple gradient */
	:global(.saasfly-btn-load) {
		background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(168, 85, 247, 0.3),
			0 0 20px rgba(168, 85, 247, 0.1) !important;
	}

	:global(.saasfly-btn-load:hover) {
		background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%) !important;
		box-shadow:
			0 4px 12px rgba(168, 85, 247, 0.4),
			0 0 30px rgba(168, 85, 247, 0.2) !important;
		transform: translateY(-1px);
	}

	/* Add button - Green gradient */
	:global(.saasfly-btn-add) {
		background: linear-gradient(135deg, #34d399 0%, #10b981 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(52, 211, 153, 0.3),
			0 0 20px rgba(52, 211, 153, 0.1) !important;
	}

	:global(.saasfly-btn-add:hover) {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
		box-shadow:
			0 4px 12px rgba(52, 211, 153, 0.4),
			0 0 30px rgba(52, 211, 153, 0.2) !important;
		transform: translateY(-1px);
	}

	/* Spectrum analyzer button - Blue gradient */
	:global(.saasfly-btn-spectrum) {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(59, 130, 246, 0.3),
			0 0 20px rgba(59, 130, 246, 0.1) !important;
	}

	:global(.saasfly-btn-spectrum:hover) {
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
		box-shadow:
			0 4px 12px rgba(59, 130, 246, 0.4),
			0 0 30px rgba(59, 130, 246, 0.2) !important;
		transform: translateY(-1px);
	}

	:global(.saasfly-btn:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none !important;
	}

	/* Cyan accent override */
	:global(.text-neon-cyan) {
		color: #00d4ff !important;
	}
	:global(.bg-neon-cyan) {
		background-color: #00d4ff !important;
	}
	:global(.border-neon-cyan) {
		border-color: #00d4ff !important;
	}

	/* Metric cards - monochrome override to match original */
	:global(.saasfly-metric-card) {
		background: rgba(20, 20, 20, 0.6) !important;
		border-color: rgba(38, 38, 38, 0.6) !important;
	}

	:global(.saasfly-metric-card:hover) {
		background: rgba(26, 26, 26, 0.8) !important;
		border-color: rgba(64, 64, 64, 0.8) !important;
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3) !important;
	}

	/* Remove colored text from metric values */
	:global(.saasfly-metric-card .text-orange-400),
	:global(.saasfly-metric-card .text-signal-none),
	:global(.saasfly-metric-card .text-neon-cyan),
	:global(.saasfly-metric-card .text-accent-primary),
	:global(.saasfly-metric-card .text-purple-400) {
		color: #ffffff !important;
	}

	/* Info cards - monochrome override to match original */
	:global(.saasfly-info-card) {
		background: rgba(20, 20, 20, 0.6) !important;
		border-color: rgba(38, 38, 38, 0.6) !important;
	}

	:global(.saasfly-info-card:hover) {
		background: rgba(26, 26, 26, 0.8) !important;
		border-color: rgba(64, 64, 64, 0.8) !important;
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3) !important;
	}

	/* Remove colored text from info card values */
	:global(.saasfly-info-card .text-accent-primary),
	:global(.saasfly-info-card .text-neon-cyan) {
		color: #ffffff !important;
	}

	/* Sweep Control card - override to monochrome */
	:global(.saasfly-feature-card .bg-gradient-to-br.from-accent-primary\/20) {
		background: rgba(64, 64, 64, 0.2) !important;
		border-color: rgba(64, 64, 64, 0.2) !important;
	}

	:global(.saasfly-feature-card .bg-gradient-to-br.from-accent-primary\/20:hover) {
		background: rgba(64, 64, 64, 0.4) !important;
		border-color: rgba(64, 64, 64, 0.4) !important;
		box-shadow: 0 8px 25px rgba(64, 64, 64, 0.2) !important;
	}

	:global(.saasfly-feature-card .text-accent-primary) {
		color: #a3a3a3 !important;
	}

	:global(.saasfly-feature-card:hover .text-accent-primary) {
		color: #ffffff !important;
	}

	/* Sweep Control header text */
	:global(.sweep-control-header) {
		color: #ffffff !important;
	}

	/* Analysis Tools card - override purple to monochrome */
	:global(.saasfly-feature-card .bg-gradient-to-br.from-purple-500\/20) {
		background: rgba(64, 64, 64, 0.2) !important;
		border-color: rgba(64, 64, 64, 0.2) !important;
	}

	:global(.saasfly-feature-card .bg-gradient-to-br.from-purple-500\/20:hover) {
		background: rgba(64, 64, 64, 0.4) !important;
		border-color: rgba(64, 64, 64, 0.4) !important;
		box-shadow: 0 8px 25px rgba(64, 64, 64, 0.2) !important;
	}

	:global(.saasfly-feature-card .text-purple-400) {
		color: #a3a3a3 !important;
	}

	:global(.saasfly-feature-card:hover .text-purple-400) {
		color: #ffffff !important;
	}

	/* External Tools header text */
	:global(.external-tools-header) {
		color: #ffffff !important;
	}

	/* Remove glow effects from all card headers */
	:global(.frequency-config-header),
	:global(.sweep-control-header),
	:global(.external-tools-header),
	:global(.saasfly-dashboard-card h3),
	:global(.saasfly-feature-card h3) {
		text-shadow: none !important;
		animation: none !important;
	}

	/* Header and Navigation styles */
	:global(.hackrf-brand) {
		color: #ff6b35;
		text-shadow: none;
	}

	:global(.sweep-brand) {
		color: #ffffff;
		text-shadow: none;
	}

	:global(.nav-link) {
		color: #a3a3a3;
		transition: all 0.2s ease;
	}

	:global(.nav-link:hover) {
		color: #00d4ff;
		background: rgba(0, 212, 255, 0.1);
	}

	:global(.nav-link.active) {
		color: #00d4ff;
		background: rgba(0, 212, 255, 0.1);
	}

	:global(.status-panel) {
		background: rgba(20, 20, 20, 0.6);
		border: 1px solid rgba(38, 38, 38, 0.6);
	}

	:global(.glass-button) {
		background: rgba(20, 20, 20, 0.6);
		border: 1px solid rgba(38, 38, 38, 0.6);
		color: #a3a3a3;
		transition: all 0.2s ease;
	}

	:global(.glass-button:hover) {
		background: rgba(26, 26, 26, 0.8);
		border-color: rgba(64, 64, 64, 0.8);
		color: #ffffff;
	}

	:global(.status-indicator) {
		box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
	}

	/* All cards - remove colored hover effects, keep monochrome */
	:global(.saasfly-feature-card:hover),
	:global(.saasfly-dashboard-card:hover) {
		border-color: rgba(64, 64, 64, 0.8) !important;
		background: rgba(26, 26, 26, 0.8) !important;
	}

	:global(.saasfly-feature-card h3),
	:global(.saasfly-dashboard-card h3) {
		color: #ffffff !important;
	}

	:global(.saasfly-feature-card:hover h3),
	:global(.saasfly-dashboard-card:hover h3) {
		color: #ffffff !important;
	}

	/* Keep header text white on all cards */
	:global(.frequency-config-header),
	:global(.sweep-control-header),
	:global(.external-tools-header) {
		color: #ffffff !important;
	}

	:global(.saasfly-feature-card:hover .frequency-config-header),
	:global(.saasfly-feature-card:hover .sweep-control-header),
	:global(.saasfly-feature-card:hover .external-tools-header) {
		color: #ffffff !important;
	}

	/* Mobile optimizations for iPhone */
	@media (max-width: 428px) {
		/* Header adjustments for mobile */
		header {
			padding: 0 !important;
		}

		header .container {
			padding: 0 8px !important;
		}

		header .flex {
			height: 48px !important; /* Reduced from 64px (h-16) */
			gap: 8px;
		}

		/* Back to Console button - more compact */
		header a.glass-button {
			padding: 4px 8px !important;
			font-size: 11px !important;
		}

		header a.glass-button svg {
			width: 16px !important;
			height: 16px !important;
		}

		header a.glass-button span {
			font-size: 11px !important;
			display: none; /* Hide text on very small screens */
		}

		/* Brand section - smaller */
		header .flex.items-center.space-x-3 {
			gap: 8px !important;
		}

		header h1 {
			font-size: 16px !important;
			line-height: 1.2 !important;
		}

		header .font-mono.text-caption {
			font-size: 9px !important;
			display: none; /* Hide tagline on mobile */
		}

		/* Hide connection status on mobile - replaced by mobile menu */
		header .status-panel {
			display: none !important;
		}

		/* Mobile menu button */
		header button#mobileMenuButton {
			padding: 6px !important;
		}
	}

	/* Landscape mode adjustments */
	@media (max-height: 428px) and (orientation: landscape) {
		/* Even more compact header for landscape */
		header .flex {
			height: 40px !important;
		}

		/* Show back button text in landscape */
		header a.glass-button span {
			display: inline !important;
			font-size: 10px !important;
		}

		/* Brand text adjustments */
		header h1 {
			font-size: 14px !important;
		}

		/* Show tagline in landscape but smaller */
		header .font-mono.text-caption {
			display: block !important;
			font-size: 8px !important;
		}
	}
</style>
