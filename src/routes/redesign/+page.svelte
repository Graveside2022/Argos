<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Operation navigation functions
	function navigateToCellular() {
		void goto('/gsm-evil');
	}

	function navigateToDataBroadcasting() {
		void goto('/tactical-map-simple');
	}

	function navigateToGeospatialMapping() {
		void goto('/fusion');
	}

	function navigateToNetworkDiscovery() {
		void goto('/kismet');
	}

	function navigateToSignalVisualization() {
		void goto('/viewspectrum');
	}

	function navigateToSpectrumAnalysis() {
		void goto('/hackrf');
	}

	// Security and interaction management
	let commandBarActive = false;
	let commandInput = '';
	let performanceMonitorVisible = false;
	let selectedOperation: string | null = null;
	let lastActivity = Date.now();
	const sessionTimeout = 30 * 60 * 1000; // 30 minutes

	// Performance metrics
	let cpuUsage = '23%';
	let memUsage = '1.2GB';
	let netUsage = '847KB/s';
	let uptime = '72h 14m';
	let startTime = Date.now();

	// Operation click handlers
	const operationHandlers: Record<string, () => void> = {
		cellular: navigateToCellular,
		data: navigateToDataBroadcasting,
		geo: navigateToGeospatialMapping,
		network: navigateToNetworkDiscovery,
		signal: navigateToSignalVisualization,
		spectrum: navigateToSpectrumAnalysis
	};

	function handleOperationClick(operation: string) {
		selectedOperation = operation;
		const handler = operationHandlers[operation];
		if (handler) {
			handler();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		lastActivity = Date.now();

		// Ctrl+K for command bar
		if (event.ctrlKey && event.key === 'k') {
			event.preventDefault();
			toggleCommandBar();
		}

		// Escape to close command bar
		if (event.key === 'Escape') {
			commandBarActive = false;
		}

		// Ctrl+Shift+P for performance monitor
		if (event.ctrlKey && event.shiftKey && event.key === 'P') {
			event.preventDefault();
			performanceMonitorVisible = !performanceMonitorVisible;
		}
	}

	function toggleCommandBar() {
		commandBarActive = !commandBarActive;
		if (commandBarActive) {
			setTimeout(() => {
				const input = document.getElementById('commandInput') as HTMLInputElement;
				input?.focus();
			}, 100);
		}
	}

	function executeCommand() {
		const command = commandInput.toLowerCase().trim();
		
		const commands: Record<string, () => void> = {
			'status': () => console.log('All systems operational'),
			'refresh': () => location.reload(),
			'select cellular': () => handleOperationClick('cellular'),
			'select data': () => handleOperationClick('data'),
			'select geo': () => handleOperationClick('geo'),
			'select network': () => handleOperationClick('network'),
			'select signal': () => handleOperationClick('signal'),
			'select spectrum': () => handleOperationClick('spectrum'),
			'help': () => showHelp()
		};

		if (commands[command]) {
			commands[command]();
		} else {
			console.log(`Unknown command: ${command}`);
		}

		commandInput = '';
		commandBarActive = false;
	}

	function showHelp() {
		console.log(`
Available Commands:
- status: Show system status
- refresh: Reload the page
- select [module]: Select operation module
- help: Show this help
		`);
	}

	function formatUptime(ms: number): string {
		const hours = Math.floor(ms / (1000 * 60 * 60));
		const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
		return `${hours}h ${minutes}m`;
	}

	onMount(() => {
		// Update performance metrics
		const metricsInterval = setInterval(() => {
			const cpu = Math.floor(Math.random() * 30) + 15;
			const mem = (Math.random() * 0.5 + 1.0).toFixed(1);
			const net = Math.floor(Math.random() * 200) + 700;
			
			cpuUsage = cpu + '%';
			memUsage = mem + 'GB';
			netUsage = net + 'KB/s';
			uptime = formatUptime(Date.now() - startTime);
		}, 2000);

		// Show performance monitor after delay
		setTimeout(() => {
			performanceMonitorVisible = true;
		}, 1000);

		// Session monitoring
		const sessionInterval = setInterval(() => {
			if (Date.now() - lastActivity > sessionTimeout) {
				console.log('Session timeout - Please re-authenticate');
			}
		}, 60000);

		// Update progress bars
		const progressInterval = setInterval(() => {
			const progressBars = document.querySelectorAll('.progress-fill');
			progressBars.forEach(bar => {
				if (bar instanceof HTMLElement) {
					const currentWidth = parseInt(bar.style.width);
					const variation = (Math.random() - 0.5) * 4;
					const newWidth = Math.max(10, Math.min(100, currentWidth + variation));
					bar.style.width = newWidth + '%';
				}
			});
		}, 3000);

		return () => {
			clearInterval(metricsInterval);
			clearInterval(sessionInterval);
			clearInterval(progressInterval);
		};
	});
</script>

<svelte:head>
	<title>ARGOS - Enhanced Intelligence Platform</title>
	<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<div class="app-container">
	<header class="header">
		<div class="container">
			<nav class="nav">
				<div class="logo">
					<div class="logo-text">ARGOS</div>
				</div>
				<div class="live-indicator">
					<span class="screen-reader-only">System status: </span>
					Live
				</div>
			</nav>
		</div>
	</header>

	<!-- Performance Monitor -->
	<div class="performance-monitor" class:visible={performanceMonitorVisible} id="performanceMonitor">
		<div class="perf-metric">
			<span>CPU</span>
			<span class="perf-value">{cpuUsage}</span>
		</div>
		<div class="perf-metric">
			<span>Memory</span>
			<span class="perf-value">{memUsage}</span>
		</div>
		<div class="perf-metric">
			<span>Network</span>
			<span class="perf-value">{netUsage}</span>
		</div>
		<div class="perf-metric">
			<span>Uptime</span>
			<span class="perf-value">{uptime}</span>
		</div>
	</div>

	<main class="main">
		<div class="container">
			<div class="section-header">
				<h2 class="section-title">Operational Modules</h2>
				<p class="section-subtitle">Select an operational module to begin intelligence gathering and analysis</p>
			</div>

			<div class="operations" role="grid" aria-label="Operational modules">
				<!-- Cellular Analysis -->
				<button 
					class="operation" 
					on:click={() => handleOperationClick('cellular')}
					aria-selected={selectedOperation === 'cellular'}
					data-operation="cellular"
				>
					<div class="operation-header">
						<div class="operation-number">001</div>
						<div class="operation-status standby" aria-label="Status: Standby"></div>
					</div>
					<h3 class="operation-title"><span class="first-word">Cellular</span> Analysis</h3>
					<p class="operation-description">
						Mobile network analysis and device interaction for electronic surveillance operations
					</p>
					<div class="operation-meta">
						<div class="meta-item">
							<div class="meta-label">Bands</div>
							<div class="meta-value">GSM/LTE</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Status</div>
							<div class="meta-value">Standby</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Cells</div>
							<div class="meta-value">23 <span class="metric-trend trend-up"><div class="trend-arrow"></div></span></div>
						</div>
					</div>
					<div class="operation-metrics">
						<div class="metrics-row">
							<div class="metric-label">System Ready</div>
							<div class="metric-value">100%</div>
						</div>
						<div class="progress-bar">
							<div class="progress-fill" style="width: 100%"></div>
						</div>
						<div class="mini-chart">
							<div class="sparkline"></div>
						</div>
					</div>
					<div class="operation-details">
						<div class="detail-grid">
							<div class="detail-item">
								IMSI Count
								<div class="detail-value">127</div>
							</div>
							<div class="detail-item">
								Last Active
								<div class="detail-value">2h 14m</div>
							</div>
							<div class="detail-item">
								Frequency
								<div class="detail-value">900MHz</div>
							</div>
						</div>
					</div>
				</button>

				<!-- Data Broadcasting -->
				<button 
					class="operation" 
					on:click={() => handleOperationClick('data')}
					aria-selected={selectedOperation === 'data'}
					data-operation="data"
				>
					<div class="operation-header">
						<div class="operation-number">002</div>
						<div class="operation-status active" aria-label="Status: Active"></div>
					</div>
					<h3 class="operation-title"><span class="first-word">Data</span> Broadcasting</h3>
					<p class="operation-description">
						Tactical data distribution and Common Operating Picture integration platform
					</p>
					<div class="operation-meta">
						<div class="meta-item">
							<div class="meta-label">Nodes</div>
							<div class="meta-value">12</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Status</div>
							<div class="meta-value">Connected</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Latency</div>
							<div class="meta-value">18ms <span class="metric-trend trend-down"><div class="trend-arrow"></div></span></div>
						</div>
					</div>
					<div class="operation-metrics">
						<div class="metrics-row">
							<div class="metric-label">Network Health</div>
							<div class="metric-value">98.7%</div>
						</div>
						<div class="progress-bar">
							<div class="progress-fill" style="width: 98%"></div>
						</div>
						<div class="mini-chart">
							<div class="sparkline" style="clip-path: polygon(0% 100%, 15% 70%, 30% 85%, 45% 60%, 60% 75%, 75% 50%, 90% 40%, 100% 35%, 100% 100%);"></div>
						</div>
					</div>
					<div class="operation-details">
						<div class="detail-grid">
							<div class="detail-item">
								Throughput
								<div class="detail-value">847 Kbps</div>
							</div>
							<div class="detail-item">
								Packets
								<div class="detail-value">12.4K/s</div>
							</div>
							<div class="detail-item">
								Sync
								<div class="detail-value">99.1%</div>
							</div>
						</div>
					</div>
				</button>

				<!-- Geospatial Mapping -->
				<button 
					class="operation" 
					on:click={() => handleOperationClick('geo')}
					aria-selected={selectedOperation === 'geo'}
					data-operation="geo"
				>
					<div class="operation-header">
						<div class="operation-number">003</div>
						<div class="operation-status active" aria-label="Status: Active"></div>
					</div>
					<h3 class="operation-title"><span class="first-word">Geospatial</span> Mapping</h3>
					<p class="operation-description">
						Signal source visualization with integrated mapping and tactical overlay systems
					</p>
					<div class="operation-meta">
						<div class="meta-item">
							<div class="meta-label">Coverage</div>
							<div class="meta-value">15km²</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Status</div>
							<div class="meta-value">Ready</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Markers</div>
							<div class="meta-value">89 <span class="metric-trend trend-up"><div class="trend-arrow"></div></span></div>
						</div>
					</div>
					<div class="operation-metrics">
						<div class="metrics-row">
							<div class="metric-label">Data Quality</div>
							<div class="metric-value">94.2%</div>
						</div>
						<div class="progress-bar">
							<div class="progress-fill" style="width: 94%"></div>
						</div>
						<div class="mini-chart">
							<div class="sparkline" style="clip-path: polygon(0% 100%, 12% 80%, 25% 75%, 38% 90%, 50% 65%, 63% 70%, 75% 45%, 88% 55%, 100% 30%, 100% 100%);"></div>
						</div>
					</div>
					<div class="operation-details">
						<div class="detail-grid">
							<div class="detail-item">
								Zoom Level
								<div class="detail-value">15x</div>
							</div>
							<div class="detail-item">
								Layers
								<div class="detail-value">12</div>
							</div>
							<div class="detail-item">
								Refresh
								<div class="detail-value">2.3s</div>
							</div>
						</div>
					</div>
				</button>

				<!-- Network Discovery -->
				<button 
					class="operation" 
					on:click={() => handleOperationClick('network')}
					aria-selected={selectedOperation === 'network'}
					data-operation="network"
				>
					<div class="operation-header">
						<div class="operation-number">004</div>
						<div class="operation-status active" aria-label="Status: Active"></div>
					</div>
					<h3 class="operation-title"><span class="first-word">Network</span> Discovery</h3>
					<p class="operation-description">
						Wireless network enumeration and device tracking with real-time monitoring capabilities
					</p>
					<div class="operation-meta">
						<div class="meta-item">
							<div class="meta-label">Protocol</div>
							<div class="meta-value">802.11/BLE</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Status</div>
							<div class="meta-value">Active</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Targets</div>
							<div class="meta-value">247 <span class="metric-trend trend-up"><div class="trend-arrow"></div></span></div>
						</div>
					</div>
					<div class="operation-metrics">
						<div class="metrics-row">
							<div class="metric-label">Signal Strength</div>
							<div class="metric-value">-42 dBm</div>
						</div>
						<div class="progress-bar">
							<div class="progress-fill" style="width: 78%"></div>
						</div>
						<div class="mini-chart">
							<div class="sparkline" style="clip-path: polygon(0% 100%, 14% 65%, 28% 80%, 42% 55%, 56% 70%, 70% 45%, 84% 60%, 100% 40%, 100% 100%);"></div>
						</div>
					</div>
					<div class="operation-details">
						<div class="detail-grid">
							<div class="detail-item">
								Uptime
								<div class="detail-value">72h 14m</div>
							</div>
							<div class="detail-item">
								Last Scan
								<div class="detail-value">00:23</div>
							</div>
							<div class="detail-item">
								Coverage
								<div class="detail-value">2.4km²</div>
							</div>
						</div>
					</div>
				</button>

				<!-- Signal Visualization -->
				<button 
					class="operation" 
					on:click={() => handleOperationClick('signal')}
					aria-selected={selectedOperation === 'signal'}
					data-operation="signal"
				>
					<div class="operation-header">
						<div class="operation-number">005</div>
						<div class="operation-status active" aria-label="Status: Active"></div>
					</div>
					<h3 class="operation-title"><span class="first-word">Signal</span> Visualization</h3>
					<p class="operation-description">
						Real-time spectrum waterfall analysis with advanced signal processing capabilities
					</p>
					<div class="operation-meta">
						<div class="meta-item">
							<div class="meta-label">Resolution</div>
							<div class="meta-value">2048 FFT</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Status</div>
							<div class="meta-value">Online</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Bandwidth</div>
							<div class="meta-value">2.4MHz <span class="metric-trend trend-up"><div class="trend-arrow"></div></span></div>
						</div>
					</div>
					<div class="operation-metrics">
						<div class="metrics-row">
							<div class="metric-label">Processing Load</div>
							<div class="metric-value">23%</div>
						</div>
						<div class="progress-bar">
							<div class="progress-fill" style="width: 23%"></div>
						</div>
						<div class="mini-chart">
							<div class="sparkline" style="clip-path: polygon(0% 100%, 16% 85%, 32% 70%, 48% 90%, 64% 60%, 80% 75%, 96% 50%, 100% 45%, 100% 100%);"></div>
						</div>
					</div>
					<div class="operation-details">
						<div class="detail-grid">
							<div class="detail-item">
								Frame Rate
								<div class="detail-value">30 FPS</div>
							</div>
							<div class="detail-item">
								SNR
								<div class="detail-value">23dB</div>
							</div>
							<div class="detail-item">
								Buffer
								<div class="detail-value">4.2MB</div>
							</div>
						</div>
					</div>
				</button>

				<!-- Spectrum Analysis -->
				<button 
					class="operation" 
					on:click={() => handleOperationClick('spectrum')}
					aria-selected={selectedOperation === 'spectrum'}
					data-operation="spectrum"
				>
					<div class="operation-header">
						<div class="operation-number">006</div>
						<div class="operation-status active" aria-label="Status: Active"></div>
					</div>
					<h3 class="operation-title"><span class="first-word">Spectrum</span> Analysis</h3>
					<p class="operation-description">
						Software-defined radio analysis with configurable frequency sweeping and detection
					</p>
					<div class="operation-meta">
						<div class="meta-item">
							<div class="meta-label">Range</div>
							<div class="meta-value">10MHz-6GHz</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Status</div>
							<div class="meta-value">Scanning</div>
						</div>
						<div class="meta-item">
							<div class="meta-label">Signals</div>
							<div class="meta-value">1,423 <span class="metric-trend trend-up"><div class="trend-arrow"></div></span></div>
						</div>
					</div>
					<div class="operation-metrics">
						<div class="metrics-row">
							<div class="metric-label">Sweep Progress</div>
							<div class="metric-value">67%</div>
						</div>
						<div class="progress-bar">
							<div class="progress-fill" style="width: 67%"></div>
						</div>
						<div class="mini-chart">
							<div class="sparkline" style="clip-path: polygon(0% 100%, 18% 75%, 36% 60%, 54% 85%, 72% 50%, 90% 65%, 100% 35%, 100% 100%);"></div>
						</div>
					</div>
					<div class="operation-details">
						<div class="detail-grid">
							<div class="detail-item">
								Bandwidth
								<div class="detail-value">20MHz</div>
							</div>
							<div class="detail-item">
								Gain
								<div class="detail-value">45dB</div>
							</div>
							<div class="detail-item">
								FFT Size
								<div class="detail-value">2048</div>
							</div>
						</div>
					</div>
				</button>
			</div>
		</div>
	</main>

	<!-- Command Bar Interface -->
	<div class="command-bar" class:active={commandBarActive} role="dialog" aria-label="Command interface">
		<span class="command-prompt">></span>
		<input 
			type="text" 
			class="command-input" 
			placeholder="Enter command..." 
			aria-label="Command input" 
			id="commandInput"
			bind:value={commandInput}
			on:keydown={(e) => e.key === 'Enter' && executeCommand()}
		>
		<div class="command-shortcuts">
			<span class="command-shortcut">ESC</span>
			<span class="command-shortcut">ENTER</span>
		</div>
	</div>

	<footer class="footer">
		<div class="container">
			<p class="footer-text">ARGOS Intelligence Platform — Tactical Assets & Analysis</p>
		</div>
	</footer>
</div>

<style>
	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:root {
		--red: #ff2b5a;
		--red-hover: #ff4066;
		--red-muted: rgba(255, 43, 90, 0.1);
		--black: #0a0a0b;
		--gray-900: #111111;
		--gray-800: #1a1a1a;
		--gray-700: #262626;
		--gray-600: #404040;
		--gray-400: #a1a1aa;
		--gray-300: #d4d4d8;
		--white: #ffffff;
		--green: #10b981;
		--blue: #3b82f6;
		--cyan: #06b6d4;
		--purple: #8b5cf6;
		--amber: #f59e0b;
	}

	:global(body) {
		font-family: 'Space Grotesk', sans-serif;
		background: var(--black);
		color: var(--white);
		line-height: 1.5;
		font-weight: 400;
		position: relative;
		container-type: inline-size;
	}

	/* Technical Grid Overlay */
	:global(body)::before {
		content: '';
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-image: 
			linear-gradient(rgba(255, 43, 90, 0.02) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 43, 90, 0.02) 1px, transparent 1px);
		background-size: 60px 60px;
		pointer-events: none;
		z-index: -1;
		opacity: 0.3;
	}

	.app-container {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 24px;
	}

	.screen-reader-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Header */
	.header {
		border-bottom: 1px solid var(--gray-800);
		background: rgba(10, 10, 11, 0.9);
		backdrop-filter: blur(20px);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 80px;
	}

	.logo {
		display: flex;
		align-items: center;
	}

	.logo-text {
		font-size: 1.5rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		position: relative;
	}

	.logo-text::after {
		content: '';
		position: absolute;
		bottom: -2px;
		left: 0;
		width: 12px;
		height: 2px;
		background: var(--red);
	}

	/* Live indicator */
	.live-indicator {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.7rem;
		color: var(--red);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.live-indicator::before {
		content: '';
		width: 4px;
		height: 4px;
		background: var(--red);
		border-radius: 50%;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.5; transform: scale(1.2); }
	}

	/* Performance Monitor */
	.performance-monitor {
		position: fixed;
		top: 20px;
		right: 20px;
		background: rgba(10, 10, 11, 0.95);
		backdrop-filter: blur(20px);
		border: 1px solid var(--gray-800);
		border-radius: 6px;
		padding: 12px;
		font-size: 0.7rem;
		opacity: 0;
		transition: opacity 0.3s ease;
		z-index: 1000;
		min-width: 120px;
	}

	.performance-monitor.visible {
		opacity: 1;
	}

	.perf-metric {
		display: flex;
		justify-content: space-between;
		margin-bottom: 4px;
		color: var(--gray-400);
	}

	.perf-value {
		font-family: 'Space Grotesk', monospace;
		color: var(--red);
		font-weight: 500;
	}

	/* Main */
	.main {
		padding: 60px 0;
		flex: 1;
	}

	.section-header {
		margin-bottom: 40px;
		border-left: 3px solid var(--red);
		padding-left: 20px;
		background: rgba(255, 43, 90, 0.02);
		padding: 20px;
		border-radius: 8px;
		border: 1px solid rgba(255, 43, 90, 0.1);
		position: relative;
	}

	/* Data stream indicator */
	.section-header::after {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 2px;
		background: linear-gradient(90deg, transparent, var(--red), transparent);
		animation: data-flow 4s infinite;
	}

	@keyframes data-flow {
		0% { left: -100%; }
		100% { left: 100%; }
	}

	.section-title {
		font-size: 1.25rem;
		font-weight: 500;
		color: var(--white);
		margin-bottom: 4px;
		letter-spacing: 0.02em;
	}

	.section-subtitle {
		font-size: 0.875rem;
		color: var(--gray-400);
		font-weight: 400;
	}

	/* Operations Grid */
	.operations {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
		gap: 1px;
		background: var(--gray-800);
		border: 1px solid var(--gray-800);
		container-type: inline-size;
	}

	/* Operation Cards */
	.operation {
		--hover-intensity: 0;
		background: var(--black);
		padding: 48px 40px;
		cursor: pointer;
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
		border: 1px solid var(--gray-800);
		container-type: inline-size;
		width: 100%;
		text-align: left;
		font-family: inherit;
		color: inherit;
		animation: fadeInUp 0.6s ease-out;
		animation-fill-mode: backwards;
	}

	.operation::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 1px;
		background: var(--red);
		transform: scaleX(0);
		transition: transform 0.3s ease;
	}

	.operation:focus-visible {
		outline: 2px solid var(--red);
		outline-offset: 2px;
	}

	.operation[aria-selected="true"] {
		background: var(--gray-900);
		border-color: var(--red);
	}

	.operation:hover::before {
		transform: scaleX(1);
	}

	.operation:hover {
		--hover-intensity: 1;
		background: var(--gray-900);
		transform: translateY(-2px) scale(1.01);
		box-shadow: 
			0 8px 25px rgba(255, 43, 90, 0.15),
			0 0 0 1px rgba(255, 43, 90, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.operation-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 24px;
	}

	.operation-number {
		font-size: 0.75rem;
		color: var(--red);
		font-weight: 500;
		letter-spacing: 0.1em;
		font-family: 'Space Grotesk', monospace;
	}

	.operation-number::before {
		content: 'OP-';
		opacity: 0.6;
	}

	/* Status System */
	.operation-status {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		position: relative;
		transition: all 0.3s ease;
	}

	.operation-status::after {
		content: '';
		position: absolute;
		top: -2px;
		left: -2px;
		right: -2px;
		bottom: -2px;
		border-radius: 50%;
		border: 1px solid currentColor;
		opacity: 0;
		animation: status-ping 2s infinite;
	}

	.operation-status.active::after {
		opacity: 0.4;
	}

	@keyframes status-ping {
		0% { transform: scale(1); opacity: 0.4; }
		50% { transform: scale(1.5); opacity: 0.1; }
		100% { transform: scale(1); opacity: 0.4; }
	}

	.operation-status.standby {
		background: var(--gray-600);
		color: var(--gray-600);
	}

	.operation-status.active {
		box-shadow: 0 0 8px currentColor;
	}

	.operation-title {
		font-size: 1.5rem;
		font-weight: 500;
		margin-bottom: 12px;
		letter-spacing: -0.01em;
	}

	/* First word coloring */
	.first-word {
		transition: color 0.3s ease;
	}

	.operation:nth-child(1) .first-word { color: var(--gray-600); }
	.operation:nth-child(2) .first-word { color: var(--cyan); }
	.operation:nth-child(3) .first-word { color: var(--green); }
	.operation:nth-child(4) .first-word { color: var(--blue); }
	.operation:nth-child(5) .first-word { color: var(--purple); }
	.operation:nth-child(6) .first-word { color: var(--amber); }

	.operation-description {
		color: var(--gray-400);
		font-size: 0.875rem;
		line-height: 1.6;
		margin-bottom: 24px;
	}

	.operation-meta {
		display: flex;
		gap: 16px;
		font-size: 0.75rem;
		color: var(--gray-600);
	}

	.operation:hover .meta-item {
		animation: fadeInScale 0.4s ease-out;
		animation-fill-mode: backwards;
	}

	.operation:hover .meta-item:nth-child(2) { animation-delay: 0.1s; }
	.operation:hover .meta-item:nth-child(3) { animation-delay: 0.2s; }

	@keyframes fadeInScale {
		from { opacity: 0.7; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.meta-label {
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.meta-value {
		color: var(--gray-300);
		font-weight: 500;
		font-family: 'Space Grotesk', monospace;
		position: relative;
		transition: all 0.3s ease;
	}

	.operation:hover .meta-value {
		color: var(--white);
		text-shadow: 0 0 8px currentColor;
	}

	/* Data Visualization */
	.operation-metrics {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid var(--gray-800);
	}

	.metrics-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.metric-label {
		font-size: 0.75rem;
		color: var(--gray-600);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.metric-value {
		font-size: 0.75rem;
		color: var(--gray-300);
		font-family: 'Space Grotesk', monospace;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* Trend indicators */
	.metric-trend {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.7rem;
	}

	.trend-arrow {
		width: 0;
		height: 0;
		border-left: 3px solid transparent;
		border-right: 3px solid transparent;
	}

	.trend-up .trend-arrow {
		border-bottom: 4px solid var(--green);
	}

	.trend-down .trend-arrow {
		border-top: 4px solid #ef4444;
	}

	.progress-bar {
		width: 100%;
		height: 2px;
		background: var(--gray-800);
		border-radius: 1px;
		overflow: hidden;
		margin-top: 8px;
		position: relative;
	}

	.progress-fill {
		height: 100%;
		background: var(--red);
		border-radius: 1px;
		transition: width 0.3s ease;
		position: relative;
	}

	.progress-fill::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		animation: shimmer 2s infinite;
	}

	@keyframes shimmer {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}

	/* Mini Charts */
	.mini-chart {
		width: 100%;
		height: 32px;
		margin-top: 8px;
		position: relative;
		background: var(--gray-900);
		border-radius: 4px;
		overflow: hidden;
	}

	.sparkline {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(180deg, 
			rgba(255, 43, 90, 0.3) 0%, 
			rgba(255, 43, 90, 0.1) 50%, 
			transparent 100%);
		clip-path: polygon(
			0% 100%, 
			10% 85%, 
			20% 90%, 
			30% 70%, 
			40% 80%, 
			50% 60%, 
			60% 75%, 
			70% 55%, 
			80% 65%, 
			90% 45%, 
			100% 50%, 
			100% 100%
		);
		animation: sparkline-animate 3s ease-in-out infinite;
	}

	@keyframes sparkline-animate {
		0%, 100% { opacity: 0.8; }
		50% { opacity: 1; }
	}

	/* Interactive Elements - Hidden details */
	.operation-details {
		opacity: 0;
		max-height: 0;
		overflow: hidden;
		transition: all 0.3s ease;
		margin-top: 0;
	}

	.operation:hover .operation-details {
		opacity: 1;
		max-height: 120px;
		margin-top: 16px;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		font-size: 0.7rem;
	}

	.detail-item {
		color: var(--gray-600);
	}

	.detail-value {
		color: var(--gray-400);
		font-family: 'Space Grotesk', monospace;
		margin-top: 2px;
	}

	/* Status System - Color Coding */
	.operation:nth-child(1) .operation-status.standby { background: var(--gray-600); color: var(--gray-600); }
	.operation:nth-child(2) .operation-status.active { background: var(--cyan); color: var(--cyan); }
	.operation:nth-child(3) .operation-status.active { background: var(--green); color: var(--green); }
	.operation:nth-child(4) .operation-status.active { background: var(--blue); color: var(--blue); }
	.operation:nth-child(5) .operation-status.active { background: var(--purple); color: var(--purple); }
	.operation:nth-child(6) .operation-status.active { background: var(--amber); color: var(--amber); }

	/* Command Bar Interface */
	.command-bar {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(10, 10, 11, 0.95);
		backdrop-filter: blur(20px);
		border: 1px solid var(--gray-700);
		border-radius: 8px;
		padding: 12px 20px;
		display: flex;
		align-items: center;
		gap: 16px;
		opacity: 0;
		transform: translateX(-50%) translateY(100%);
		transition: all 0.3s ease;
		z-index: 1000;
		min-width: 400px;
	}

	.command-bar.active {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}

	.command-prompt {
		color: var(--red);
		font-family: 'Space Grotesk', monospace;
		font-size: 0.875rem;
	}

	.command-input {
		background: transparent;
		border: none;
		color: var(--white);
		font-family: 'Space Grotesk', monospace;
		font-size: 0.875rem;
		flex: 1;
		outline: none;
		min-width: 200px;
	}

	.command-input::placeholder {
		color: var(--gray-600);
	}

	.command-shortcuts {
		display: flex;
		gap: 8px;
	}

	.command-shortcut {
		font-size: 0.7rem;
		color: var(--gray-600);
		background: var(--gray-800);
		padding: 2px 6px;
		border-radius: 3px;
		font-family: 'Space Grotesk', monospace;
	}

	/* Footer */
	.footer {
		border-top: 1px solid var(--gray-800);
		padding: 40px 0;
		text-align: center;
		margin-top: 120px;
	}

	.footer-text {
		font-size: 0.875rem;
		color: var(--gray-600);
	}

	/* Animation delays */
	.operation:nth-child(1) { animation-delay: 0.1s; }
	.operation:nth-child(2) { animation-delay: 0.15s; }
	.operation:nth-child(3) { animation-delay: 0.2s; }
	.operation:nth-child(4) { animation-delay: 0.25s; }
	.operation:nth-child(5) { animation-delay: 0.3s; }
	.operation:nth-child(6) { animation-delay: 0.35s; }

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Container Queries for Responsive Design */
	@container (max-width: 450px) {
		.operation {
			padding: 32px 24px;
		}
		
		.operation-meta {
			flex-direction: column;
			gap: 8px;
		}
		
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		:root {
			--red: #ff0040;
			--gray-400: #ffffff;
			--gray-600: #cccccc;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.container {
			padding: 0 16px;
		}
		
		.operations {
			grid-template-columns: 1fr;
		}
		
		.operation {
			padding: 32px 24px;
		}
		
		.command-bar {
			min-width: 320px;
			left: 16px;
			right: 16px;
			transform: none;
		}
		
		.command-bar.active {
			transform: translateY(0);
		}
		
		.performance-monitor {
			position: relative;
			top: auto;
			right: auto;
			margin: 20px auto;
			width: fit-content;
		}
	}
</style>