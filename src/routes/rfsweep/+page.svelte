<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { usrpAPI } from '$lib/services/hackrf/usrp-api';
	import {
		spectrumData,
		sweepStatus,
		cycleStatus,
		connectionStatus,
		updateSweepStatus,
		updateSpectrumData
	} from '$lib/stores/hackrf';

	// SDR Hardware Selection
	type SDRDevice = 'hackrf' | 'usrp';
	let selectedDevice: SDRDevice = 'hackrf'; // Default to HackRF
	let _deviceStatus: 'connected' | 'disconnected' | 'checking' = 'checking';

	const deviceInfo: Record<SDRDevice, { name: string; freqRange: string; sampleRate: string }> = {
		hackrf: {
			name: 'HackRF One',
			freqRange: '1 MHz – 6 GHz',
			sampleRate: '20 MS/s'
		},
		usrp: {
			name: 'USRP B205 mini',
			freqRange: '70 MHz – 6 GHz',
			sampleRate: '56 MS/s'
		}
	};

	let frequencies: Array<{ id: number; value: number | string }> = [{ id: 1, value: 2400 }];
	let cycleTime = 10;
	let isStarted = false;

	// Ensure button state is properly initialized from store
	$: if (typeof $sweepStatus === 'object' && $sweepStatus !== null && 'active' in $sweepStatus) {
		isStarted = $sweepStatus.active;
	}
	let currentFrequencyDisplay = '--';
	let switchTimer = '--';
	let timerProgress = 0;
	let dbLevelValue = '--';
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
			// Immediate UI feedback
			const deviceName = deviceInfo[selectedDevice].name;
			statusMessage = `Initializing ${deviceName}... (this may take 5-10 seconds)`;
			isStarted = true; // Show stop button immediately

			const validFreqs = frequencies
				.filter((f) => f.value)
				.map((f) => ({
					start: Number(f.value) - 10,
					stop: Number(f.value) + 10,
					step: 1
				}));

			console.warn(
				`[RF Sweep] Starting sweep on ${selectedDevice} for frequencies:`,
				validFreqs
			);
			const _response = await usrpAPI.startSweep(validFreqs, cycleTime, selectedDevice);
			console.warn(`[RF Sweep] Sweep started successfully on ${selectedDevice}:`, _response);
			statusMessage = `${deviceName} sweep running - collecting signal data...`;

			// Store target frequencies for offset calculation
			const validFreqValues = frequencies.filter((f) => f.value);
			if (validFreqValues.length > 0) {
				currentFrequencyDisplay = validFreqValues[0].value + ' MHz';
				targetFrequency = validFreqValues[0].value + ' MHz';

				// Note: USRP device cannot be accessed by multiple processes
				// Power measurements will come from the spectrum scan data stream
				console.warn(
					`[RF Sweep] Monitoring spectrum scan data for frequency ${validFreqValues[0].value} MHz`
				);
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

			const _response = await usrpAPI.stopSweep();
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
	function reconnectToUSRP() {
		// Manual reconnect initiated
		statusMessage = 'Reconnecting...';
		void usrpAPI.reconnect();
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
				dbLevelValue = '--';
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

						// Note: Power measurements come from spectrum scan data
						console.warn(
							`[RF Sweep] Switched to frequency: ${validFreqs[nextIndex].value} MHz`
						);
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

	// Real USRP power measurement function
	async function measureUSRPPower(frequencyMHz: number) {
		try {
			const response = await fetch('/api/rf/usrp-power', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					frequency: frequencyMHz,
					gain: 70, // Max gain for USRP B205 Mini
					duration: 0.5 // Quick measurement
				})
			});

			if (response.ok) {
				const data = (await response.json()) as {
					power: number;
					frequency: number;
					unit: string;
				};
				if (typeof data.power === 'number') {
					// Update all signal analysis displays directly
					dbLevelValue = data.power.toFixed(2);
					dbCurrentValue = data.power.toFixed(1) + ' dB';

					// Update signal strength and visual indicators
					updateSignalStrength(data.power);
					updateSignalIndicator(data.power);

					// Update detected frequency to match target (since we're measuring at that frequency)
					detectedFrequency = frequencyMHz.toFixed(2) + ' MHz';
					frequencyOffset = '0.00 MHz'; // No offset since we're measuring at exact frequency

					// Also update the spectrum data store to trigger any reactive UI updates
					updateSpectrumData({
						frequencies: [],
						power: [],
						power_levels: [],
						peak_power: data.power,
						peak_freq: frequencyMHz,
						centerFreq: frequencyMHz,
						sampleRate: 1000000, // 1 MHz default sample rate
						binSize: 1024, // Default bin size
						timestamp: Date.now(),
						processed: true
					});

					console.warn(
						`[USRP Power] Measurement: ${data.power} dBm at ${frequencyMHz} MHz`
					);

					// Update status message to show activity
					if (isStarted && !isSwitching) {
						statusMessage = `Measuring: ${data.power.toFixed(1)} dBm at ${frequencyMHz} MHz`;
					}
				}
			} else {
				const errorData = await response.json();
				console.error('[USRP Power] API error:', errorData);
			}
		} catch (error) {
			console.error('[USRP Power] Measurement failed:', error);
			// Don't update UI on error to keep last valid reading
		}
	}

	// Periodic power measurement for real-time signal analysis
	let powerMeasurementInterval: ReturnType<typeof setInterval> | null = null;

	function _startPeriodicPowerMeasurement(frequencyMHz: number) {
		// Clear any existing interval
		if (powerMeasurementInterval) {
			clearInterval(powerMeasurementInterval);
		}

		// Store the current frequency for the interval
		let currentMeasurementFreq = frequencyMHz;

		// Immediate first measurement
		measureUSRPPower(currentMeasurementFreq);

		// Set up periodic measurements every 2 seconds
		powerMeasurementInterval = setInterval(() => {
			if (isStarted && !isSwitching) {
				// Only measure when sweep is running and not switching
				// Update frequency if it changed
				const targetFreqStr = targetFrequency.toString().replace(/\s*MHz\s*$/i, '');
				const targetFreqMHz = parseFloat(targetFreqStr);
				if (!isNaN(targetFreqMHz) && targetFreqMHz !== currentMeasurementFreq) {
					currentMeasurementFreq = targetFreqMHz;
					console.warn(`[RF Sweep] Frequency changed to ${currentMeasurementFreq} MHz`);
				}
				measureUSRPPower(currentMeasurementFreq);
			}
		}, 2000);

		console.warn(
			`[RF Sweep] Started periodic power measurement for ${frequencyMHz} MHz every 2 seconds`
		);
	}

	function _stopPeriodicPowerMeasurement() {
		if (powerMeasurementInterval) {
			clearInterval(powerMeasurementInterval);
			powerMeasurementInterval = null;
			console.warn('[RF Sweep] Stopped periodic power measurement');
		}
	}

	function resetDisplays() {
		currentFrequencyDisplay = '--';
		switchTimer = '--';
		timerProgress = 0;
		dbLevelValue = '--';
		signalStrengthText = 'No Signal';
		targetFrequency = '--';
		detectedFrequency = '--';
		frequencyOffset = '--';
	}

	function _loadFrequencies() {
		// Placeholder for load frequencies functionality
		// Load frequencies clicked
	}

	async function openSpectrumAnalyzer() {
		// Stop the sweep if it's running
		if (isStarted) {
			// Stopping sweep before opening spectrum analyzer...
			await stopCycling();
		}

		// Navigate to the viewspectrum page with selected device
		window.location.href = `/viewspectrum?device=${selectedDevice}`;
	}

	// Subscribe to stores
	$: if ($spectrumData && !isSwitching) {
		// Debug spectrum data
		console.warn('[RF Sweep] Spectrum data received:', {
			peak_power: $spectrumData.peak_power,
			peak_freq: $spectrumData.peak_freq,
			timestamp: $spectrumData.timestamp,
			keys: Object.keys($spectrumData)
		});

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
			console.warn(`[RF Sweep] Signal analysis updated: ${peakPower} dB`);
		} else {
			console.warn('[RF Sweep] No valid peak_power in spectrum data');
		}

		if (
			typeof $spectrumData === 'object' &&
			$spectrumData !== null &&
			'peak_freq' in $spectrumData &&
			$spectrumData.peak_freq !== undefined
		) {
			// Check if the detected frequency is reasonably close to our target
			const detectedFreqMHz = $spectrumData.peak_freq;
			// Fix frequency parsing - remove " MHz" suffix if present
			const cleanTargetFreq = targetFrequency.toString().replace(/\s*MHz\s*$/i, '');
			const targetFreqMHz = parseFloat(cleanTargetFreq);

			// Increase tolerance to 100 MHz for USRP (wider sweep ranges)
			// This helps with USRP's broader frequency coverage
			if (!isNaN(targetFreqMHz) && Math.abs(detectedFreqMHz - targetFreqMHz) < 100) {
				detectedFrequency = detectedFreqMHz.toFixed(2) + ' MHz';
				const offset = detectedFreqMHz - targetFreqMHz;
				frequencyOffset = (offset >= 0 ? '+' : '') + offset.toFixed(2) + ' MHz';

				// Get power measurement for USRP
				if ($spectrumData.peak_power !== undefined) {
					dbLevelValue = $spectrumData.peak_power.toFixed(2);
					dbCurrentValue = $spectrumData.peak_power.toFixed(1) + ' dB';
				} else {
					// If no peak_power in spectrum data, try to get real USRP measurement
					measureUSRPPower(targetFreqMHz);
				}
			} else {
				// Data is likely from previous frequency, ignore it
				console.warn(
					`Ignoring stale frequency data: ${detectedFreqMHz} MHz (target: ${targetFreqMHz} MHz)`
				);
			}
		}
	}

	// Subscribe to sweep status
	$: {
		// === SWEEP STATUS UPDATE ===
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
		let healthCheckInterval: NodeJS.Timeout;

		// Initialize async operations
		(async () => {
			console.warn('[RF Sweep] Page mounting...');

			// First, get the actual backend state
			try {
				const status = await usrpAPI.getStatus();
				console.warn('[RF Sweep] Backend status:', status);

				// Update store with real backend state
				if (status && typeof status.sweeping === 'boolean') {
					isStarted = status.sweeping;
					updateSweepStatus({ active: status.sweeping });
					console.warn(`[RF Sweep] Synced with backend: isStarted=${isStarted}`);
				} else {
					isStarted = false;
					console.warn('[RF Sweep] No backend status, defaulting to stopped');
				}
			} catch (error) {
				console.warn('[RF Sweep] Failed to get backend status:', error);
				isStarted = false;
			}

			// Connect to data stream
			console.warn('[RF Sweep] Connecting to data stream...');
			void usrpAPI.connectToDataStream();
		})();

		// Set up connection health check
		healthCheckInterval = setInterval(() => {
			if (
				typeof $connectionStatus === 'object' &&
				$connectionStatus !== null &&
				'connected' in $connectionStatus &&
				$connectionStatus.connected === false &&
				isStarted
			) {
				// [Health Check] Connection lost while sweep is active
				// Try to reconnect
				void usrpAPI.connectToDataStream();
			}
		}, 10000); // Check every 10 seconds

		return () => {
			clearInterval(healthCheckInterval);
		};
	});

	onDestroy(() => {
		// [onDestroy] Cleaning up USRP page
		void usrpAPI.disconnectDataStream();
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
<div class="rf-sweep-page relative min-h-screen bg-bg-primary overflow-x-hidden">
	<!-- Header -->
	<header
		class="sticky top-0 z-50 backdrop-blur-2xl bg-bg-primary/80 border-b border-border-primary/50 shadow-xl"
	>
		<div class="container mx-auto px-4 lg:px-8 max-w-7xl">
			<div class="flex items-center justify-between h-16">
				<!-- Brand/Logo Section -->
				<div class="flex items-center">
					<div class="flex flex-col">
						<h1 class="font-heading text-h4 font-semibold tracking-tight leading-tight">
							<span class="rf-brand">RF</span>
							<span class="sweep-brand font-bold">Sweep</span>
						</h1>
						<span class="text-caption uppercase tracking-widest text-text-muted">
							SDR Spectrum Analysis
						</span>
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
							<span class="text-caption text-text-secondary">
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
							<span class="text-caption text-text-muted">Mode:</span>
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
				<div class="sticky top-24 space-y-6">
					<!-- Hardware Selection Card -->
					<div
						class="saasfly-feature-card group rounded-2xl p-6 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 transition-all duration-300"
					>
						<div class="flex items-center mb-5">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: rgba(37, 99, 235, 0.15); border: 1px solid rgba(37, 99, 235, 0.2);"
							>
								<svg
									class="w-5 h-5 group-hover:scale-110 transition-transform duration-300"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									viewBox="0 0 24 24"
									style="color: #2563EB;"
								>
									<rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
									<rect x="9" y="9" width="6" height="6" />
									<line x1="9" y1="1" x2="9" y2="4" />
									<line x1="15" y1="1" x2="15" y2="4" />
									<line x1="9" y1="20" x2="9" y2="23" />
									<line x1="15" y1="20" x2="15" y2="23" />
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-lg font-semibold text-text-primary mb-0.5"
								>
									SDR Hardware
								</h3>
								<p class="text-xs text-text-muted">Select radio device</p>
							</div>
						</div>

						<div class="space-y-4">
							<div>
								<label
									for="deviceSelector"
									class="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wide"
								>
									Active Device
								</label>
								<select
									id="deviceSelector"
									bind:value={selectedDevice}
									disabled={isStarted}
									class="w-full px-3 py-2.5 bg-bg-input/80 border border-border-primary/60 rounded-lg text-text-primary text-sm font-medium outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/30 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<option value="hackrf">HackRF One</option>
									<option value="usrp">USRP B205 mini</option>
								</select>
							</div>

							<!-- Device Info -->
							<div class="grid grid-cols-2 gap-3 pt-2">
								<div
									class="p-3 bg-bg-elevated/50 rounded-lg border border-border-subtle"
								>
									<div
										class="text-[10px] text-text-muted uppercase tracking-wide mb-1"
									>
										Frequency
									</div>
									<div class="text-xs font-mono text-text-secondary">
										{deviceInfo[selectedDevice].freqRange}
									</div>
								</div>
								<div
									class="p-3 bg-bg-elevated/50 rounded-lg border border-border-subtle"
								>
									<div
										class="text-[10px] text-text-muted uppercase tracking-wide mb-1"
									>
										Sample Rate
									</div>
									<div class="text-xs font-mono text-text-secondary">
										{deviceInfo[selectedDevice].sampleRate}
									</div>
								</div>
							</div>

							<!-- Device Status -->
							<div class="flex items-center gap-2 pt-1">
								<div
									class="w-2 h-2 rounded-full {$connectionStatus.connected
										? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
										: 'bg-red-500'}"
								></div>
								<span class="text-xs text-text-secondary">
									{$connectionStatus.connected
										? deviceInfo[selectedDevice].name + ' Ready'
										: 'Awaiting connection'}
								</span>
							</div>
						</div>
					</div>

					<!-- Frequency Configuration Card -->
					<div
						class="saasfly-feature-card group rounded-2xl p-6 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 transition-all duration-300"
					>
						<div class="flex items-center mb-5">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: rgba(5, 150, 105, 0.15); border: 1px solid rgba(5, 150, 105, 0.2);"
							>
								<svg
									class="w-5 h-5 group-hover:scale-110 transition-transform duration-300"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									viewBox="0 0 24 24"
									style="color: #059669;"
								>
									<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-lg font-semibold text-text-primary mb-0.5"
								>
									Frequency Configuration
								</h3>
								<p class="text-xs text-text-muted">Target frequencies</p>
							</div>
						</div>

						<div class="space-y-4">
							<div>
								<div
									class="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wide"
								>
									Frequencies
								</div>
								<div class="space-y-2 mb-4 max-h-[240px] overflow-y-auto">
									{#each frequencies as freq (freq.id)}
										<div
											class="frequency-item flex items-center gap-2 p-3 bg-bg-elevated/50 rounded-lg border border-border-subtle hover:border-border-default transition-all duration-200"
										>
											<span
												class="font-mono text-xs text-text-muted font-medium min-w-[20px] text-center"
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
													placeholder="Frequency"
													class="font-mono text-sm w-full pl-3 pr-12 py-1.5 bg-bg-input/80 border border-border-primary/60 rounded text-text-primary outline-none focus:border-neon-cyan transition-all duration-200"
												/>
												<span
													class="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-muted pointer-events-none"
													>MHz</span
												>
											</div>
											{#if frequencies.length > 1}
												<button
													onclick={() => removeFrequency(freq.id)}
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
									onclick={addFrequency}
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
						class="saasfly-feature-card group rounded-2xl p-6 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 transition-all duration-300"
					>
						<div class="flex items-center mb-5">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: rgba(217, 119, 6, 0.15); border: 1px solid rgba(217, 119, 6, 0.2);"
							>
								<svg
									class="w-5 h-5 group-hover:scale-110 transition-transform duration-300"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									viewBox="0 0 24 24"
									style="color: #D97706;"
								>
									<circle cx="12" cy="12" r="10" />
									<polyline points="12 6 12 12 16 14" />
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-lg font-semibold text-text-primary mb-0.5"
								>
									Sweep Control
								</h3>
								<p class="text-xs text-text-muted">Cycle timing</p>
							</div>
						</div>

						<div class="space-y-4">
							<div>
								<label
									for="cycleTimeInput"
									class="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wide"
									>Cycle Time (seconds)</label
								>
								<input
									id="cycleTimeInput"
									type="number"
									bind:value={cycleTime}
									min="1"
									max="30"
									placeholder="1-30"
									class="w-full px-3 py-2 text-sm bg-bg-input/80 border border-border-primary/60 rounded-lg text-text-primary outline-none focus:border-neon-cyan transition-all duration-200"
								/>
							</div>

							<div class="grid grid-cols-2 gap-2">
								<button
									onclick={startCycling}
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
									onclick={() => {
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
										onclick={async () => {
											try {
												const _response = await fetch(
													'/api/rf/emergency-stop',
													{
														method: 'POST',
														headers: {
															'Content-Type': 'application/json'
														},
														body: JSON.stringify({
															deviceType: selectedDevice
														})
													}
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
											} catch (error: unknown) {
												const msg =
													error instanceof Error
														? error.message
														: String(error);
												console.error(
													'[RF Sweep] Emergency stop failed:',
													msg
												);
												statusMessage = 'Emergency stop failed';
											}
										}}
										class="saasfly-btn w-full mt-2 bg-red-600/20 border-red-500/40 hover:bg-red-600/30 hover:border-border-hover hover:border-opacity-50 text-red-400"
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
												onclick={reconnectToUSRP}
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
						class="saasfly-feature-card group rounded-2xl p-6 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 transition-all duration-300"
					>
						<div class="flex items-center mb-5">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: rgba(124, 58, 237, 0.15); border: 1px solid rgba(124, 58, 237, 0.2);"
							>
								<svg
									class="w-5 h-5 group-hover:scale-110 transition-transform duration-300"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									viewBox="0 0 24 24"
									style="color: #7C3AED;"
								>
									<path
										d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5z"
									/>
									<path
										d="M8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7z"
									/>
									<path
										d="M14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
									/>
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-lg font-semibold text-text-primary mb-0.5"
								>
									Analysis Tools
								</h3>
								<p class="text-xs text-text-muted">Spectrum visualization</p>
							</div>
						</div>

						<div class="space-y-2">
							<button
								onclick={openSpectrumAnalyzer}
								class="saasfly-btn saasfly-btn-spectrum w-full"
								style="background: #4A90E2 !important; background-image: none !important;"
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
				<div class="space-y-6">
					<!-- Cycle Status Card -->
					<div
						class="saasfly-dashboard-card group rounded-2xl p-6 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 transition-all duration-300"
					>
						<div class="flex items-center mb-5">
							<div
								class="p-3 rounded-xl mr-4"
								style="background: rgba(8, 145, 178, 0.15); border: 1px solid rgba(8, 145, 178, 0.2);"
							>
								<svg
									class="w-5 h-5"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									viewBox="0 0 24 24"
									style="color: #0891B2;"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							<div>
								<h3
									class="font-heading text-lg font-semibold text-text-primary mb-0.5"
								>
									Cycle Status
								</h3>
								<p class="text-xs text-text-muted">Sweep monitoring</p>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-4 mb-5">
							<div
								class="p-4 bg-bg-elevated/50 rounded-lg border border-border-subtle"
							>
								<div
									class="text-[10px] text-text-muted uppercase tracking-wide mb-1"
								>
									Current Frequency
								</div>
								<div class="font-mono text-xl font-semibold text-text-primary">
									{currentFrequencyDisplay}
								</div>
							</div>
							<div
								class="p-4 bg-bg-elevated/50 rounded-lg border border-border-subtle"
							>
								<div
									class="text-[10px] text-text-muted uppercase tracking-wide mb-1"
								>
									Next Switch
								</div>
								<div class="font-mono text-xl font-semibold text-text-primary">
									{switchTimer}
								</div>
							</div>
						</div>

						<div class="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
							<div
								class="h-full bg-neon-cyan rounded-full transition-[width] duration-100 ease-linear"
								style="width: {timerProgress}%"
							></div>
						</div>
					</div>

					<!-- Signal Analysis Card -->
					<div
						class="saasfly-feature-card group rounded-2xl p-6 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 transition-all duration-300"
					>
						<div class="flex items-center mb-4">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: rgba(202, 138, 4, 0.15); border: 1px solid rgba(202, 138, 4, 0.2);"
							>
								<svg
									class="w-5 h-5"
									fill="currentColor"
									viewBox="0 0 20 20"
									style="color: #CA8A04;"
								>
									<path
										d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
									/>
								</svg>
							</div>
							<div>
								<h3 class="font-heading text-lg font-semibold text-white">
									Signal Analysis
								</h3>
								<p class="text-xs text-text-muted">Real-time signal monitoring</p>
							</div>
						</div>

						<!-- Signal Metrics Grid -->
						<div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
							<div
								class="p-4 bg-bg-elevated/50 rounded-lg border border-border-subtle"
							>
								<div
									class="text-[10px] text-text-muted uppercase tracking-wide mb-1"
								>
									dB Level
								</div>
								<div class="font-mono text-xl font-semibold text-orange-400">
									{dbLevelValue}
								</div>
							</div>
							<div
								class="p-4 bg-bg-elevated/50 rounded-lg border border-border-subtle"
							>
								<div
									class="text-[10px] text-text-muted uppercase tracking-wide mb-1"
								>
									Strength
								</div>
								<div class="text-xl font-semibold text-signal-strong">
									{signalStrengthText}
								</div>
							</div>
							<div
								class="p-4 bg-bg-elevated/50 rounded-lg border border-border-subtle"
							>
								<div
									class="text-[10px] text-text-muted uppercase tracking-wide mb-1"
								>
									Target
								</div>
								<div class="font-mono text-xl font-semibold text-neon-cyan">
									{targetFrequency}
								</div>
							</div>
							<div
								class="p-4 bg-bg-elevated/50 rounded-lg border border-border-subtle"
							>
								<div
									class="text-[10px] text-text-muted uppercase tracking-wide mb-1"
								>
									Detected
								</div>
								<div class="font-mono text-xl font-semibold text-accent-primary">
									{detectedFrequency}
								</div>
							</div>
							<div
								class="p-4 bg-bg-elevated/50 rounded-lg border border-border-subtle"
							>
								<div
									class="text-[10px] text-text-muted uppercase tracking-wide mb-1"
								>
									Offset
								</div>
								<div class="font-mono text-xl font-semibold text-purple-400">
									{frequencyOffset}
								</div>
							</div>
						</div>

						<!-- Signal Visualization -->
						<div class="relative pb-16">
							<div
								class="text-xs text-text-muted uppercase tracking-wide mb-4 text-center font-medium"
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
						class="saasfly-feature-card group rounded-2xl p-6 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-border-hover/50 transition-all duration-300"
					>
						<div class="flex items-center mb-4">
							<div
								class="p-3 rounded-xl mr-4 transition-all duration-300"
								style="background: rgba(5, 150, 105, 0.15); border: 1px solid rgba(5, 150, 105, 0.2);"
							>
								<svg
									class="w-5 h-5"
									fill="currentColor"
									viewBox="0 0 20 20"
									style="color: #059669;"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									/>
								</svg>
							</div>
							<div>
								<h3 class="font-heading text-lg font-semibold text-white">
									System Status
								</h3>
								<p class="text-xs text-text-muted">Current system information</p>
							</div>
						</div>
						<div
							class="text-text-secondary text-sm min-h-[2.5rem] flex items-center px-4 py-3 bg-bg-elevated/50 rounded-lg border border-border-subtle"
						>
							{statusMessage || 'Ready to start monitoring'}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<footer class="py-6 border-t border-border-primary/20">
		<div class="container mx-auto px-4 lg:px-8 max-w-7xl">
			<div class="flex flex-col md:flex-row justify-between items-center">
				<div class="flex items-center space-x-3 mb-4 md:mb-0">
					<span class="text-xs text-text-muted font-mono">
						{deviceInfo[selectedDevice].name} • {deviceInfo[selectedDevice].freqRange}
					</span>
				</div>
				<div class="flex items-center space-x-6 text-sm text-text-muted">
					<span
						><span class="rf-brand">RF</span>
						<span class="sweep-brand">Sweep</span></span
					>
				</div>
			</div>
		</div>
	</footer>
</div>

<style>
	/* ============================================
	   ENTERPRISE TYPOGRAPHY & COLOR SYSTEM
	   Based on Grafana/Datadog design principles

	   CRITICAL: Use !important to override Tailwind
	   ============================================ */

	/* ===========================================
	   FONT SYSTEM - OVERRIDE ALL TAILWIND FONTS
	   =========================================== */

	/* Base page font - Inter for ALL UI elements */
	:global(.rf-sweep-page),
	:global(.rf-sweep-page *) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
	}

	/* Override Tailwind's font-body class */
	:global(.rf-sweep-page .font-body),
	:global(.rf-sweep-page [class*='font-body']) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
	}

	/* Override Tailwind's font-heading class */
	:global(.rf-sweep-page .font-heading),
	:global(.rf-sweep-page [class*='font-heading']) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
	}

	/* EXCEPTION: Only these elements get monospace font */
	:global(.rf-sweep-page .font-mono),
	:global(.rf-sweep-page input[type='number']),
	:global(.rf-sweep-page .data-value) {
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace !important;
		font-variant-numeric: tabular-nums;
	}

	/* Override Tailwind's text-caption class */
	:global(.rf-sweep-page .text-caption) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
	}

	/* Page title - larger size, override text-h4 and font-heading */
	:global(.rf-sweep-page header h1),
	:global(.rf-sweep-page header h1.font-heading),
	:global(.rf-sweep-page header h1.text-h4),
	:global(.rf-sweep-page header .font-heading) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
		font-size: 1.25rem !important;
		font-weight: 600 !important;
		line-height: 1.2 !important;
	}

	/* Brand text in header */
	:global(.rf-sweep-page .rf-brand),
	:global(.rf-sweep-page .sweep-brand) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
	}

	/* ALL uppercase labels must use Inter, not monospace */
	:global(.rf-sweep-page .uppercase),
	:global(.rf-sweep-page [class*='uppercase']) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
	}

	/* Buttons - always Inter */
	:global(.rf-sweep-page button),
	:global(.rf-sweep-page .saasfly-btn) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
		transition: all 0.2s ease;
	}

	/* Select dropdowns - Inter */
	:global(.rf-sweep-page select),
	:global(.rf-sweep-page option) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
	}

	/* Metric box labels - explicit Inter override for uppercase labels */
	:global(.rf-sweep-page .bg-bg-elevated .text-\[10px\]),
	:global(.rf-sweep-page .bg-bg-elevated\/50 .text-\[10px\]),
	:global(.rf-sweep-page .p-4 .text-\[10px\]),
	:global(.rf-sweep-page .p-3 .text-\[10px\]),
	:global(.rf-sweep-page [class*='bg-bg-elevated'] [class*='uppercase']) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
		font-weight: 600 !important;
		letter-spacing: 0.05em !important;
	}

	/* Data values inside metric boxes - these SHOULD be monospace */
	:global(.rf-sweep-page .bg-bg-elevated .text-xl.font-semibold),
	:global(.rf-sweep-page .bg-bg-elevated\/50 .text-xl.font-semibold),
	:global(.rf-sweep-page .p-4 .text-xl.font-semibold.font-mono) {
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace !important;
		font-variant-numeric: tabular-nums !important;
	}

	/* But Strength text value should be Inter (it shows "No Signal", not numbers) */
	:global(.rf-sweep-page .text-signal-strong:not(.font-mono)),
	:global(.rf-sweep-page .text-xl.font-semibold.text-signal-strong) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
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
			0 0 20px rgba(74, 158, 255, 0.05);
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
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(74, 158, 255, 0.4), transparent);
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

	/* Start button - ARGOS System Blue */
	:global(.saasfly-btn-start) {
		background: #4a90e2 !important;
		color: white !important;
		border: none !important;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
	}

	:global(.saasfly-btn-start:hover:not(:disabled)) {
		background: #3a80d2 !important;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4) !important;
		transform: translateY(-1px);
	}

	/* Stop button - ARGOS System Red */
	:global(.saasfly-btn-stop) {
		background: #dc2626 !important;
		color: white !important;
		border: none !important;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
	}

	:global(.saasfly-btn-stop:hover:not(:disabled)) {
		background: #b91c1c !important;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4) !important;
		transform: translateY(-1px);
	}

	/* Load button - ARGOS System Orange */
	:global(.saasfly-btn-load) {
		background: #f97316 !important;
		color: white !important;
		border: none !important;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
	}

	:global(.saasfly-btn-load:hover) {
		background: #ea580c !important;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4) !important;
		transform: translateY(-1px);
	}

	/* Add button - ARGOS System Green */
	:global(.saasfly-btn-add) {
		background: #10b981 !important;
		color: white !important;
		border: none !important;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
	}

	:global(.saasfly-btn-add:hover) {
		background: #059669 !important;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4) !important;
		transform: translateY(-1px);
	}

	/* Spectrum analyzer button - ARGOS System Blue (high specificity to override global) */
	:global(.saasfly-btn.saasfly-btn-spectrum),
	:global(button.saasfly-btn-spectrum) {
		background: #4a90e2 !important;
		background-image: none !important;
		color: white !important;
		border: none !important;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
	}

	:global(.saasfly-btn.saasfly-btn-spectrum:hover),
	:global(button.saasfly-btn-spectrum:hover) {
		background: #3a80d2 !important;
		background-image: none !important;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4) !important;
		transform: translateY(-1px);
	}

	:global(.saasfly-btn:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none !important;
	}

	/* Cyan accent override - Muted Enterprise cyan */
	:global(.text-neon-cyan) {
		color: #0891b2 !important;
	}
	:global(.bg-neon-cyan) {
		background-color: #0891b2 !important;
	}
	:global(.border-neon-cyan) {
		border-color: #0891b2 !important;
	}

	/* Metric cards - monochrome override to match original */
	:global(.saasfly-metric-card) {
		background: rgba(28, 31, 38, 0.6) !important;
		border-color: rgba(44, 47, 54, 0.6) !important;
	}

	:global(.saasfly-metric-card:hover) {
		background: rgba(37, 40, 47, 0.8) !important;
		border-color: rgba(74, 158, 255, 0.8) !important;
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3) !important;
	}

	/* Remove colored text from metric values */
	:global(.saasfly-metric-card .text-orange-400),
	:global(.saasfly-metric-card .text-signal-none),
	:global(.saasfly-metric-card .text-neon-cyan),
	:global(.saasfly-metric-card .text-accent-primary),
	:global(.saasfly-metric-card .text-purple-400) {
		color: #e8eaed !important;
	}

	/* Info cards - monochrome override to match original */
	:global(.saasfly-info-card) {
		background: rgba(28, 31, 38, 0.6) !important;
		border-color: rgba(44, 47, 54, 0.6) !important;
	}

	:global(.saasfly-info-card:hover) {
		background: rgba(37, 40, 47, 0.8) !important;
		border-color: rgba(74, 158, 255, 0.8) !important;
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3) !important;
	}

	/* Remove colored text from info card values */
	:global(.saasfly-info-card .text-accent-primary),
	:global(.saasfly-info-card .text-neon-cyan) {
		color: #e8eaed !important;
	}

	/* Sweep Control card - override to monochrome */
	:global(.saasfly-feature-card .bg-gradient-to-br.from-accent-primary\/20) {
		background: rgba(74, 158, 255, 0.2) !important;
		border-color: rgba(74, 158, 255, 0.2) !important;
	}

	:global(.saasfly-feature-card .bg-gradient-to-br.from-accent-primary\/20:hover) {
		background: rgba(74, 158, 255, 0.4) !important;
		border-color: rgba(74, 158, 255, 0.4) !important;
		box-shadow: 0 8px 25px rgba(74, 158, 255, 0.2) !important;
	}

	:global(.saasfly-feature-card .text-accent-primary) {
		color: #9aa0a6 !important;
	}

	:global(.saasfly-feature-card:hover .text-accent-primary) {
		color: #e8eaed !important;
	}

	/* Sweep Control header text */
	:global(.sweep-control-header) {
		color: #e8eaed !important;
	}

	/* Analysis Tools card - override purple to monochrome */
	:global(.saasfly-feature-card .bg-gradient-to-br.from-purple-500\/20) {
		background: rgba(74, 158, 255, 0.2) !important;
		border-color: rgba(74, 158, 255, 0.2) !important;
	}

	:global(.saasfly-feature-card .bg-gradient-to-br.from-purple-500\/20:hover) {
		background: rgba(74, 158, 255, 0.4) !important;
		border-color: rgba(74, 158, 255, 0.4) !important;
		box-shadow: 0 8px 25px rgba(74, 158, 255, 0.2) !important;
	}

	:global(.saasfly-feature-card .text-purple-400) {
		color: #9aa0a6 !important;
	}

	:global(.saasfly-feature-card:hover .text-purple-400) {
		color: #e8eaed !important;
	}

	/* External Tools header text */
	:global(.external-tools-header) {
		color: #e8eaed !important;
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
	:global(.rf-brand) {
		color: #2563eb; /* Muted Enterprise Blue */
		font-weight: 600;
		text-shadow: none;
	}

	:global(.sweep-brand) {
		color: #f9fafb;
		text-shadow: none;
	}

	:global(.nav-link) {
		color: #9aa0a6;
		transition: all 0.2s ease;
	}

	:global(.nav-link:hover) {
		color: #4a9eff;
		background: rgba(74, 158, 255, 0.1);
	}

	:global(.nav-link.active) {
		color: #4a9eff;
		background: rgba(74, 158, 255, 0.1);
	}

	:global(.status-panel) {
		background: rgba(28, 31, 38, 0.6);
		border: 1px solid rgba(44, 47, 54, 0.6);
	}

	:global(.glass-button) {
		background: rgba(28, 31, 38, 0.6);
		border: 1px solid rgba(44, 47, 54, 0.6);
		color: #9aa0a6;
		transition: all 0.2s ease;
	}

	:global(.glass-button:hover) {
		background: rgba(37, 40, 47, 0.8);
		border-color: rgba(74, 158, 255, 0.8);
		color: #e8eaed;
	}

	:global(.status-indicator) {
		box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
	}

	/* All cards - remove colored hover effects, keep monochrome */
	:global(.saasfly-feature-card:hover),
	:global(.saasfly-dashboard-card:hover) {
		border-color: rgba(74, 158, 255, 0.8) !important;
		background: rgba(37, 40, 47, 0.8) !important;
	}

	:global(.saasfly-feature-card h3),
	:global(.saasfly-dashboard-card h3) {
		color: #e8eaed !important;
	}

	:global(.saasfly-feature-card:hover h3),
	:global(.saasfly-dashboard-card:hover h3) {
		color: #e8eaed !important;
	}

	/* Keep header text white on all cards */
	:global(.frequency-config-header),
	:global(.sweep-control-header),
	:global(.external-tools-header) {
		color: #e8eaed !important;
	}

	:global(.saasfly-feature-card:hover .frequency-config-header),
	:global(.saasfly-feature-card:hover .sweep-control-header),
	:global(.saasfly-feature-card:hover .external-tools-header) {
		color: #e8eaed !important;
	}

	/* ============================================
	   ENTERPRISE TYPOGRAPHY STANDARDIZATION
	   ============================================ */

	/* ALL uppercase labels must be sans-serif, NEVER monospace */
	:global(.rf-sweep-page .text-\[10px\]),
	:global(.rf-sweep-page .text-xs.uppercase),
	:global(.rf-sweep-page [class*='uppercase'][class*='tracking']) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
	}

	/* Standardized borders - exactly 1px everywhere with consistent light color */
	:global(.rf-sweep-page .border-border-subtle),
	:global(.rf-sweep-page .border-border-primary),
	:global(.rf-sweep-page [class*='border-border']) {
		border-width: 1px !important;
		border-color: rgba(44, 47, 54, 0.6) !important; /* Same as input borders */
	}

	/* Metric boxes - subtle light borders matching frequency input */
	:global(.rf-sweep-page .p-4.rounded-lg.border),
	:global(.rf-sweep-page .p-3.rounded-lg.border),
	:global(.rf-sweep-page [class*='bg-bg-elevated'].border) {
		border-width: 1px !important;
		border-color: rgba(44, 47, 54, 0.6) !important;
	}

	/* Frequency items - match the input border style */
	:global(.rf-sweep-page .frequency-item) {
		border-width: 1px !important;
		border-color: rgba(44, 47, 54, 0.6) !important;
	}

	/* Metric box labels - explicit sans-serif */
	:global(.rf-sweep-page .bg-bg-elevated .text-\[10px\]) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
		font-weight: 600 !important;
		color: #6b7280 !important;
	}

	/* Data values in metric boxes - explicit monospace */
	:global(.rf-sweep-page .bg-bg-elevated .text-xl) {
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace !important;
		font-variant-numeric: tabular-nums;
	}

	/* Exception: "Strength" value shows text like "No Signal", not numbers */
	:global(.rf-sweep-page .text-signal-strong:not(.font-mono)) {
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif !important;
	}

	/* Signal strength scale labels - MUST be monospace */
	:global(.rf-sweep-page .signal-indicator ~ div .font-mono),
	:global(.rf-sweep-page [data-db] .font-mono),
	:global(.rf-sweep-page .signal-indicator .font-mono),
	:global(.rf-sweep-page .text-signal-weak.font-mono),
	:global(.rf-sweep-page .text-signal-moderate.font-mono),
	:global(.rf-sweep-page .text-signal-strong.font-mono),
	:global(.rf-sweep-page .text-signal-very-strong.font-mono),
	:global(.rf-sweep-page .text-blue-400.font-mono) {
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace !important;
		font-variant-numeric: tabular-nums !important;
	}

	/* Muted brand colors */
	:global(.rf-brand) {
		color: #2563eb !important; /* Muted from #3B82F6 */
	}

	/* Placeholder text styling */
	:global(.rf-sweep-page .text-xl.font-semibold) {
		color: var(--text-primary);
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
