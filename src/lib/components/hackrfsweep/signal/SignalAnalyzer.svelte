<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { signalStore } from '$lib/stores/hackrfsweep/signalStore';
	import { signalHelpers } from '$lib/services/hackrfsweep/signalService';
	import { displayStore } from '$lib/stores/hackrfsweep/displayStore';
	import { spectrumData, connectionStatus } from '$lib/stores/hackrf';

	// Reactive signal state
	$: signalState = $signalStore;
	$: displayState = $displayStore;
	$: spectrum = $spectrumData;
	$: connection = $connectionStatus;

	// Component lifecycle
	onMount(() => {
		// Initialize signal processing when component mounts
		signalHelpers.startProcessing();
	});

	onDestroy(() => {
		// Clean up signal processing when component unmounts
		signalHelpers.stopProcessing();
	});

	// Reactive signal processing
	$: if (spectrum && !displayState.timer.isSwitching) {
		processSignalData(spectrum);
	}

	// Process incoming spectrum data
	function processSignalData(data: any) {
		if (!data || typeof data !== 'object') return;

		// Extract peak power and frequency
		if ('peak_power' in data && data.peak_power !== undefined) {
			const peakPower = data.peak_power;
			
			// Update signal strength text and visual indicators
			updateSignalStrength(peakPower);
			updateSignalIndicator(peakPower);
		}

		// Handle frequency data
		if ('peak_freq' in data && data.peak_freq !== undefined) {
			handleFrequencyData(data.peak_freq);
		}
	}

	// Update signal strength classification
	function updateSignalStrength(db: number) {
		let strengthText: string;
		
		if (db < -90) strengthText = 'No Signal';
		else if (db < -70) strengthText = 'Very Weak';
		else if (db < -50) strengthText = 'Weak';
		else if (db < -30) strengthText = 'Moderate';
		else if (db < -10) strengthText = 'Strong';
		else strengthText = 'Very Strong';

		// Update display store with signal strength
		displayStore.update(state => ({
			...state,
			signalAnalysis: {
				...state.signalAnalysis,
				dbLevelValue: db.toFixed(2),
				signalStrengthText: strengthText
			}
		}));
	}

	// Update visual signal indicator
	function updateSignalIndicator(db: number) {
		// Clamp between -90 and -10 dB
		const clampedDb = Math.max(-90, Math.min(-10, db));
		const percentage = ((clampedDb + 90) / 80) * 100;

		// Update display store with indicator values
		displayStore.update(state => ({
			...state,
			signalAnalysis: {
				...state.signalAnalysis,
				signalFillWidth: percentage + '%',
				dbIndicatorPosition: percentage + '%',
				dbCurrentValue: clampedDb.toFixed(0) + ' dB'
			}
		}));

		// Update DOM elements directly for smooth animation
		signalHelpers.updateIndicatorUI(clampedDb);
	}

	// Handle detected frequency data
	function handleFrequencyData(detectedFreqMHz: number) {
		const targetFreqStr = displayState.signalAnalysis.targetFrequency;
		const targetFreqMHz = parseFloat(targetFreqStr.replace(' MHz', ''));

		// Validate frequency data (within 50 MHz tolerance)
		if (!isNaN(targetFreqMHz) && signalHelpers.validateSignal(targetFreqMHz, detectedFreqMHz)) {
			const detectedFreqStr = detectedFreqMHz.toFixed(2) + ' MHz';
			const offset = detectedFreqMHz - targetFreqMHz;
			const offsetStr = (offset >= 0 ? '+' : '') + offset.toFixed(2) + ' MHz';

			// Update display store with frequency information
			displayStore.update(state => ({
				...state,
				signalAnalysis: {
					...state.signalAnalysis,
					detectedFrequency: detectedFreqStr,
					frequencyOffset: offsetStr
				}
			}));
		}
	}

	// Handle frequency switching
	$: if (displayState.timer.isSwitching) {
		signalHelpers.handleFrequencySwitch();
	}

	// Handle connection loss
	$: if (!connection.connected && signalState.processingActive) {
		signalHelpers.stopProcessing();
	}
</script>

<!-- Signal Analyzer Component -->
<!-- This component operates in the background and has no visual representation -->
<!-- It processes spectrum data and updates signal analysis displays -->

<div class="signal-analyzer-component" style="display: none;">
	<!-- Background Signal Processing Component -->
	<!-- Processes spectrum data: {spectrum ? 'Active' : 'Inactive'} -->
	<!-- Signal processing: {signalState.processingActive ? 'Running' : 'Stopped'} -->
	<!-- Current signal: {signalState.currentSignalData?.power?.toFixed(2) || '--'} dB -->
	<!-- Analysis metrics: Peak {signalState.analysisMetrics.peakPower.toFixed(1)} dB, SNR {signalState.analysisMetrics.signalToNoise.toFixed(1)} dB -->
</div>

<style>
	.signal-analyzer-component {
		/* Hidden component for background processing */
		position: absolute;
		visibility: hidden;
		pointer-events: none;
	}
</style>