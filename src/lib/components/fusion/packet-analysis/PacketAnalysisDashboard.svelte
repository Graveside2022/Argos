<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import PacketList from './PacketList.svelte';
	import PacketDetail from './PacketDetail.svelte';
	import PacketStatistics from './PacketStatistics.svelte';
	import AlertsPanel from './AlertsPanel.svelte';
	import PacketFilters from './PacketFilters.svelte';
	import { analyzedPackets, addPacket, detectPortScanning } from '$lib/stores/packetAnalysisStore';
	import type { AnalyzedPacket, NetworkPacket } from '$lib/stores/packetAnalysisStore';
	
	let selectedPacket: AnalyzedPacket | null = null;
	let filteredPackets: AnalyzedPacket[] = [];
	let filters: any = {};
	let isConnected = false;
	let ws: WebSocket | null = null;
	
	// Port scanning detection interval
	let portScanInterval: number;
	
	onMount(() => {
		// Connect to WebSocket for real-time packet data
		connectWebSocket();
		
		// Run port scanning detection every 30 seconds
		portScanInterval = setInterval(() => {
			detectPortScanning($analyzedPackets);
		}, 30000);
	});
	
	onDestroy(() => {
		if (ws) {
			ws.close();
		}
		if (portScanInterval) {
			clearInterval(portScanInterval);
		}
	});
	
	function connectWebSocket() {
		try {
			ws = new WebSocket(`ws://${window.location.host}/api/ws`);
			
			ws.onopen = () => {
				console.log('WebSocket connected for packet analysis');
				isConnected = true;
				// Subscribe to Wireshark packet stream
				ws.send(JSON.stringify({ 
					type: 'subscribe', 
					channel: 'wireshark' 
				}));
			};
			
			ws.onmessage = (event) => {
				const data = JSON.parse(event.data);
				if (data.type === 'packet' && data.packet) {
					// Add packet to analysis store
					addPacket(data.packet as NetworkPacket);
				}
			};
			
			ws.onerror = (error) => {
				console.error('WebSocket error:', error);
			};
			
			ws.onclose = () => {
				isConnected = false;
				// Attempt to reconnect after 5 seconds
				setTimeout(connectWebSocket, 5000);
			};
		} catch (error) {
			console.error('Failed to connect WebSocket:', error);
		}
	}
	
	function handleFilterChange(newFilters: any) {
		filters = newFilters;
		applyFilters();
	}
	
	function applyFilters() {
		filteredPackets = $analyzedPackets.filter(packet => {
			// Protocol filter
			if (filters.protocol && packet.protocol !== filters.protocol) {
				return false;
			}
			
			// Source IP filter
			if (filters.sourceIp && !packet.src_ip.includes(filters.sourceIp)) {
				return false;
			}
			
			// Destination IP filter
			if (filters.destIp && !packet.dst_ip.includes(filters.destIp)) {
				return false;
			}
			
			// Category filter
			if (filters.category && packet.analysis.category !== filters.category) {
				return false;
			}
			
			// Severity filter
			if (filters.minSeverity && packet.analysis.severity < filters.minSeverity) {
				return false;
			}
			
			// Flagged filter
			if (filters.showFlagged && !packet.flaggedForReview) {
				return false;
			}
			
			// Time range filter
			if (filters.timeRange && filters.timeRange !== 'all') {
				const now = Date.now();
				const packetTime = new Date(packet.timestamp).getTime();
				const diff = now - packetTime;
				
				switch (filters.timeRange) {
					case '1m': return diff <= 60000;
					case '5m': return diff <= 300000;
					case '15m': return diff <= 900000;
					case '1h': return diff <= 3600000;
				}
			}
			
			return true;
		});
	}
	
	// Update filtered packets when store changes
	$: {
		if ($analyzedPackets) {
			applyFilters();
		}
	}
</script>

<div class="min-h-screen bg-bg-primary p-4">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="mb-6">
			<h1 class="text-2xl font-bold text-text-primary">Packet Analysis Dashboard</h1>
			<div class="mt-2 flex items-center space-x-2">
				<div class="flex items-center">
					<div class="h-2 w-2 rounded-full {isConnected ? 'bg-accent-primary' : 'bg-red-400'} mr-2"></div>
					<span class="text-sm text-text-secondary">
						{isConnected ? 'Connected' : 'Disconnected'}
					</span>
				</div>
				<span class="text-sm text-text-muted">|</span>
				<span class="text-sm text-text-secondary">
					{$analyzedPackets.length} packets captured
				</span>
			</div>
		</div>
		
		<!-- Statistics Overview -->
		<PacketStatistics />
		
		<!-- Main Content Grid -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Left Column: Filters and Alerts -->
			<div class="space-y-6">
				<PacketFilters onFilterChange={handleFilterChange} />
				<AlertsPanel maxAlerts={5} />
			</div>
			
			<!-- Middle Column: Packet List -->
			<div class="lg:col-span-1">
				<div class="glass-panel rounded-lg h-[600px] overflow-hidden">
					<PacketList 
						bind:selectedPacket
						maxPackets={100}
					/>
				</div>
			</div>
			
			<!-- Right Column: Packet Details -->
			<div class="lg:col-span-1">
				<PacketDetail packet={selectedPacket} />
			</div>
		</div>
		
		<!-- Future: Network Visualization Area -->
		<div class="mt-6 glass-panel rounded-lg p-6">
			<h3 class="text-lg font-semibold text-text-primary mb-4">Network Visualization</h3>
			<div class="h-64 bg-bg-secondary rounded flex items-center justify-center">
				<p class="text-text-secondary">WebGL Network Graph Visualization Coming Soon</p>
				<!-- This is where @14's WebGL visualization would be integrated -->
			</div>
		</div>
	</div>
</div>

<style>
	:global(.packet-anomaly) {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
	
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>