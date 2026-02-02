<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { usrpAPI } from '$lib/services/usrp/api';
	import { spectrumData } from '$lib/stores/usrp';

	export let isOpen = false;
	export let onClose: () => void = () => {};

	// State
	let isRFEnabled = false;
	let isProcessing = false;
	let connectionStatus = 'Disconnected';
	let _deviceInfo = '';
	let signalCount = 0;
	let targetFrequency = '';
	let frequencyBands = {
		wifi24: false,
		wifi5: false,
		drone24: false,
		drone58: false,
		drone900: false,
		custom: false
	};

	// Signal stats
	let detectedSignals: Array<{
		frequency: number;
		power: number;
		type: string;
		timestamp: number;
	}> = [];

	let updateInterval: ReturnType<typeof setInterval>;
	let spectrumUnsubscribe: (() => void) | null = null;

	async function toggleRFDetection() {
		if (isProcessing) return;

		// Check if any frequencies are selected when trying to start
		if (!isRFEnabled) {
			const hasSelectedFrequencies =
				Object.values(frequencyBands).some((v) => v) || targetFrequency;
			if (!hasSelectedFrequencies) {
				alert(
					'Please select at least one frequency band or enter a custom frequency before starting the RF scan.'
				);
				isProcessing = false;
				return;
			}
		}

		isProcessing = true;

		try {
			if (!isRFEnabled) {
				// First check device status
				const statusResponse = await fetch('/api/rf/status?device=usrp');
				const statusData = await statusResponse.json();
				const status = statusData.data;

				console.log('USRP current status:', status);

				// Check if USRP is connected
				if (!status.connectedDevices?.usrp) {
					connectionStatus = 'USRP B205 mini not detected';
					alert('USRP B205 mini not detected. Please connect the device.');
					isProcessing = false;
					return;
				}

				_deviceInfo = status.deviceInfo?.usrp?.info || 'USRP B205 mini';

				if (status.isRunning) {
					// USRP is already running, just connect to existing stream
					isRFEnabled = true;
					connectionStatus = 'Connected (Using Existing Sweep)';
					console.log('USRP already running, connecting to existing data stream');

					// Reconnect to data stream
					usrpAPI.reconnect();

					// Subscribe to spectrum data
					if (!spectrumUnsubscribe) {
						spectrumUnsubscribe = spectrumData.subscribe((data) => {
							console.log('Received spectrum data:', data);
							if (data && isRFEnabled) {
								processSpectrumData(data);
							}
						});
					}
				} else {
					// USRP not running, start new sweep
					// Connect to data stream
					usrpAPI.connectToDataStream();
					connectionStatus = 'Connecting...';

					// Build frequency ranges based on selected bands
					console.log('Building frequencies with bands:', frequencyBands);
					const frequencies = [];

					if (frequencyBands.wifi24) {
						console.log('Adding WiFi 2.4GHz frequencies');
						frequencies.push({ start: 2400, stop: 2500, step: 5 });
					} else {
						console.log('WiFi 2.4GHz NOT selected');
					}
					if (frequencyBands.wifi5) {
						frequencies.push({ start: 5150, stop: 5850, step: 5 });
					}
					if (frequencyBands.drone24) {
						frequencies.push({ start: 2400, stop: 2483, step: 1 });
					}
					if (frequencyBands.drone58) {
						frequencies.push({ start: 5725, stop: 5875, step: 1 });
					}
					if (frequencyBands.drone900) {
						frequencies.push({ start: 900, stop: 928, step: 1 });
					}
					if (frequencyBands.custom && targetFrequency) {
						const freq = Number(targetFrequency);
						frequencies.push({ start: freq - 10, stop: freq + 10, step: 1 });
					}

					// If no specific bands selected, use wide scan
					if (frequencies.length === 0) {
						console.log('No frequencies selected, using default wide scan');
						frequencies.push({ start: 1, stop: 6000, step: 1 });
					}

					console.log('Final frequencies to use:', frequencies);

					// Start USRP RF sweep
					const response = await fetch('/api/rf/start-sweep', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							deviceType: 'usrp',
							frequencies,
							cycleTime: 10,
							gain: 40,
							sampleRate: 20e6
						})
					});

					if (response.ok) {
						isRFEnabled = true;
						connectionStatus = 'Connected to USRP B205 mini';
						console.log(
							'USRP sweep started successfully with frequencies:',
							frequencies
						);

						// Subscribe to spectrum data
						if (!spectrumUnsubscribe) {
							spectrumUnsubscribe = spectrumData.subscribe((data) => {
								console.log(
									'[AirSignal] Spectrum data subscription triggered:',
									data
								);
								console.log('[AirSignal] isRFEnabled:', isRFEnabled);
								if (data && isRFEnabled) {
									console.log('[AirSignal] Processing spectrum data...');
									processSpectrumData(data);
								}
							});
						}
					} else {
						const errorText = await response.text();
						console.error('Failed to start USRP sweep:', response.status, errorText);
						connectionStatus = 'Connection Failed';
						usrpAPI.disconnect();
						alert('Failed to start USRP sweep. Check if USRP B205 mini is connected.');
					}
				}
			} else {
				// Stop RF detection
				await fetch('/api/rf/stop-sweep', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ deviceType: 'usrp' })
				});

				usrpAPI.disconnect();

				if (spectrumUnsubscribe) {
					spectrumUnsubscribe();
					spectrumUnsubscribe = null;
				}

				isRFEnabled = false;
				connectionStatus = 'Disconnected';
				detectedSignals = [];
				signalCount = 0;
			}
		} catch (error) {
			console.error('Error toggling RF detection:', error);
			connectionStatus = 'Error';
			usrpAPI.disconnect();
		} finally {
			isProcessing = false;
		}
	}

	function processSpectrumData(data: any) {
		// Debug logging
		console.log('Processing spectrum data:', data);

		// Check if we have power levels array
		if (
			!data.power_levels ||
			!Array.isArray(data.power_levels) ||
			data.power_levels.length === 0
		) {
			console.log('No power levels in data');
			return;
		}

		// Find peak power and its frequency
		let maxPower = -200;
		let peakIndex = -1;

		for (let i = 0; i < data.power_levels.length; i++) {
			if (data.power_levels[i] > maxPower) {
				maxPower = data.power_levels[i];
				peakIndex = i;
			}
		}

		// Lower threshold to -100 dBm to catch very weak signals (router should be much stronger)
		if (maxPower < -100) {
			console.log('Peak power too low:', maxPower);
			return;
		}

		// Calculate frequency for the peak
		let peakFreq;
		if (data.frequencies && data.frequencies.length > peakIndex) {
			peakFreq = data.frequencies[peakIndex];
		} else if (data.start_freq && data.stop_freq) {
			// Calculate frequency from range
			const freqStep = (data.stop_freq - data.start_freq) / (data.power_levels.length - 1);
			peakFreq = data.start_freq + peakIndex * freqStep;
		} else {
			console.log('Cannot determine frequency');
			return;
		}

		// Classify signal type
		let signalType = 'Unknown';

		if (peakFreq >= 2400 && peakFreq <= 2500) {
			signalType = 'WiFi 2.4GHz / Drone';
		} else if (peakFreq >= 5150 && peakFreq <= 5850) {
			signalType = 'WiFi 5GHz';
		} else if (peakFreq >= 5725 && peakFreq <= 5875) {
			signalType = 'Drone Video';
		} else if (peakFreq >= 900 && peakFreq <= 928) {
			signalType = 'Drone Control';
		}

		console.log(
			`Detected signal: ${peakFreq.toFixed(1)} MHz @ ${maxPower.toFixed(1)} dBm - ${signalType}`
		);

		// Add to detected signals
		detectedSignals = [
			{
				frequency: peakFreq,
				power: maxPower,
				type: signalType,
				timestamp: Date.now()
			},
			...detectedSignals.slice(0, 49) // Keep last 50 signals
		];

		signalCount = detectedSignals.length;
	}

	function getSignalStrength(power: number): string {
		if (power > -50) return 'Very Strong';
		if (power > -60) return 'Strong';
		if (power > -70) return 'Good';
		if (power > -80) return 'Fair';
		return 'Weak';
	}

	function getSignalColor(power: number): string {
		if (power > -50) return '#dc2626';
		if (power > -60) return '#ff4400';
		if (power > -70) return '#f97316';
		if (power > -80) return '#fbbf24';
		return '#0088ff';
	}

	function toggleFrequencyBand(band: keyof typeof frequencyBands) {
		frequencyBands[band] = !frequencyBands[band];
		console.log(`Toggled ${band} to:`, frequencyBands[band]);
		console.log('Current frequency bands:', frequencyBands);
		// Don't automatically restart - user needs to toggle RF detection manually
	}

	function applyCustomFrequency() {
		if (!targetFrequency || isNaN(Number(targetFrequency))) {
			alert('Please enter a valid frequency in MHz');
			return;
		}

		frequencyBands.custom = true;
		// Don't automatically restart - user needs to toggle RF detection manually
	}

	onMount(() => {
		// Update detected signals periodically
		updateInterval = setInterval(() => {
			// Remove signals older than 30 seconds
			const cutoff = Date.now() - 30000;
			detectedSignals = detectedSignals.filter((s) => s.timestamp > cutoff);
			signalCount = detectedSignals.length;
		}, 1000);
	});

	onDestroy(() => {
		if (updateInterval) {
			clearInterval(updateInterval);
		}

		if (spectrumUnsubscribe) {
			spectrumUnsubscribe();
		}

		// Stop RF if still running
		if (isRFEnabled) {
			fetch('/api/rf/stop-sweep', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ deviceType: 'usrp' })
			});
			usrpAPI.disconnect();
		}
	});
