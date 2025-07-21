<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import PacketAnalysisDashboard from '$lib/components/fusion/packet-analysis/PacketAnalysisDashboard.svelte';
	
	// Tool status types
	type ToolStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
	
	// Dashboard state
	let fusionStatus: ToolStatus = 'stopped';
	let wiresharkStatus: ToolStatus = 'stopped';
	let gnuradioStatus: ToolStatus = 'stopped';
	let kismetStatus: ToolStatus = 'stopped';
	
	// Debug information
	let lastError = '';
	let debugMode = false;
	
	// Network analysis data
	let networkActive = false;
	let packetCount = 0;
	let packetsPerSecond = 0;
	let networkInterface = 'eth0';
	let recentPackets: any[] = [];
	
	// Tab state for different views
	let activeTab = 'overview';
	
	// RF spectrum data
	let rfActive = false;
	let centerFreq = 2.425e9;
	let peakPower = -60;
	let noiseFloor = -95;
	let detectedSignals = 0;
	let spectrumData: any = null;
	let currentDevice: any = null;
	let spectrumFrequencies: number[] = [];
	let spectrumPowers: number[] = [];
	let performanceMetrics = {
		samplesPerSecond: 0,
		cpuUsage: 0,
		memoryUsage: 0
	};
	
	// WiFi discovery data
	let wifiActive = false;
	let totalDevices = 0;
	let accessPoints = 0;
	let clientDevices = 0;
	let securityThreats = 0;
	let wifiDevices: any[] = [];
	
	// Server-Sent Events connections
	let eventSource: EventSource | null = null;
	
	onMount(() => {
		if (browser) {
			checkInitialStatus();
			connectEventStream();
		}
	});
	
	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
		}
	});
	
	async function checkInitialStatus() {
		try {
			// Check individual tool statuses
			const [wiresharkResp, gnuradioResp, kismetResp] = await Promise.all([
				fetch('/api/wireshark/status').then(r => r.json()).catch(() => ({ data: { running: false } })),
				fetch('/api/gnuradio/status').then(r => r.json()).catch(() => ({ data: { running: false } })),
				fetch('/api/kismet/status').then(r => r.json()).catch(() => ({ data: { running: false } }))
			]);
			
			// Set individual tool statuses
			wiresharkStatus = wiresharkResp.data?.running ? 'running' : 'stopped';
			gnuradioStatus = gnuradioResp.data?.running ? 'running' : 'stopped';
			kismetStatus = kismetResp.data?.running ? 'running' : 'stopped';
			
			console.log('Initial status check:', { wiresharkStatus, gnuradioStatus, kismetStatus });
			
			updateFusionStatus();
			
			// Event stream will automatically handle active tools
			
		} catch (error) {
			console.error('Failed to check initial status:', error);
		}
	}
	
	function updateFusionStatus() {
		const activeTools = [wiresharkStatus, gnuradioStatus, kismetStatus];
		const runningCount = activeTools.filter(status => status === 'running').length;
		const startingCount = activeTools.filter(status => status === 'starting').length;
		
		// Show as running if any tools are running (more practical than requiring all 3)
		if (runningCount > 0) {
			fusionStatus = 'running';
		} else if (startingCount > 0) {
			fusionStatus = 'starting';
		} else {
			fusionStatus = 'stopped';
		}
		
		networkActive = wiresharkStatus === 'running';
		rfActive = gnuradioStatus === 'running';
		wifiActive = kismetStatus === 'running';
	}
	
	async function startFusion() {
		fusionStatus = 'starting';
		
		try {
			console.log('Starting Fusion Security Center...');
			const response = await fetch('/api/fusion/start', { 
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});
			const result = await response.json();
			
			console.log('Fusion start response:', result);
			
			if (result.success || result.status === 'partially_started') {
				// Update individual tool statuses based on results
				if (result.results?.wireshark?.success) {
					wiresharkStatus = 'running';
					networkActive = true;
				} else {
					wiresharkStatus = 'error';
					console.error('Wireshark failed:', result.results?.wireshark?.error || 'Unknown error');
				}
				
				if (result.results?.gnuradio?.success) {
					gnuradioStatus = 'running';
					rfActive = true;
				} else {
					gnuradioStatus = 'error';
					console.error('GNU Radio failed:', result.results?.gnuradio?.error || 'Unknown error');
				}
				
				if (result.results?.kismet?.success) {
					kismetStatus = 'running';
					wifiActive = true;
				} else {
					kismetStatus = 'error';
					console.error('Kismet failed:', result.results?.kismet?.error || 'Unknown error');
				}
				
				// Set fusion status based on how many tools started
				if (result.status === 'fully_started') {
					fusionStatus = 'running';
				} else if (result.status === 'partially_started') {
					fusionStatus = 'running';
					lastError = result.message || 'Some tools failed to start';
				} else {
					fusionStatus = 'error';
				}
				
				updateFusionStatus();
				console.log(result.message || 'Fusion Security Center started');
			} else {
				fusionStatus = 'error';
				lastError = result.error || result.message || 'Failed to start Fusion';
				console.error('Fusion start failed:', result);
				
				// Show tool status if available
				if (result.toolStatus) {
					console.log('Tool availability:', result.toolStatus);
					const missingTools = Object.entries(result.toolStatus)
						.filter(([_, status]) => !status.installed)
						.map(([_, status]) => status.name);
					
					if (missingTools.length > 0) {
						lastError = `Missing tools: ${missingTools.join(', ')}. Please install these tools to use Fusion.`;
					}
				}
			}
		} catch (error) {
			console.error('Failed to start Fusion:', error);
			fusionStatus = 'error';
			lastError = error.message;
		}
	}
	
	async function stopFusion() {
		fusionStatus = 'stopping';
		
		try {
			console.log('Stopping Fusion Security Center...');
			const response = await fetch('/api/fusion/stop', { 
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});
			const result = await response.json();
			
			console.log('Fusion stop response:', result);
			
			// Reset all statuses
			wiresharkStatus = 'stopped';
			gnuradioStatus = 'stopped';
			kismetStatus = 'stopped';
			fusionStatus = 'stopped';
			
			networkActive = false;
			rfActive = false;
			wifiActive = false;
			
			updateFusionStatus();
			console.log('Fusion Security Center stopped');
		} catch (error) {
			console.error('Failed to stop Fusion:', error);
			fusionStatus = 'error';
			lastError = error.message;
		}
	}
	
	async function startWireshark() {
		wiresharkStatus = 'starting';
		updateFusionStatus();
		
		try {
			console.log('Starting Wireshark...');
			const response = await fetch('/api/wireshark/start', { method: 'POST' });
			const result = await response.json();
			
			console.log('Wireshark start response:', result);
			
			if (result.success) {
				wiresharkStatus = 'running';
				console.log('Wireshark started successfully');
			} else {
				wiresharkStatus = 'error';
				console.error('Wireshark start failed:', result.error);
			}
		} catch (error) {
			wiresharkStatus = 'error';
			lastError = `Wireshark start: ${error.message}`;
			console.error('Wireshark start error:', error);
		}
		
		updateFusionStatus();
	}
	
	async function stopWireshark() {
		wiresharkStatus = 'stopping';
		updateFusionStatus();
		
		try {
			console.log('Stopping Wireshark...');
			const response = await fetch('/api/wireshark/stop', { method: 'POST' });
			const result = await response.json();
			
			console.log('Wireshark stop response:', result);
			
			wiresharkStatus = 'stopped';
			networkActive = false;
		} catch (error) {
			wiresharkStatus = 'error';
			console.error('Wireshark stop error:', error);
		}
		
		updateFusionStatus();
	}
	
	async function startGnuradio() {
		gnuradioStatus = 'starting';
		updateFusionStatus();
		
		try {
			console.log('Starting GNU Radio...');
			const response = await fetch('/api/gnuradio/start', { method: 'POST' });
			const result = await response.json();
			
			console.log('GNU Radio start response:', result);
			
			if (result.success) {
				gnuradioStatus = 'running';
				console.log('GNU Radio started successfully');
			} else {
				gnuradioStatus = 'error';
				console.error('GNU Radio start failed:', result.error);
			}
		} catch (error) {
			gnuradioStatus = 'error';
			console.error('GNU Radio start error:', error);
		}
		
		updateFusionStatus();
	}
	
	async function stopGnuradio() {
		gnuradioStatus = 'stopping';
		updateFusionStatus();
		
		try {
			const response = await fetch('/api/gnuradio/stop', { method: 'POST' });
			gnuradioStatus = 'stopped';
			rfActive = false;
			
			if (wsGnuradio) {
				wsGnuradio.close();
				wsGnuradio = null;
			}
		} catch (error) {
			gnuradioStatus = 'error';
		}
		
		updateFusionStatus();
	}
	
	async function startKismet() {
		kismetStatus = 'starting';
		updateFusionStatus();
		
		try {
			console.log('Starting Kismet...');
			const response = await fetch('/api/kismet/start', { method: 'POST' });
			const result = await response.json();
			
			console.log('Kismet start response:', result);
			
			if (result.success) {
				kismetStatus = 'running';
				console.log('Kismet started successfully');
			} else {
				kismetStatus = 'error';
				console.error('Kismet start failed:', result.error);
			}
		} catch (error) {
			kismetStatus = 'error';
			console.error('Kismet start error:', error);
		}
		
		updateFusionStatus();
	}
	
	async function stopKismet() {
		kismetStatus = 'stopping';
		updateFusionStatus();
		
		try {
			console.log('Stopping Kismet...');
			const response = await fetch('/api/kismet/stop', { method: 'POST' });
			const result = await response.json();
			
			console.log('Kismet stop response:', result);
			
			kismetStatus = 'stopped';
			wifiActive = false;
		} catch (error) {
			kismetStatus = 'error';
			console.error('Kismet stop error:', error);
		}
		
		updateFusionStatus();
	}
	
	function connectEventStream() {
		try {
			// Close existing connection if any
			if (eventSource) {
				eventSource.close();
			}
			
			eventSource = new EventSource('/api/fusion/stream?channel=all');
			
			eventSource.addEventListener('open', () => {
				console.log('EventSource connection opened');
			});
			
			eventSource.addEventListener('connected', (event) => {
				const data = JSON.parse(event.data);
				console.log('Connected to Fusion event stream:', data);
			});
			
			eventSource.addEventListener('packet', (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'packet') {
					recentPackets = [data.packet, ...recentPackets.slice(0, 49)];
					packetCount++;
				}
			});
			
			eventSource.addEventListener('stats', (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'stats') {
					packetsPerSecond = data.rate || 0;
					networkInterface = data.interface || 'eth0';
				}
			});
			
			eventSource.addEventListener('status', (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'status') {
					if (data.tool === 'wireshark') {
						wiresharkStatus = data.status === 'started' || data.status === 'running' ? 'running' : 'stopped';
						if (data.interface) {
							networkInterface = data.interface;
						}
					} else if (data.tool === 'gnuradio') {
						gnuradioStatus = data.status === 'started' || data.status === 'running' ? 'running' : 'stopped';
						if (data.device) {
							currentDevice = data.device;
							centerFreq = data.config?.centerFreq || centerFreq;
						}
						if (data.performance) {
							performanceMetrics = data.performance;
						}
					} else if (data.tool === 'kismet') {
						kismetStatus = data.status === 'started' || data.status === 'running' ? 'running' : 'stopped';
					}
					updateFusionStatus();
				}
			});
			
			// Listen for GNU Radio spectrum data
			eventSource.addEventListener('spectrum_data', (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'spectrum_data' && data.tool === 'gnuradio') {
					spectrumData = data.data;
					centerFreq = data.data.centerFreq;
					peakPower = data.data.peakPower;
					noiseFloor = data.data.noiseFloor;
					detectedSignals = data.data.detectedSignals?.length || 0;
					spectrumFrequencies = data.data.frequencies || [];
					spectrumPowers = data.data.powers || [];
				}
			});
			
			// Listen for signal detection events
			eventSource.addEventListener('signal_detected', (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'signal_detected' && data.tool === 'gnuradio') {
					// Handle individual signal detection
					console.log('Signal detected:', data.signal);
				}
			});
			
			// Listen for device connection events
			eventSource.addEventListener('device_connected', (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'device_connected' && data.tool === 'gnuradio') {
					currentDevice = data.device;
					console.log('GNU Radio device connected:', data.device.name);
				}
			});
			
			eventSource.addEventListener('device_disconnected', (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'device_disconnected' && data.tool === 'gnuradio') {
					console.log('GNU Radio device disconnected:', data.deviceId);
					currentDevice = null;
				}
			});
			
			// Enhanced Kismet device handling
			eventSource.addEventListener('device_list', (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'device_list' && data.tool === 'kismet') {
					const devices = data.devices || [];
					totalDevices = devices.length;
					accessPoints = devices.filter((d: any) => d.deviceType === 'access_point').length;
					clientDevices = devices.filter((d: any) => d.deviceType === 'client').length;
					securityThreats = devices.filter((d: any) => d.threatLevel === 'high' || d.threatLevel === 'critical').length;
					
					// Store device list for detailed display
					wifiDevices = devices;
				}
			});
			
			// Enhanced device update handling
			eventSource.addEventListener('device_update', (event) => {
				const data = JSON.parse(event.data);
				if (data.tool === 'kismet') {
					const device = data.device;
					
					if (data.type === 'device_discovered') {
						// Add new device to list
						wifiDevices = [...wifiDevices, device];
						totalDevices++;
						
						if (device.deviceType === 'access_point') accessPoints++;
						if (device.deviceType === 'client') clientDevices++;
						if (device.threatLevel === 'high' || device.threatLevel === 'critical') securityThreats++;
						
					} else if (data.type === 'device_updated') {
						// Update existing device
						const index = wifiDevices.findIndex(d => d.mac === device.mac);
						if (index >= 0) {
							wifiDevices[index] = device;
							wifiDevices = [...wifiDevices]; // Trigger reactivity
						}
						
					} else if (data.type === 'device_lost') {
						// Remove device from list
						wifiDevices = wifiDevices.filter(d => d.mac !== device.mac);
						totalDevices--;
						
						if (device.deviceType === 'access_point') accessPoints--;
						if (device.deviceType === 'client') clientDevices--;
						if (device.threatLevel === 'high' || device.threatLevel === 'critical') securityThreats--;
					}
				}
			});
			
			// Security alert handling
			eventSource.addEventListener('security_alert', (event) => {
				const data = JSON.parse(event.data);
				if (data.tool === 'kismet') {
					console.log('Security alert:', data.type, data);
					// Handle security alerts - could show notifications
				}
			});
			
			// Correlation update handling
			eventSource.addEventListener('correlation_update', (event) => {
				const data = JSON.parse(event.data);
				if (data.tool === 'kismet') {
					console.log('Correlation found:', data.correlation);
					// Handle correlation updates
				}
			});
			
			eventSource.addEventListener('error', (event) => {
				console.error('Event stream error:', event);
				
				// More detailed error handling
				if (eventSource?.readyState === EventSource.CONNECTING) {
					console.log('EventSource is reconnecting...');
				} else if (eventSource?.readyState === EventSource.CLOSED) {
					console.log('EventSource connection closed, will retry in 5 seconds');
					// Clear the eventSource to prevent memory leaks
					eventSource = null;
					// Try to reconnect after a delay
					setTimeout(() => {
						console.log('Attempting to reconnect EventSource...');
						connectEventStream();
					}, 5000);
				}
			});
			
			eventSource.addEventListener('heartbeat', (event) => {
				// Keep connection alive
			});
			
		} catch (error) {
			console.error('Failed to connect to event stream:', error);
		}
	}
	
	function getStatusIndicator(status: ToolStatus): string {
		switch (status) {
			case 'running': return '● CONNECTED';
			case 'starting': return '◐ STARTING';
			case 'stopping': return '◑ STOPPING';
			case 'error': return '● ERROR';
			default: return '○ STOPPED';
		}
	}
	
	function getStatusColor(status: ToolStatus): string {
		switch (status) {
			case 'running': return 'text-accent-primary';
			case 'starting': case 'stopping': return 'text-yellow-400';
			case 'error': return 'text-red-400';
			default: return 'text-text-secondary';
		}
	}
	
	function formatFrequency(freq: number): string {
		if (freq >= 1e9) {
			return (freq / 1e9).toFixed(3) + ' GHz';
		} else if (freq >= 1e6) {
			return (freq / 1e6).toFixed(1) + ' MHz';
		} else {
			return (freq / 1e3).toFixed(0) + ' kHz';
		}
	}
	
	function formatTime(timestamp: string | Date): string {
		const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
		return date.toLocaleTimeString();
	}
	
	function getSignalStrengthColor(strength: number): string {
		if (strength > -40) return 'text-green-400';
		if (strength > -60) return 'text-yellow-400';
		return 'text-red-400';
	}
	
	function getThreatLevelColor(level: string): string {
		switch (level) {
			case 'critical': return 'text-red-500';
			case 'high': return 'text-orange-500';
			case 'medium': return 'text-yellow-500';
			default: return 'text-green-500';
		}
	}
	
	async function checkSystemStatus() {
		try {
			const response = await fetch('/api/fusion/system-status');
			const status = await response.json();
			
			console.log('System Status:', status);
			
			// Display system info
			let message = `OS: ${status.system.os}\n`;
			message += `Platform: ${status.system.platform} ${status.system.arch}\n`;
			message += status.system.isDragonOS ? '✓ DragonOS Detected\n' : '';
			message += '\nTools:\n';
			
			for (const [key, tool] of Object.entries(status.tools)) {
				message += `${tool.installed ? '✓' : '✗'} ${tool.name}`;
				if (tool.path) message += ` (${tool.path})`;
				message += '\n';
			}
			
			message += '\nNetwork Interfaces:\n';
			for (const iface of status.network.interfaces) {
				message += `- ${iface.name}: ${iface.addresses.join(', ')}`;
				if (iface.isWireless) message += ' (wireless)';
				message += '\n';
			}
			
			message += '\nRF Hardware:\n';
			message += `HackRF: ${status.hardware.hackrf ? '✓ Connected' : '✗ Not found'}\n`;
			message += `RTL-SDR: ${status.hardware.rtlsdr ? '✓ Connected' : '✗ Not found'}\n`;
			
			if (status.recommendations.length > 0) {
				message += '\nRecommendations:\n';
				status.recommendations.forEach(rec => {
					message += `• ${rec}\n`;
				});
			}
			
			alert(message);
			
		} catch (error) {
			console.error('Failed to check system status:', error);
			alert('Failed to check system status: ' + error.message);
		}
	}
