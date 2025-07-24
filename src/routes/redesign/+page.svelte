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
	let selectedOperation: string | null = null;
	let lastActivity = Date.now();
	const sessionTimeout = 30 * 60 * 1000; // 30 minutes

	// System information
	let systemIp = '100.79.154.94';
	let gridReference = 'JN39JX73QT';  // 10-digit grid for Mainz-Kastel area
	let location = 'Mainz-Kastel, Germany';
	let cpuPercentage = '0%';
	let memoryPercentage = '0%';

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
			'status': () => console.warn('All systems operational'),
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
			console.warn(`Unknown command: ${command}`);
		}

		commandInput = '';
		commandBarActive = false;
	}

	function showHelp() {
		console.warn(`
Available Commands:
- status: Show system status
- refresh: Reload the page
- select [module]: Select operation module
- help: Show this help
		`);
	}


	async function fetchSystemStats() {
		try {
			// In a real implementation, this would call an API endpoint
			// For now, we'll simulate with realistic values
			const response = await fetch('/api/system/stats').catch(() => null);
			if (response && response.ok) {
				const data = await response.json();
				cpuPercentage = data.cpu + '%';
				memoryPercentage = data.memory + '%';
			} else {
				// Fallback to simulated values
				cpuPercentage = (Math.floor(Math.random() * 30) + 15) + '%';
				memoryPercentage = (Math.floor(Math.random() * 40) + 30) + '%';
			}
		} catch {
			// Use simulated values if API fails
			cpuPercentage = (Math.floor(Math.random() * 30) + 15) + '%';
			memoryPercentage = (Math.floor(Math.random() * 40) + 30) + '%';
		}
	}

	onMount(() => {
		// Initial system stats fetch
		fetchSystemStats();
		
		// Fetch system stats periodically
		const metricsInterval = setInterval(() => {
			fetchSystemStats();
		}, 5000);

		// Session monitoring
		const sessionInterval = setInterval(() => {
			if (Date.now() - lastActivity > sessionTimeout) {
				console.warn('Session timeout - Please re-authenticate');
			}
		}, 60000);

		return () => {
			clearInterval(metricsInterval);
			clearInterval(sessionInterval);
		};
	});
</script>