</script>

{#if isOpen}
	<div class="overlay-backdrop" on:click={onClose}>
		<div class="overlay-container" on:click|stopPropagation>
			<!-- Header -->
			<div class="overlay-header">
				<h2>AirSignal RF</h2>
				<button class="close-button" on:click={onClose}>×</button>
			</div>

			<!-- Status Bar -->
			<div class="status-bar">
				<div class="status-item">
					<span class="status-label">Status:</span>
					<span class="status-value {isRFEnabled ? 'connected' : 'disconnected'}">
						{connectionStatus}
					</span>
				</div>
				<div class="status-item">
					<span class="status-label">Mode:</span>
					<span class="status-value">{isRFEnabled ? 'Scanning' : 'Idle'}</span>
				</div>
				<div class="status-item">
					<span class="status-label">Signals:</span>
					<span class="status-value">{signalCount}</span>
				</div>
			</div>

			<!-- Frequency Selection Section -->
			<div class="frequency-section">
				<div class="section-header">
					<h3>Select Target Frequencies</h3>
					<div class="section-subtitle">Choose one or more frequency bands to scan</div>
				</div>

				<div class="frequency-grid">
					<button
						class="freq-button {frequencyBands.wifi24 ? 'active' : ''}"
						on:click={() => toggleFrequencyBand('wifi24')}
					>
						<div class="freq-icon">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M1 9l2-2v8h-2zm4-1l2-2v10h-2zm4-1l2-2v12h-2zm16-4l-7 7-4.5-4.5L5 14l-2-2L13.5 1.5 19 7l5-5z"
								/>
							</svg>
						</div>
						<div class="freq-info">
							<span class="freq-name">WiFi 2.4GHz</span>
							<span class="freq-range">2400-2500 MHz</span>
						</div>
					</button>

					<button
						class="freq-button {frequencyBands.wifi5 ? 'active' : ''}"
						on:click={() => toggleFrequencyBand('wifi5')}
					>
						<div class="freq-icon">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M1 9l2-2v8h-2zm4-1l2-2v10h-2zm4-1l2-2v12h-2zm16-4l-7 7-4.5-4.5L5 14l-2-2L13.5 1.5 19 7l5-5z"
								/>
							</svg>
						</div>
						<div class="freq-info">
							<span class="freq-name">WiFi 5GHz</span>
							<span class="freq-range">5150-5850 MHz</span>
						</div>
					</button>

					<button
						class="freq-button {frequencyBands.drone24 ? 'active' : ''}"
						on:click={() => toggleFrequencyBand('drone24')}
					>
						<div class="freq-icon">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
								/>
							</svg>
						</div>
						<div class="freq-info">
							<span class="freq-name">Drone 2.4GHz</span>
							<span class="freq-range">2400-2483 MHz</span>
						</div>
					</button>

					<button
						class="freq-button {frequencyBands.drone58 ? 'active' : ''}"
						on:click={() => toggleFrequencyBand('drone58')}
					>
						<div class="freq-icon">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
								/>
							</svg>
						</div>
						<div class="freq-info">
							<span class="freq-name">Drone 5.8GHz</span>
							<span class="freq-range">5725-5875 MHz</span>
						</div>
					</button>

					<button
						class="freq-button {frequencyBands.drone900 ? 'active' : ''}"
						on:click={() => toggleFrequencyBand('drone900')}
					>
						<div class="freq-icon">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
								/>
							</svg>
						</div>
						<div class="freq-info">
							<span class="freq-name">Drone 900MHz</span>
							<span class="freq-range">900-928 MHz</span>
						</div>
					</button>
				</div>

				<!-- Custom Frequency -->
				<div class="custom-freq-section">
					<div class="custom-freq-label">Custom Frequency</div>
					<div class="custom-freq-input-group">
						<input
							type="number"
							placeholder="Frequency"
							bind:value={targetFrequency}
							class="freq-input"
						/>
						<span class="freq-unit">MHz</span>
						<button class="apply-button" on:click={applyCustomFrequency}> Add </button>
					</div>
				</div>

				<!-- Scan Control -->
				<div class="scan-control-section">
					{#if !isRFEnabled && Object.values(frequencyBands).every((v) => !v) && !targetFrequency}
						<div class="instruction-text">
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="currentColor"
								style="color: #fbbf24;"
							>
								<path
									d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
								/>
							</svg>
							<span>Select at least one frequency band before scanning</span>
						</div>
					{/if}

					<button
						class="rf-toggle-button {isRFEnabled ? 'active' : ''} {isProcessing
							? 'processing'
							: ''}"
						on:click={toggleRFDetection}
						disabled={isProcessing}
					>
						{#if isRFEnabled}
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
							>
								<rect x="6" y="6" width="12" height="12" rx="2" stroke-width="2" />
							</svg>
							<span>Stop Scanning</span>
						{:else}
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
							>
								<polygon points="5 3 19 12 5 21 5 3" stroke-width="2" />
							</svg>
							<span>Start Scanning</span>
						{/if}
					</button>
				</div>
			</div>

			<!-- Detected Signals -->
			<div class="signals-section">
				<div class="section-header">
					<h3>Detected Signals</h3>
					<div class="section-subtitle">Real-time RF signal detection results</div>
				</div>
				<div class="signals-table">
					<div class="table-header">
						<div>Frequency</div>
						<div>Power</div>
						<div>Strength</div>
						<div>Type</div>
						<div>Age</div>
					</div>
					<div class="table-body">
						{#each detectedSignals as signal}
							<div class="table-row">
								<div>{signal.frequency.toFixed(1)} MHz</div>
								<div style="color: {getSignalColor(signal.power)}">
									{signal.power.toFixed(1)} dBm
								</div>
								<div>{getSignalStrength(signal.power)}</div>
								<div>{signal.type}</div>
								<div>{Math.floor((Date.now() - signal.timestamp) / 1000)}s</div>
							</div>
						{/each}

						{#if detectedSignals.length === 0}
							<div class="empty-message">
								{isRFEnabled
									? 'Scanning for signals...'
									: 'Start RF detection to see signals'}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
		padding: 1rem;
	}

	.overlay-container {
		background: #0f0f0f;
		border: 1px solid #333;
		border-radius: 12px;
		max-width: 800px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow:
			0 20px 25px -5px rgba(0, 0, 0, 0.3),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.overlay-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #333;
		background: linear-gradient(to bottom, #1a1d23 0%, #1c1f26 100%);
		position: sticky;
		top: 0;
		z-index: 10;
		border-radius: 12px 12px 0 0;
	}

	.overlay-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: #fff;
	}

	.close-button {
		background: none;
		border: none;
		color: #888;
		font-size: 2rem;
		cursor: pointer;
		padding: 0;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-button:hover {
		color: #fff;
		background: #444;
	}

	.status-bar {
		display: flex;
		gap: 2rem;
		padding: 1rem 1.5rem;
		background: #222;
		border-bottom: 1px solid #444;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-label {
		color: #888;
		font-size: 0.875rem;
	}

	.status-value {
		color: #fff;
		font-weight: 500;
	}

	.status-value.connected {
		color: #10b981;
	}

	.status-value.disconnected {
		color: #ef4444;
	}

	.main-control {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
	}

	.instruction-text {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(251, 191, 36, 0.1);
		border: 1px solid rgba(251, 191, 36, 0.3);
		border-radius: 6px;
		color: #fbbf24;
		font-size: 0.875rem;
	}

	.rf-toggle-button {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		border: none;
		color: #fff;
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 1rem;
		font-weight: 600;
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.rf-toggle-button:hover:not(:disabled) {
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
	}

	.rf-toggle-button.active {
		background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
		color: #fff;
		box-shadow: 0 0 20px rgba(220, 38, 38, 0.3);
	}

	.rf-toggle-button.active:hover:not(:disabled) {
		background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
		box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
	}

	.rf-toggle-button.processing {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.rf-toggle-button svg {
		width: 20px;
		height: 20px;
	}

	.frequency-section {
		padding: 1.5rem 1.5rem 1rem;
	}

	.section-header {
		margin-bottom: 1.5rem;
	}

	.section-header h3 {
		color: #fff;
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.section-subtitle {
		color: #888;
		font-size: 0.875rem;
	}

	.frequency-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.freq-button {
		background: #1e1e1e;
		border: 1px solid #333;
		border-radius: 8px;
		padding: 0.75rem;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		transition: all 0.2s;
		font-family: inherit;
		color: inherit;
		position: relative;
		overflow: hidden;
	}

	.freq-button::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.1) 100%);
		opacity: 0;
		transition: opacity 0.2s;
	}

	.freq-button:hover {
		border-color: #555;
		transform: translateY(-1px);
	}

	.freq-button:hover::before {
		opacity: 1;
	}

	.freq-button.active {
		background: #1e3a8a;
		border-color: #3b82f6;
		box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
	}

	.freq-button.active::before {
		opacity: 1;
		background: linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.2) 100%);
	}

	.freq-icon {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #888;
		transition: color 0.2s;
	}

	.freq-button:hover .freq-icon,
	.freq-button.active .freq-icon {
		color: #3b82f6;
	}

	.freq-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.freq-name {
		color: #fff;
		font-weight: 500;
		font-size: 0.875rem;
	}

	.freq-range {
		color: #666;
		font-size: 0.75rem;
	}

	.custom-freq-section {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #333;
	}

	.custom-freq-label {
		color: #888;
		font-size: 0.875rem;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.custom-freq-input-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.freq-input {
		flex: 1;
		background: #1e1e1e;
		border: 1px solid #333;
		color: #fff;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-family: inherit;
		font-size: 0.875rem;
		min-width: 140px;
		max-width: 180px;
	}

	.freq-input:focus {
		outline: none;
		border-color: #3b82f6;
		background: #262626;
	}

	.freq-unit {
		color: #666;
		font-size: 0.875rem;
	}

	.apply-button {
		background: #1e40af;
		border: none;
		color: #fff;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.apply-button:hover {
		background: #1e3a8a;
		transform: translateY(-1px);
	}

	.scan-control-section {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #333;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.signals-section {
		padding: 1.5rem;
		border-top: 1px solid #333;
		background: #181818;
	}

	.signals-table {
		background: #1e1e1e;
		border: 1px solid #333;
		border-radius: 8px;
		overflow: hidden;
	}

	.table-header {
		display: grid;
		grid-template-columns: 1.5fr 1fr 1fr 1.5fr 0.8fr;
		padding: 0.75rem 1rem;
		background: #262626;
		border-bottom: 1px solid #333;
		color: #666;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.table-body {
		max-height: 280px;
		overflow-y: auto;
	}

	.table-body::-webkit-scrollbar {
		width: 8px;
	}

	.table-body::-webkit-scrollbar-track {
		background: #1a1d23;
	}

	.table-body::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 4px;
	}

	.table-body::-webkit-scrollbar-thumb:hover {
		background: #555;
	}

	.table-row {
		display: grid;
		grid-template-columns: 1.5fr 1fr 1fr 1.5fr 0.8fr;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid #262626;
		color: #ccc;
		font-size: 0.875rem;
		transition: background 0.1s;
	}

	.table-row:hover {
		background: #262626;
	}

	.table-row:last-child {
		border-bottom: none;
	}

	.empty-message {
		padding: 3rem;
		text-align: center;
		color: #666;
	}

	@keyframes pulse {
		0% {
			r: 8;
			opacity: 1;
		}
		100% {
			r: 12;
			opacity: 0;
		}
	}

	@keyframes pulse-center {
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

	.pulse {
		animation: pulse 2s ease-out infinite;
	}

	.pulse-center {
		animation: pulse-center 1s ease-in-out infinite;
	}
</style>