</script>

<svelte:head>
	<title>Fusion Security Center | Argos</title>
</svelte:head>

<!-- Geometric Background (matching Argos style) -->
<div class="geometric-background">
	<div class="depth-gradient"></div>
	<div class="floating-shapes"></div>
	<div class="grid-pattern"></div>
	<div class="hexagon-overlay"></div>
	<div class="circuit-lines"></div>
	<div class="accent-triangle triangle-1"></div>
	<div class="accent-triangle triangle-2"></div>
	<div class="accent-triangle triangle-3"></div>
</div>

<main class="min-h-screen bg-bg-primary text-text-primary relative z-10">
	<!-- Header -->
	<header class="glass-panel border-0 border-b border-border-primary header-gradient-sweep">
		<div class="max-w-7xl mx-auto px-6 py-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<!-- Back to Console Button -->
					<a 
						href="/" 
						class="flex items-center space-x-2 px-4 py-2 rounded-lg glass-effect hover:bg-white/10 transition-all duration-200 text-text-secondary hover:text-text-primary"
						title="Back to Console"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
						</svg>
						<span class="font-medium">Console</span>
					</a>
					
					<div class="w-12 h-12 rounded-xl bg-accent-primary flex items-center justify-center">
						<svg class="w-7 h-7 text-black" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 2L2 7v10c0 5.55 3.84 9.739 9 11 5.16-1.261 9-5.45 9-11V7l-10-5z"/>
						</svg>
					</div>
					<div>
						<h1 class="text-3xl font-bold text-text-primary">
							🛡️ <span class="text-accent-primary">Fusion</span> Security Center
						</h1>
						<p class="text-text-secondary">
							Integrated Security Intelligence Platform
						</p>
					</div>
				</div>
				<div class="flex items-center space-x-4">
					<div class="flex items-center space-x-2">
						<span class="{getStatusColor(fusionStatus)} font-mono text-sm">
							{getStatusIndicator(fusionStatus)}
						</span>
					</div>
					{#if fusionStatus === 'running'}
						<button 
							class="saasfly-button-secondary px-4 py-2 rounded-md font-medium"
							on:click={stopFusion}
						>
							STOP FUSION
						</button>
					{:else if fusionStatus === 'stopped'}
						<button 
							class="saasfly-button-primary px-4 py-2 rounded-md font-medium"
							on:click={startFusion}
						>
							START FUSION
						</button>
					{:else}
						<button 
							class="saasfly-button-secondary px-4 py-2 rounded-md font-medium opacity-50 cursor-not-allowed"
							disabled
						>
							{fusionStatus.toUpperCase()}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</header>
	
	<!-- Tab Navigation -->
	<div class="max-w-7xl mx-auto px-6 pt-6">
		<div class="flex space-x-1 bg-bg-secondary/50 p-1 rounded-lg">
			<button
				class="flex-1 px-4 py-2 rounded-md font-medium transition-all {activeTab === 'overview' ? 'bg-accent-primary text-black' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary/50'}"
				on:click={() => activeTab = 'overview'}
			>
				📊 Overview
			</button>
			<button
				class="flex-1 px-4 py-2 rounded-md font-medium transition-all {activeTab === 'packets' ? 'bg-accent-primary text-black' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary/50'}"
				on:click={() => activeTab = 'packets'}
			>
				🔍 Packet Analysis
			</button>
			<button
				class="flex-1 px-4 py-2 rounded-md font-medium transition-all {activeTab === 'correlation' ? 'bg-accent-primary text-black' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary/50'}"
				on:click={() => activeTab = 'correlation'}
			>
				🔗 Correlation Engine
			</button>
		</div>
	</div>
	
	<!-- Main Dashboard -->
	<div class="max-w-7xl mx-auto px-6 py-8">
		{#if activeTab === 'overview'}
			<!-- Tool Status Overview -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
			<!-- Network Analysis Status -->
			<div class="saasfly-feature-card">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center space-x-3">
						<div class="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
							<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
							</svg>
						</div>
						<h3 class="text-lg font-semibold text-text-primary">📊 Network Analysis</h3>
					</div>
					<span class="{getStatusColor(wiresharkStatus)} text-sm font-mono">
						{getStatusIndicator(wiresharkStatus)}
					</span>
				</div>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-text-secondary">Status:</span>
						<span class="text-text-primary">{networkActive ? 'Active' : 'Inactive'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary">Interface:</span>
						<span class="text-text-primary font-mono">{networkInterface}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary">Packets:</span>
						<span class="text-accent-primary font-mono">{packetCount.toLocaleString()}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary">Rate:</span>
						<span class="text-accent-primary font-mono">{packetsPerSecond} pkt/sec</span>
					</div>
				</div>
			</div>
			
			<!-- RF Spectrum Status -->
			<div class="saasfly-feature-card">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center space-x-3">
						<div class="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
							<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
								<path d="M3.27 1.44L2 2.72l2.05 2.06C2.78 5.58 2 7.22 2 9v6c0 1.11.89 2 2 2h3.73L12 21.5 16.27 17H20c1.11 0 2-.89 2-2V9c0-1.78-.78-3.42-2.05-4.22L21.73 2.5 20.46 1.23 3.27 1.44z"/>
							</svg>
						</div>
						<h3 class="text-lg font-semibold text-text-primary">📡 RF Spectrum</h3>
					</div>
					<span class="{getStatusColor(gnuradioStatus)} text-sm font-mono">
						{getStatusIndicator(gnuradioStatus)}
					</span>
				</div>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-text-secondary">Status:</span>
						<span class="text-text-primary">{rfActive ? 'Scanning' : 'Inactive'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary">Device:</span>
						<span class="text-text-primary font-mono">{currentDevice?.name || 'None'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary">Frequency:</span>
						<span class="text-text-primary font-mono">{formatFrequency(centerFreq)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary">Power Level:</span>
						<span class="text-accent-primary font-mono">{peakPower.toFixed(1)} dBm</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary">Signals:</span>
						<span class="text-accent-primary font-mono">{detectedSignals}</span>
					</div>
				</div>
			</div>
			
			<!-- WiFi Discovery Status -->
			<div class="saasfly-feature-card">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center space-x-3">
						<div class="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
							<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
								<path d="M1 9l2 2c2.88-2.88 6.79-4.08 10.53-3.62l1.4-1.4C9.81 4.21 4.74 5.86 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c1.23-1.23 3.57-1.52 5.13-.73l1.4-1.4C11.81 8.21 7.74 9.86 5 13z"/>
							</svg>
						</div>
						<h3 class="text-lg font-semibold text-text-primary">📶 WiFi Discovery</h3>
					</div>
					<span class="{getStatusColor(kismetStatus)} text-sm font-mono">
						{getStatusIndicator(kismetStatus)}
					</span>
				</div>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-text-secondary">Status:</span>
						<span class="text-text-primary">{wifiActive ? 'Monitoring' : 'Inactive'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary">Devices:</span>
						<span class="text-accent-primary font-mono">{totalDevices}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary">Access Points:</span>
						<span class="text-accent-primary font-mono">{accessPoints}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary">Threats:</span>
						<span class="{securityThreats > 0 ? 'text-red-400' : 'text-accent-primary'} font-mono">
							{securityThreats}
						</span>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Real-time Monitoring Panels -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
			<!-- Network Traffic Analysis -->
			<div class="glass-panel rounded-xl p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-xl font-semibold text-text-primary">Network Traffic Analysis</h3>
					<button class="glass-button px-3 py-1 rounded-md text-sm">
						Configure
					</button>
				</div>
				
				{#if networkActive}
					<div class="space-y-4">
						<!-- Status Bar -->
						<div class="glass-panel-light rounded-lg p-4">
							<div class="flex items-center justify-between text-sm">
								<span class="text-text-primary font-medium">🔴 LIVE CAPTURE</span>
								<span class="text-accent-primary animate-pulse">● RECORDING</span>
							</div>
							<div class="text-xs text-text-secondary font-mono mt-1">
								Interface: {networkInterface} | Packets: {packetCount.toLocaleString()} | {packetsPerSecond}/sec
							</div>
						</div>
						
						<!-- Recent Packets -->
						<div class="glass-panel-light rounded-lg p-4">
							<h4 class="text-sm font-medium text-text-primary mb-3">Recent Packets</h4>
							<div class="space-y-2 max-h-40 overflow-y-auto">
								{#each recentPackets.slice(0, 6) as packet}
									<div class="text-xs font-mono">
										<div class="flex justify-between text-text-primary">
											<span>{formatTime(packet.timestamp)}</span>
											<span class="text-accent-primary">{packet.protocol}</span>
										</div>
										<div class="text-text-secondary">
											{packet.src_ip} → {packet.dst_ip} ({packet.length} bytes)
										</div>
									</div>
								{/each}
								{#if recentPackets.length === 0}
									<div class="text-xs text-text-secondary">Waiting for packets...</div>
								{/if}
							</div>
						</div>
						
						<!-- Traffic Stats -->
						<div class="glass-panel-light rounded-lg p-4">
							<h4 class="text-sm font-medium text-text-primary mb-3">Traffic Statistics</h4>
							<div class="grid grid-cols-2 gap-4 text-xs">
								<div>
									<span class="text-text-secondary">Total Packets:</span>
									<span class="text-accent-primary font-mono ml-2">{packetCount.toLocaleString()}</span>
								</div>
								<div>
									<span class="text-text-secondary">Current Rate:</span>
									<span class="text-accent-primary font-mono ml-2">{packetsPerSecond}/sec</span>
								</div>
							</div>
						</div>
					</div>
				{:else}
					<div class="flex items-center justify-center h-48 text-text-secondary">
						<div class="text-center">
							<svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
							</svg>
							<p>Wireshark not active</p>
							<p class="text-sm">Start Fusion to begin network analysis</p>
						</div>
					</div>
				{/if}
			</div>
			
			<!-- RF Spectrum Analysis -->
			<div class="glass-panel rounded-xl p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-xl font-semibold text-text-primary">RF Spectrum Analysis</h3>
					<button class="glass-button px-3 py-1 rounded-md text-sm">
						Configure
					</button>
				</div>
				
				{#if rfActive}
					<div class="space-y-4">
						<!-- Status Bar -->
						<div class="glass-panel-light rounded-lg p-4">
							<div class="flex items-center justify-between text-sm">
								<span class="text-text-primary font-medium">📊 SPECTRUM MONITOR</span>
								<span class="text-accent-primary animate-pulse">● SCANNING</span>
							</div>
							<div class="text-xs text-text-secondary font-mono mt-1">
								{currentDevice?.name || 'No Device'} | Center: {formatFrequency(centerFreq)} | Peak: {peakPower.toFixed(1)} dBm
							</div>
						</div>
						
						<!-- Spectrum Visualization -->
						<div class="glass-panel-light rounded-lg p-4 h-32">
							<div class="h-full flex items-end justify-around">
								{#if spectrumPowers.length > 0}
									{#each Array(50) as _, i}
										{@const dataIndex = Math.floor(i * spectrumPowers.length / 50)}
										{@const powerLevel = spectrumPowers[dataIndex] || noiseFloor}
										{@const normalizedHeight = Math.max(5, Math.min(95, ((powerLevel - noiseFloor) / (peakPower - noiseFloor)) * 100))}
										<div 
											class="w-1 bg-accent-primary opacity-70 rounded-t transition-all duration-200"
											style="height: {normalizedHeight}%"
											title="Freq: {spectrumFrequencies[dataIndex] ? formatFrequency(spectrumFrequencies[dataIndex]) : 'N/A'}, Power: {powerLevel.toFixed(1)} dBm"
										></div>
									{/each}
								{:else}
									{#each Array(50) as _, i}
										{@const height = Math.random() * 40 + 20}
										<div 
											class="w-1 bg-accent-primary opacity-30 rounded-t transition-all duration-200"
											style="height: {height}%"
										></div>
									{/each}
								{/if}
							</div>
							
							<!-- Frequency Labels -->
							<div class="flex justify-between text-xs text-text-secondary mt-2 font-mono">
								<span>{formatFrequency(centerFreq - (spectrumData?.sampleRate || 2e6)/2)}</span>
								<span>{formatFrequency(centerFreq)}</span>
								<span>{formatFrequency(centerFreq + (spectrumData?.sampleRate || 2e6)/2)}</span>
							</div>
						</div>
						
						<!-- Signal Analysis -->
						<div class="glass-panel-light rounded-lg p-4">
							<h4 class="text-sm font-medium text-text-primary mb-3">Signal Analysis</h4>
							<div class="grid grid-cols-2 gap-4 text-xs">
								<div>
									<span class="text-text-secondary">Peak Signal:</span>
									<span class="text-accent-primary font-mono ml-2">{peakPower.toFixed(1)} dBm</span>
								</div>
								<div>
									<span class="text-text-secondary">Noise Floor:</span>
									<span class="text-accent-primary font-mono ml-2">{noiseFloor.toFixed(1)} dBm</span>
								</div>
								<div>
									<span class="text-text-secondary">SNR:</span>
									<span class="text-accent-primary font-mono ml-2">{(peakPower - noiseFloor).toFixed(1)} dB</span>
								</div>
								<div>
									<span class="text-text-secondary">Signals:</span>
									<span class="text-accent-primary font-mono ml-2">{detectedSignals}</span>
								</div>
								<div>
									<span class="text-text-secondary">Sample Rate:</span>
									<span class="text-accent-primary font-mono ml-2">{(performanceMetrics.samplesPerSecond / 1e6).toFixed(1)} MHz</span>
								</div>
								<div>
									<span class="text-text-secondary">CPU Usage:</span>
									<span class="text-accent-primary font-mono ml-2">{performanceMetrics.cpuUsage.toFixed(1)}%</span>
								</div>
							</div>
						</div>
						
						<!-- Detected Signals List -->
						{#if spectrumData?.detectedSignals && spectrumData.detectedSignals.length > 0}
							<div class="glass-panel-light rounded-lg p-4">
								<h4 class="text-sm font-medium text-text-primary mb-3">Detected Signals</h4>
								<div class="space-y-2 max-h-32 overflow-y-auto">
									{#each spectrumData.detectedSignals.slice(0, 5) as signal}
										<div class="flex justify-between items-center text-xs">
											<div>
												<span class="text-text-primary">{formatFrequency(signal.frequency)}</span>
												{#if signal.modulation}
													<span class="text-text-secondary ml-2">({signal.modulation})</span>
												{/if}
											</div>
											<div class="text-right">
												<span class="text-accent-primary font-mono">{signal.power.toFixed(1)} dBm</span>
												<span class="text-text-secondary ml-2">SNR: {signal.snr.toFixed(1)} dB</span>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<div class="flex items-center justify-center h-48 text-text-secondary">
						<div class="text-center">
							<svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
								<path d="M3.27 1.44L2 2.72l2.05 2.06C2.78 5.58 2 7.22 2 9v6c0 1.11.89 2 2 2h3.73L12 21.5 16.27 17H20c1.11 0 2-.89 2-2V9c0-1.78-.78-3.42-2.05-4.22L21.73 2.5 20.46 1.23 3.27 1.44z"/>
							</svg>
							<p>GNU Radio not active</p>
							<p class="text-sm">Start Fusion to begin RF analysis</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
		
		<!-- WiFi Device Discovery -->
		<div class="glass-panel rounded-xl p-6 mb-8">
			<div class="flex items-center justify-between mb-6">
				<h3 class="text-xl font-semibold text-text-primary">WiFi Device Discovery</h3>
				<button class="glass-button px-3 py-1 rounded-md text-sm">
					Configure
				</button>
			</div>
			
			{#if wifiActive}
				<div class="space-y-4">
					<!-- Status Bar -->
					<div class="glass-panel-light rounded-lg p-4">
						<div class="flex items-center justify-between text-sm">
							<span class="text-text-primary font-medium">📶 KISMET WIRELESS MONITOR</span>
							<span class="text-accent-primary animate-pulse">● SCANNING</span>
						</div>
						<div class="text-xs text-text-secondary font-mono mt-1">
							Interface: wlan0 | Monitor Mode | Devices: {totalDevices}
						</div>
					</div>
					
					<!-- Device Summary -->
					<div class="grid grid-cols-4 gap-4">
						<div class="glass-panel-light rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-accent-primary">{totalDevices}</div>
							<div class="text-xs text-text-secondary">Total Devices</div>
						</div>
						<div class="glass-panel-light rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-accent-primary">{accessPoints}</div>
							<div class="text-xs text-text-secondary">Access Points</div>
						</div>
						<div class="glass-panel-light rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-accent-primary">{clientDevices}</div>
							<div class="text-xs text-text-secondary">Client Devices</div>
						</div>
						<div class="glass-panel-light rounded-lg p-4 text-center">
							<div class="text-2xl font-bold text-red-400">{securityThreats}</div>
							<div class="text-xs text-text-secondary">Security Threats</div>
						</div>
					</div>
					
					<!-- Enhanced Device List -->
					<div class="glass-panel-light rounded-lg p-4">
						<h4 class="text-sm font-medium text-text-primary mb-3">Discovered Devices</h4>
						<div class="space-y-2 max-h-64 overflow-y-auto">
							{#each wifiDevices.slice(0, 10) as device}
								<div class="frequency-item">
									<div class="flex items-center space-x-4">
										<div class="w-3 h-3 rounded-full {device.deviceType === 'access_point' ? 'bg-blue-500' : 'bg-green-500'}"></div>
										<div class="flex-grow">
											<div class="flex items-center justify-between">
												<span class="font-mono text-sm text-text-primary">
													{device.ssid || 'Unknown Device'}
												</span>
												<span class="text-xs {getThreatLevelColor(device.threatLevel)} uppercase">
													{device.threatLevel}
												</span>
											</div>
											<div class="flex items-center justify-between text-xs text-text-secondary">
												<span>MAC: {device.mac.substring(0, 8)}:XX:XX</span>
												<span>{device.manufacturer}</span>
											</div>
										</div>
									</div>
									<div class="text-right">
										<div class="text-sm {getSignalStrengthColor(device.signalStrength)}">
											{device.signalStrength} dBm
										</div>
										<div class="text-xs text-text-secondary">
											Ch {device.channel}
										</div>
									</div>
								</div>
							{/each}
							
							{#if wifiDevices.length > 10}
								<div class="text-center py-2">
									<span class="text-xs text-text-secondary">
										+{wifiDevices.length - 10} more devices...
									</span>
								</div>
							{/if}
							
							{#if wifiDevices.length === 0}
								<div class="text-center py-4 text-text-secondary">
									<span class="text-xs">No devices discovered yet...</span>
								</div>
							{/if}
						</div>
					</div>
					
					{#if securityThreats > 0}
						<div class="glass-panel-light rounded-lg p-4 border-l-4 border-red-500">
							<h4 class="text-sm font-medium text-text-primary mb-2">Security Alerts</h4>
							<div class="space-y-1">
								{#each wifiDevices.filter(d => d.threatLevel === 'high' || d.threatLevel === 'critical').slice(0, 3) as threat}
									<div class="text-xs text-text-secondary">
										<span class="text-red-400">●</span>
										{threat.ssid || threat.mac}: {threat.securityAssessment?.vulnerabilities[0] || 'Security threat detected'}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="flex items-center justify-center h-32 text-text-secondary">
					<div class="text-center">
						<svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
							<path d="M1 9l2 2c2.88-2.88 6.79-4.08 10.53-3.62l1.4-1.4C9.81 4.21 4.74 5.86 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c1.23-1.23 3.57-1.52 5.13-.73l1.4-1.4C11.81 8.21 7.74 9.86 5 13z"/>
						</svg>
						<p>Kismet not active</p>
						<p class="text-sm">Start Fusion to begin WiFi discovery</p>
					</div>
				</div>
			{/if}
		</div>
		{/if}
		
		{#if activeTab === 'packets'}
			<!-- Packet Analysis Dashboard -->
			<PacketAnalysisDashboard />
		{/if}
		
		{#if activeTab === 'correlation'}
			<!-- Correlation Engine View -->
			<div class="glass-panel rounded-xl p-6">
				<div class="flex items-center justify-center h-96 text-text-secondary">
					<div class="text-center">
						<svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 24 24">
							<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
						</svg>
						<h3 class="text-lg font-medium mb-2">Correlation Engine</h3>
						<p class="text-sm">Advanced multi-source correlation analysis coming soon</p>
					</div>
				</div>
			</div>
		{/if}
		
		<!-- Debug Panel -->
		{#if debugMode}
			<div class="glass-panel rounded-xl p-4 mb-6 border-l-4 border-yellow-500">
				<div class="flex items-center justify-between mb-2">
					<h3 class="text-sm font-medium text-text-primary">🔧 Debug Information</h3>
					<div class="flex items-center space-x-2">
						<button 
							class="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 border border-blue-400 rounded"
							on:click={checkSystemStatus}
						>
							Check System
						</button>
						<button 
							class="text-xs text-yellow-400 hover:text-yellow-300"
							on:click={() => debugMode = false}
						>
							Hide Debug
						</button>
					</div>
				</div>
				<div class="space-y-2 text-xs font-mono">
					<div>
						<span class="text-text-secondary">Tool Status:</span>
						<span class="text-text-primary ml-2">
							Wireshark: {wiresharkStatus} | GNU Radio: {gnuradioStatus} | Kismet: {kismetStatus}
						</span>
					</div>
					{#if lastError}
						<div>
							<span class="text-red-400">Last Error:</span>
							<span class="text-red-300 ml-2">{lastError}</span>
						</div>
					{/if}
					<div>
						<span class="text-text-secondary">Event Source:</span>
						<span class="text-text-primary ml-2">
							{eventSource ? `Connected (${eventSource.readyState})` : 'Disconnected'}
						</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Footer -->
		<div class="glass-panel rounded-xl p-4">
			<div class="flex items-center justify-between text-sm text-text-secondary">
				<div class="flex items-center space-x-4">
					<span>🕐 Last Update: {new Date().toLocaleTimeString()}</span>
					<button 
						class="text-yellow-400 hover:text-yellow-300 cursor-pointer"
						on:click={() => debugMode = !debugMode}
					>
						🔧 Debug
					</button>
				</div>
				<span>🖥️ Platform: DragonOS (Raspberry Pi)</span>
				<span>🛡️ Fusion Security Center v1.0</span>
			</div>
		</div>
	</div>
</main>

<style>
	.glass-panel {
		background: rgba(30, 30, 30, 0.7);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.glass-panel-light {
		background: rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(5px);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.glass-button {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(104, 211, 145, 0.3);
		transition: all 0.2s ease;
	}
	
	.glass-button:hover {
		background: rgba(104, 211, 145, 0.2);
		border-color: rgba(104, 211, 145, 0.5);
	}
</style>