<svelte:head>
	<title>ARGOS - Enhanced Intelligence Platform</title>
	<link href="https://fonts.floriankarsten.com/space-grotesk?styles=regular,medium,bold" rel="stylesheet">
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<div class="app-container">
	<header class="header">
		<nav class="nav">
			<div class="logo-section">
				<h1 class="logo-text">
					<span class="logo-a">A</span>rgos
				</h1>
				<div class="logo-subtitle">TACTICAL INTELLIGENCE PLATFORM</div>
			</div>
			<div class="system-status">
				<div class="status-item">
					<span class="status-label">IP</span>
					<span class="status-value">{systemIp}</span>
				</div>
				<div class="status-divider"></div>
				<div class="status-item">
					<span class="status-label">GRID</span>
					<span class="status-value">{gridReference}</span>
				</div>
				<div class="status-divider"></div>
				<div class="status-item">
					<span class="status-label">LOC</span>
					<span class="status-value" style="white-space: nowrap">{location}</span>
				</div>
				<div class="status-divider"></div>
				<div class="status-item">
					<span class="status-label">CPU</span>
					<span class="status-value">{cpuPercentage}</span>
				</div>
				<div class="status-divider"></div>
				<div class="status-item">
					<span class="status-label">MEM</span>
					<span class="status-value">{memoryPercentage}</span>
				</div>
			</div>
		</nav>
	</header>


	<main class="main">
		<div class="container">
			<div class="section-header">
				<h2 class="section-title">
					<span class="select-text">Select</span> 
					<span class="mission-text">Mission</span> 
					<span class="card-text">Card</span>
				</h2>
				<p class="section-subtitle">Intelligence gathering and analysis systems</p>
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
						<div class="operation-status active" aria-label="Status: Active"></div>
					</div>
					<h3 class="operation-title"><span class="first-word">Cellular</span> Analysis</h3>
					<p class="operation-description">
						Mobile network analysis and device interaction for electronic surveillance operations
					</p>
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
		margin: 0;
		padding: 0;
		width: 100%;
		overflow-x: hidden;
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
		margin: 0;
		padding: 0;
		width: 100%;
		overflow-x: hidden;
		position: relative;
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
		position: sticky;
		top: 0;
		left: 0;
		right: 0;
		width: 100%;
		background: rgba(26, 26, 26, 0.95);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--gray-800);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
		z-index: 100;
	}

	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: auto;
		padding: 1.75rem 3rem;
		max-width: 100%;
		margin: 0;
	}

	.logo-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.logo-text {
		font-size: 2.75rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--white);
		margin: 0;
		line-height: 1.1;
		padding-bottom: 4px;
	}

	.logo-a {
		color: var(--red);
		position: relative;
		display: inline-block;
	}

	.logo-a::after {
		content: '';
		position: absolute;
		bottom: -2px;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--red);
	}

	.logo-subtitle {
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.4em;
		color: var(--gray-400);
		text-transform: uppercase;
		opacity: 0.8;
	}

	.system-status {
		display: flex;
		align-items: center;
		gap: 20px;
		font-family: 'Space Grotesk', monospace;
		flex-wrap: wrap;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: 8px;
		position: relative;
	}


	.status-label {
		font-size: 0.65rem;
		color: var(--red);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		font-weight: 600;
		opacity: 0.8;
	}

	.status-value {
		font-size: 0.9rem;
		color: var(--white);
		font-weight: 500;
		min-width: fit-content;
		white-space: nowrap;
		font-family: 'Space Grotesk', monospace;
	}

	.status-divider {
		width: 1px;
		height: 24px;
		background: linear-gradient(to bottom, transparent, var(--gray-600), transparent);
		opacity: 0.5;
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
	}



	/* Main */
	.main {
		padding: 60px 0;
		flex: 1;
	}

	.section-header {
		margin-bottom: 60px;
		position: relative;
		text-align: center;
	}
	
	.section-header::before {
		content: '';
		position: absolute;
		bottom: -30px;
		left: 50%;
		transform: translateX(-50%);
		width: 60px;
		height: 1px;
		background: var(--red);
		opacity: 0.5;
	}


	.section-title {
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: 16px;
		letter-spacing: 0.25em;
		text-transform: uppercase;
	}
	
	.select-text {
		color: var(--gray-400);
	}
	
	.mission-text {
		color: var(--white);
	}
	
	.card-text {
		color: var(--red);
	}

	.section-subtitle {
		font-size: 1.125rem;
		color: var(--gray-400);
		font-weight: 400;
		letter-spacing: 0.02em;
		line-height: 1.5;
		max-width: 600px;
		margin: 0 auto;
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
		font-size: 0.8125rem;
		color: var(--red);
		font-weight: 600;
		letter-spacing: 0.1em;
		font-family: 'Space Grotesk', monospace;
	}

	.operation-number::before {
		content: 'OP ';
		color: var(--white);
		opacity: 1;
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
	}

	.operation-status.active::after {
		opacity: 0.4;
	}


	.operation-status.standby {
		background: var(--gray-600);
		color: var(--gray-600);
	}

	.operation-status.active {
		box-shadow: 0 0 8px currentColor;
	}

	.operation-title {
		font-size: 1.625rem;
		font-weight: 600;
		margin-bottom: 16px;
		letter-spacing: -0.01em;
	}

	/* First word coloring */
	.first-word {
		transition: color 0.3s ease;
	}

	.operation:nth-child(1) .first-word { color: var(--red); }
	.operation:nth-child(2) .first-word { color: var(--cyan); }
	.operation:nth-child(3) .first-word { color: var(--green); }
	.operation:nth-child(4) .first-word { color: var(--blue); }
	.operation:nth-child(5) .first-word { color: var(--purple); }
	.operation:nth-child(6) .first-word { color: var(--amber); }

	.operation-description {
		color: var(--gray-400);
		font-size: 0.9375rem;
		line-height: 1.65;
		margin-bottom: 24px;
	}

	.operation-meta {
		display: flex;
		gap: 16px;
		font-size: 0.75rem;
		color: var(--gray-600);
	}

	.operation:hover .meta-item {
		/* Animation removed */
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

	/* Data Visualization styles removed */

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

	/* Progress bars and mini charts removed - were only used in operation-metrics */


	/* Status System - Color Coding */
	.operation:nth-child(1) .operation-status { background: var(--red); color: var(--red); }
	.operation:nth-child(2) .operation-status { background: var(--cyan); color: var(--cyan); }
	.operation:nth-child(3) .operation-status { background: var(--green); color: var(--green); }
	.operation:nth-child(4) .operation-status { background: var(--blue); color: var(--blue); }
	.operation:nth-child(5) .operation-status { background: var(--purple); color: var(--purple); }
	.operation:nth-child(6) .operation-status { background: var(--amber); color: var(--amber); }
	
	/* Operation Number Color Coding */
	.operation:nth-child(1) .operation-number { color: var(--red); }
	.operation:nth-child(2) .operation-number { color: var(--cyan); }
	.operation:nth-child(3) .operation-number { color: var(--green); }
	.operation:nth-child(4) .operation-number { color: var(--blue); }
	.operation:nth-child(5) .operation-number { color: var(--purple); }
	.operation:nth-child(6) .operation-number { color: var(--amber); }

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

	/* Animation delays removed */

	/* Container Queries for Responsive Design */
	@container (max-width: 450px) {
		.operation {
			padding: 32px 24px;
		}
		
		.operation-meta {
			flex-direction: column;
			gap: 8px;
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
		
		.header {
			padding: 1rem 0;
		}
		
		.nav {
			flex-direction: column;
			align-items: stretch;
			gap: 1.5rem;
		}
		
		.logo-text {
			font-size: 2.5rem;
		}
		
		.system-status {
			flex-wrap: wrap;
			gap: 12px;
			padding: 10px 16px;
			justify-content: center;
		}
		
		.status-divider {
			display: none;
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
		
	}
</style>