<script lang="ts">
	import { onMount } from 'svelte';
	import { rtl433Store } from '$lib/stores/rtl433Store';
	import { goto } from '$app/navigation';

	// Store subscriptions
	let rtl433Status = 'stopped';
	let isLoading = false; // eslint-disable-line @typescript-eslint/no-unused-vars
	let hasError = false; // eslint-disable-line @typescript-eslint/no-unused-vars
	let errorMessage = ''; // eslint-disable-line @typescript-eslint/no-unused-vars
	let capturedSignals: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
	let totalSignals = 0;
	let selectedFrequency = '433.92';
	let selectedSampleRate = '250000';
	let selectedFormat = 'json';
	let enabledProtocols: string[] = [];
	let availableProtocols: string[] = []; // eslint-disable-line @typescript-eslint/no-unused-vars

	// Console output state
	let consoleOutput: string[] = [];
	let showConsole = false;

	// Subscribe to store
	const unsubscribe = rtl433Store.subscribe((state) => {
		capturedSignals = state.capturedSignals;
		totalSignals = state.totalSignals;
		selectedFrequency = state.selectedFrequency;
		selectedSampleRate = state.selectedSampleRate;
		selectedFormat = state.selectedFormat;
		enabledProtocols = state.enabledProtocols;
		consoleOutput = state.consoleOutput;
		showConsole = state.showConsole;
	});

	onMount(() => {
		checkRTL433Status();
		const statusInterval = setInterval(checkRTL433Status, 5000);

		// Load available protocols
		loadAvailableProtocols();

		return () => {
			clearInterval(statusInterval);
			unsubscribe();
		};
	});

	async function checkRTL433Status() {
		try {
			const response = await fetch('/api/rtl-433/status');
			if (response.ok) {
				const data = await response.json();

				// Update status from API but don't auto-start monitoring
				const isRunning = data.status === 'running';
				if (isRunning && rtl433Status !== 'running') {
					rtl433Status = 'running';
					hasError = false;
					// NOTE: Don't auto-start console monitoring here - user must click Start
				} else if (!isRunning && rtl433Status !== 'stopped') {
					rtl433Status = 'stopped';
				}
			}
		} catch (error) {
			console.error('Error checking RTL_433 status:', error);
		}
	}

	async function loadAvailableProtocols() {
		try {
			const response = await fetch('/api/rtl-433/protocols');
			if (response.ok) {
				const data = await response.json();
				availableProtocols = data.protocols || [];
			}
		} catch (error) {
			console.error('Error loading protocols:', error);
		}
	}

	async function startRTL433() {
		if (rtl433Status === 'starting' || rtl433Status === 'stopping') {
			return;
		}

		rtl433Status = 'starting';
		rtl433Store.clearConsoleOutput();
		rtl433Store.setShowConsole(true);

		try {
			const response = await fetch('/api/rtl-433/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'start',
					frequency: selectedFrequency,
					sampleRate: selectedSampleRate,
					format: selectedFormat,
					protocols: enabledProtocols
				})
			});

			const data = await response.json();

			if (response.ok && data.success) {
				// Start monitoring console output
				startConsoleMonitoring();

				// Wait a bit for the service to fully start
				setTimeout(() => {
					rtl433Status = 'running';
					hasError = false;
					checkRTL433Status();
				}, 3000);
			} else {
				// Handle the case where RTL_433 is already running
				if (data.message && data.message.includes('already running')) {
					rtl433Status = 'running';
					hasError = false;
					errorMessage = '';
					// Note: Don't auto-start monitoring - let user click Start to monitor
				} else {
					throw new Error(data.message || 'Failed to start RTL_433');
				}
			}
		} catch (error) {
			console.error('Failed to start RTL_433:', error);
			rtl433Status = 'stopped';
			hasError = true;
			errorMessage = error instanceof Error ? error.message : 'Unknown error';
		}
	}

	async function stopRTL433() {
		if (rtl433Status === 'starting' || rtl433Status === 'stopping') return;

		rtl433Status = 'stopping';

		try {
			const response = await fetch('/api/rtl-433/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'stop' })
			});

			const data = await response.json();

			if (response.ok && data.success) {
				rtl433Status = 'stopped';
				hasError = false;
				rtl433Store.setShowConsole(false);
			} else {
				throw new Error(data.message || 'Failed to stop RTL_433');
			}
		} catch (error) {
			console.error('Failed to stop RTL_433:', error);
			rtl433Status = 'stopped';
			hasError = true;
			errorMessage = error instanceof Error ? error.message : 'Failed to stop RTL_433';
		}
	}

	function toggleRTL433() {
		if (rtl433Status === 'running') {
			// If running, check if we're monitoring. If not, start monitoring.
			if (!showConsole) {
				rtl433Store.setShowConsole(true);
				startConsoleMonitoring();
			} else {
				// If monitoring, stop RTL_433
				stopRTL433().catch((error) => {
					console.error('Error stopping RTL_433:', error);
				});
			}
		} else if (rtl433Status === 'stopped') {
			startRTL433().catch((error) => {
				console.error('Error starting RTL_433:', error);
			});
		}
	}

	async function startConsoleMonitoring() {
		try {
			const response = await fetch('/api/rtl-433/stream');
			if (!response.ok) return;

			const reader = response.body?.getReader();
			if (!reader) return;

			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.trim()) {
						try {
							const data = JSON.parse(line);
							if (data.type === 'console') {
								rtl433Store.addConsoleOutput(data.message);
							} else if (data.type === 'signal') {
								rtl433Store.addCapturedSignal(data.signal);
							}
						} catch (_error: unknown) {
							// Regular console output
							rtl433Store.addConsoleOutput(line);
						}
					}
				}
			}
		} catch (error) {
			console.error('Error monitoring console:', error);
		}
	}

	function clearConsole() {
		rtl433Store.clearConsoleOutput();
	}

	function clearSignals() {
		rtl433Store.clearCapturedSignals();
	}

	function _updateFrequency(event: Event) {
		const target = event.target as HTMLInputElement;
		selectedFrequency = target.value;
		rtl433Store.setSelectedFrequency(selectedFrequency);
	}

	function setFrequency(frequency: string) {
		selectedFrequency = frequency;
		rtl433Store.setSelectedFrequency(selectedFrequency);
	}

	function updateSampleRate(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedSampleRate = target.value;
		rtl433Store.setSelectedSampleRate(selectedSampleRate);
	}

	function updateFormat(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedFormat = target.value;
		rtl433Store.setSelectedFormat(selectedFormat);
	}

	function _toggleProtocol(protocol: string) {
		if (enabledProtocols.includes(protocol)) {
			enabledProtocols = enabledProtocols.filter((p) => p !== protocol);
		} else {
			enabledProtocols = [...enabledProtocols, protocol];
		}
		rtl433Store.setEnabledProtocols(enabledProtocols);
	}

	function goBack() {
		goto('/');
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'running':
				return '#10b981';
			case 'starting':
				return '#f59e0b';
			case 'stopping':
				return '#f59e0b';
			case 'stopped':
				return '#ef4444';
			default:
				return '#6b7280';
		}
	}

	function getStatusText(status: string) {
		switch (status) {
			case 'running':
				return 'RTL_433 Running';
			case 'starting':
				return 'Starting RTL_433...';
			case 'stopping':
				return 'Stopping RTL_433...';
			case 'stopped':
				return 'RTL_433 Stopped';
			default:
				return 'Unknown Status';
		}
	}

	function formatSignalTime(timestamp: string) {
		return new Date(timestamp).toLocaleTimeString();
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function formatSignalData(signal: any) {
		const { time: _time, ...data } = signal;
		return JSON.stringify(data, null, 2);
	}
</script>

<svelte:head>
	<title>RTL_433 - Argos Console</title>
	<meta
		name="description"
		content="RTL_433 Signal Decoder - Decode radio transmissions from various devices"
	/>
</svelte:head>

<div class="rtl433-container">
	<div class="console-background"></div>
	<div class="grid-overlay"></div>

	<!-- Header -->
	<header class="rtl433-header">
		<div class="header-content">
			<button class="back-button" on:click={goBack}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
				</svg>
				Back
			</button>

			<div class="title-section">
				<h1 class="page-title">
					<span style="color: #f97316;">RTL_433</span>
					<span style="color: var(--text-primary);">Signal Decoder</span>
				</h1>
				<p class="page-subtitle">Decode radio transmissions from various devices</p>
			</div>

			<div class="status-section">
				<div
					class="status-indicator"
					style="background-color: {getStatusColor(rtl433Status)}"
				></div>
				<span class="status-text">{getStatusText(rtl433Status)}</span>
			</div>
		</div>
	</header>

	<!-- Control Panel -->
	<div class="control-panel">
		<div class="control-grid">
			<!-- Configuration -->
			<div class="control-card">
				<div class="control-header">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
						/>
					</svg>
					<span>Configuration</span>
				</div>
				<div class="control-content">
					<div class="form-group">
						<label>Frequency (MHz):</label>
						<div class="frequency-buttons">
							<button
								class="freq-btn"
								class:active={selectedFrequency === '315'}
								on:click={() => setFrequency('315')}
								disabled={rtl433Status === 'running'}
							>
								315 MHz
								<span class="freq-label">Americas</span>
							</button>
							<button
								class="freq-btn"
								class:active={selectedFrequency === '433.92'}
								on:click={() => setFrequency('433.92')}
								disabled={rtl433Status === 'running'}
							>
								433.92 MHz
								<span class="freq-label">Global ISM</span>
							</button>
							<button
								class="freq-btn"
								class:active={selectedFrequency === '868'}
								on:click={() => setFrequency('868')}
								disabled={rtl433Status === 'running'}
							>
								868 MHz
								<span class="freq-label">Europe SRD</span>
							</button>
							<button
								class="freq-btn"
								class:active={selectedFrequency === '915'}
								on:click={() => setFrequency('915')}
								disabled={rtl433Status === 'running'}
							>
								915 MHz
								<span class="freq-label">Americas ISM</span>
							</button>
						</div>
					</div>
					<div class="form-group">
						<label for="sampleRate">Sample Rate:</label>
						<select
							id="sampleRate"
							bind:value={selectedSampleRate}
							on:change={updateSampleRate}
							disabled={rtl433Status === 'running'}
						>
							<option value="250000">250k</option>
							<option value="1024000">1024k</option>
							<option value="2048000">2048k</option>
						</select>
					</div>
					<div class="form-group">
						<label for="format">Output Format:</label>
						<select
							id="format"
							bind:value={selectedFormat}
							on:change={updateFormat}
							disabled={rtl433Status === 'running'}
						>
							<option value="json">JSON</option>
							<option value="csv">CSV</option>
							<option value="kv">Key-Value</option>
						</select>
					</div>
				</div>
			</div>

			<!-- Control Actions -->
			<div class="control-card">
				<div class="control-header">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,12L11,7.5V16.5Z"
						/>
					</svg>
					<span>Control</span>
				</div>
				<div class="control-content">
					<button
						class="control-button primary"
						on:click={toggleRTL433}
						disabled={rtl433Status === 'starting' || rtl433Status === 'stopping'}
					>
						{rtl433Status === 'running'
							? showConsole
								? 'Stop RTL_433'
								: 'Start Monitoring'
							: 'Start RTL_433'}
					</button>
					<button
						class="control-button secondary"
						on:click={clearSignals}
						disabled={rtl433Status === 'running'}
					>
						Clear Signals
					</button>
					<button class="control-button secondary" on:click={clearConsole}>
						Clear Console
					</button>
				</div>
			</div>

			<!-- Statistics -->
			<div class="control-card">
				<div class="control-header">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path d="M22,21H2V3H4V19H6V17H10V19H12V16H16V19H18V17H22V21Z" />
					</svg>
					<span>Statistics</span>
				</div>
				<div class="control-content">
					<div class="stat-item">
						<span class="stat-label">Signals Captured:</span>
						<span class="stat-value">{totalSignals}</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">Frequency:</span>
						<span class="stat-value">{selectedFrequency} MHz</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">Sample Rate:</span>
						<span class="stat-value">{selectedSampleRate} Hz</span>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="main-content">
		<div class="content-grid">
			<!-- Console Output -->
			<div class="content-panel">
				<div class="panel-header">
					<h3>Console Output</h3>
					<button
						class="toggle-button"
						on:click={() => rtl433Store.setShowConsole(!showConsole)}
					>
						{showConsole ? 'Hide' : 'Show'} Console
					</button>
				</div>
				{#if showConsole}
					<div class="console-container">
						<div class="console-content">
							{#each consoleOutput as line}
								<div class="console-line">{line}</div>
							{/each}
							{#if consoleOutput.length === 0}
								<div class="console-empty">
									No console output yet. Start RTL_433 to see output.
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Captured Signals -->
			<div class="content-panel">
				<div class="panel-header">
					<h3>Captured Signals ({totalSignals})</h3>
				</div>
				<div class="signals-container">
					{#if capturedSignals.length === 0}
						<div class="empty-state">
							<p>No signals captured yet.</p>
							<p>Start RTL_433 to begin capturing signals.</p>
						</div>
					{:else}
						{#each capturedSignals as signal}
							<div class="signal-card">
								<div class="signal-header">
									<div class="signal-time">{formatSignalTime(signal.time)}</div>
									<div class="signal-type">
										{signal.model || 'Unknown Device'}
									</div>
								</div>
								<div class="signal-data">
									<pre>{formatSignalData(signal)}</pre>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.rtl433-container {
		position: relative;
		min-height: 100vh;
		background: #0e1116;
		color: #e8eaed;
		font-family:
			'Inter',
			-apple-system,
			sans-serif;
		overflow-x: hidden;
	}

	.console-background {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background:
			radial-gradient(circle at 20% 80%, rgba(251, 146, 60, 0.1) 0%, transparent 50%),
			radial-gradient(circle at 80% 20%, rgba(251, 146, 60, 0.1) 0%, transparent 50%),
			radial-gradient(circle at 40% 40%, rgba(251, 146, 60, 0.05) 0%, transparent 50%);
		z-index: -2;
	}

	.grid-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-image:
			linear-gradient(rgba(251, 146, 60, 0.1) 1px, transparent 1px),
			linear-gradient(90deg, rgba(251, 146, 60, 0.1) 1px, transparent 1px);
		background-size: 20px 20px;
		z-index: -1;
		animation: grid-move 20s linear infinite;
	}

	@keyframes grid-move {
		0% {
			transform: translate(0, 0);
		}
		100% {
			transform: translate(20px, 20px);
		}
	}

	.rtl433-header {
		background: linear-gradient(135deg, #1a1d23 0%, #0e1116 100%);
		border-bottom: 1px solid #2c2f36;
		padding: 1rem;
		backdrop-filter: blur(10px);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 1400px;
		margin: 0 auto;
	}

	.back-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(251, 146, 60, 0.1);
		border: 1px solid rgba(251, 146, 60, 0.3);
		color: #f97316;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.back-button:hover {
		background: rgba(251, 146, 60, 0.2);
		border-color: rgba(251, 146, 60, 0.5);
	}

	.title-section {
		text-align: center;
		flex: 1;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
		text-shadow: 0 0 20px rgba(251, 146, 60, 0.3);
	}

	.page-subtitle {
		font-size: 0.875rem;
		color: #9ca3af;
		margin: 0.25rem 0 0 0;
	}

	.status-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-indicator {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		box-shadow: 0 0 10px currentColor;
		transition: all 0.3s ease;
	}

	.status-text {
		font-size: 0.875rem;
		font-weight: 500;
		color: #e5e7eb;
	}

	.control-panel {
		background: linear-gradient(135deg, #1a1d23 0%, #0e1116 100%);
		border-bottom: 1px solid #2c2f36;
		padding: 1rem;
	}

	.control-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.control-card {
		background: linear-gradient(135deg, #25282f 0%, #1a1d23 100%);
		border: 1px solid #35383f;
		border-radius: 0.5rem;
		padding: 1rem;
		transition: all 0.3s ease;
	}

	.control-card:hover {
		background: linear-gradient(135deg, #333 0%, #222 100%);
		border-color: #3e4149;
	}

	.control-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #f97316;
		margin-bottom: 0.75rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(251, 146, 60, 0.2);
	}

	.control-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.form-group label {
		font-size: 0.75rem;
		font-weight: 500;
		color: #d1d5db;
	}

	.form-group input,
	.form-group select {
		background: #1a1d23;
		border: 1px solid #35383f;
		border-radius: 0.375rem;
		padding: 0.5rem;
		color: #fff;
		font-size: 0.875rem;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: #f97316;
		box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.2);
	}

	.control-button {
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		border: 1px solid;
	}

	.control-button.primary {
		background: linear-gradient(135deg, #f97316 0%, #f97316 100%);
		border-color: #f97316;
		color: #fff;
	}

	.control-button.primary:hover {
		background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
	}

	.control-button.secondary {
		background: transparent;
		border-color: #35383f;
		color: #d1d5db;
	}

	.control-button.secondary:hover {
		background: #25282f;
		border-color: #3e4149;
	}

	.control-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.stat-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
	}

	.stat-label {
		color: #9ca3af;
	}

	.stat-value {
		color: #f97316;
		font-weight: 600;
	}

	.main-content {
		padding: 1rem;
	}

	.content-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.content-panel {
		background: linear-gradient(135deg, #1a1d23 0%, #0e1116 100%);
		border: 1px solid #2c2f36;
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		background: linear-gradient(135deg, #25282f 0%, #1a1d23 100%);
		border-bottom: 1px solid #2c2f36;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #f97316;
	}

	.toggle-button {
		background: transparent;
		border: 1px solid #35383f;
		color: #d1d5db;
		padding: 0.25rem 0.75rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.toggle-button:hover {
		background: #25282f;
		border-color: #3e4149;
	}

	.console-container {
		height: 400px;
		overflow-y: auto;
		background: #000;
	}

	.console-content {
		padding: 1rem;
		font-family: 'JetBrains Mono', 'Consolas', monospace;
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.console-line {
		color: #4ade80;
		margin-bottom: 0.25rem;
		word-wrap: break-word;
	}

	.console-empty {
		color: #6b7280;
		text-align: center;
		padding: 2rem;
		font-style: italic;
	}

	.signals-container {
		max-height: 600px;
		overflow-y: auto;
		padding: 1rem;
	}

	.empty-state {
		text-align: center;
		padding: 2rem;
		color: #6b7280;
	}

	.signal-card {
		background: linear-gradient(135deg, #25282f 0%, #1a1d23 100%);
		border: 1px solid #35383f;
		border-radius: 0.375rem;
		margin-bottom: 1rem;
		overflow: hidden;
	}

	.signal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: linear-gradient(135deg, #333 0%, #222 100%);
		border-bottom: 1px solid #35383f;
	}

	.signal-time {
		font-family: 'JetBrains Mono', 'Consolas', monospace;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.signal-type {
		font-size: 0.875rem;
		font-weight: 500;
		color: #f97316;
	}

	.signal-data {
		padding: 1rem;
	}

	.signal-data pre {
		margin: 0;
		font-family: 'JetBrains Mono', 'Consolas', monospace;
		font-size: 0.75rem;
		color: #d1d5db;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.frequency-buttons {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.freq-btn {
		background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
		border: 1px solid #4b5563;
		border-radius: 0.5rem;
		padding: 0.75rem;
		color: #d1d5db;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.freq-btn:hover {
		background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
		border-color: #6b7280;
		transform: translateY(-1px);
	}

	.freq-btn.active {
		background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
		border-color: #ef4444;
		color: #fff;
		box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
	}

	.freq-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.freq-btn:disabled:hover {
		background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
		border-color: #4b5563;
		transform: none;
	}

	.freq-label {
		font-size: 0.75rem;
		opacity: 0.8;
		font-weight: 400;
	}

	@media (max-width: 768px) {
		.content-grid {
			grid-template-columns: 1fr;
		}

		.control-grid {
			grid-template-columns: 1fr;
		}

		.header-content {
			flex-direction: column;
			gap: 1rem;
		}

		.frequency-buttons {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
