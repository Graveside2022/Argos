<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { KismetDevice } from '$lib/types/kismet';
	
	export let isOpen = false;
	export let onClose: () => void = () => {};
	
	// Data
	let devices: KismetDevice[] = [];
	let filteredDevices: KismetDevice[] = [];
	let kismetStatus = 'checking';
	let totalDevices = 0;
	let activeThreats = 0;
	let droneCount = 0;
	let wifiDevices = 0;
	let selectedCategory: string | null = null;
	let selectedDevice: KismetDevice | null = null;
	let showDeviceDetail = false;
	let isLoading = true;
	
	// Device type breakdown
	let deviceBreakdown = {
		mobile: 0,
		laptop: 0,
		iot: 0,
		ap: 0,
		drone: 0,
		unknown: 0
	};
	
	// Update interval
	let updateInterval: ReturnType<typeof setInterval> | undefined;
	
	async function fetchKismetData() {
		try {
			// Single API call for devices
			const devicesRes = await fetch('/api/kismet/devices');
			const devicesData = await devicesRes.json();
			
			if (devicesData.devices && Array.isArray(devicesData.devices)) {
				devices = devicesData.devices;
				totalDevices = devices.length;
				
				// If we got devices, Kismet is running
				kismetStatus = devices.length >= 0 ? 'running' : 'stopped';
				
				// Process device data
				processDevices(devices);
				
				// Update filtered devices - this ensures UI updates
				updateFilteredDevices();
			} else {
				devices = [];
				totalDevices = 0;
				kismetStatus = 'stopped';
			}
			
			// Clear loading state after data is processed
			isLoading = false;
		} catch (error) {
			console.error('Error fetching Kismet data:', error);
			kismetStatus = 'error';
			devices = [];
			totalDevices = 0;
			isLoading = false;
		}
	}
	
	function processDevices(deviceList: KismetDevice[]) {
		// Reset counters
		deviceBreakdown = {
			mobile: 0,
			laptop: 0,
			iot: 0,
			ap: 0,
			drone: 0,
			unknown: 0
		};
		wifiDevices = 0;
		droneCount = 0;
		activeThreats = 0;
		
		let uncategorized = 0;
		
		deviceList.forEach(device => {
			// Count WiFi devices
			if (device.type?.toLowerCase().includes('wi-fi') || device.type?.toLowerCase().includes('wifi')) {
				wifiDevices++;
			}
			
			// Detect drones by manufacturer or SSID patterns
			if (isDrone(device)) {
				droneCount++;
				// Count as drone type in breakdown
				deviceBreakdown.drone++;
			} else {
				// Categorize other devices
				const deviceType = getDeviceType(device);
				if (deviceType in deviceBreakdown) {
					deviceBreakdown[deviceType as keyof typeof deviceBreakdown]++;
				} else {
					// This shouldn't happen, but let's count it
					uncategorized++;
				}
			}
			
			// Check for threats
			if (isThreadDevice(device)) {
				activeThreats++;
			}
		});
	}
	
	function isDrone(device: KismetDevice): boolean {
		// Comprehensive drone detection patterns
		const dronePatterns = [
			// Manufacturer names
			'DJI', 'Parrot', 'Autel', 'Skydio', 'Yuneec', 'EHang', 'PowerVision', 
			'Hubsan', 'Syma', 'Holy Stone', 'Potensic', 'Ryze',
			// Model names
			'Mavic', 'Phantom', 'Spark', 'Inspire', 'Matrice', 'Agras', 'FPV',
			'Anafi', 'Bebop', 'Disco', 'Mambo', 'Swing',
			'EVO', 'Typhoon', 'Breeze', 'Mantis',
			// Generic patterns
			'drone', 'UAV', 'quadcopter', 'multicopter',
			// Common drone WiFi patterns
			'_RC', 'FPV_', 'TELLO-', 'Spark-', 'Mavic-', 'Phantom-'
		];
		
		const ssid = device.ssid?.toLowerCase() || '';
		const manuf = (device.manufacturer || device.manuf || '').toLowerCase();
		const type = device.type?.toLowerCase() || '';
		
		// Check all fields for drone patterns
		return dronePatterns.some(pattern => {
			const p = pattern.toLowerCase();
			return ssid.includes(p) || manuf.includes(p) || type.includes(p);
		});
	}
	
	function getDeviceType(device: KismetDevice): string {
		const manuf = (device.manufacturer || device.manuf || '').toLowerCase();
		const type = (device.type || '').toLowerCase();
		
		// Check device type first - handle variations
		if (type.includes('ap') || type.includes('access point') || type === 'wi-fi ap') {
			return 'ap';
		}
		
		// WiFi clients with known manufacturers
		if (type.includes('client') || type === 'wi-fi client') {
			// Try to categorize by manufacturer
			
			// Mobile devices
			if (manuf.includes('apple') || manuf.includes('samsung') || 
				manuf.includes('google') || manuf.includes('oneplus') || 
				manuf.includes('xiaomi') || manuf.includes('huawei') ||
				manuf.includes('motorola') || manuf.includes('lg electronics') ||
				manuf.includes('nokia') || manuf.includes('sony')) {
				return 'mobile';
			}
			
			// Laptops/computers
			if (manuf.includes('dell') || manuf.includes('hp') || 
				manuf.includes('lenovo') || manuf.includes('asus') || 
				manuf.includes('acer') || manuf.includes('microsoft') ||
				manuf.includes('intel corporate') || manuf.includes('realtek') ||
				manuf.includes('broadcom') || manuf.includes('qualcomm')) {
				return 'laptop';
			}
			
			// If unknown manufacturer but it's a client, likely mobile or laptop
			// Make an educated guess based on other factors
			if (manuf === 'unknown' || !manuf) {
				// Default clients to unknown, but they'll still be counted
				return 'unknown';
			}
		}
		
		// IoT devices
		if (manuf.includes('amazon') || manuf.includes('ring') || 
			manuf.includes('nest') || manuf.includes('sonos') ||
			manuf.includes('roku') || type.includes('iot') ||
			manuf.includes('espressif') || manuf.includes('raspberry') ||
			manuf.includes('texas instruments')) {
			return 'iot';
		}
		
		// Additional mobile manufacturers
		if (manuf.includes('apple') || manuf.includes('samsung') || 
			manuf.includes('google') || manuf.includes('oneplus') || 
			manuf.includes('xiaomi') || manuf.includes('huawei') ||
			manuf.includes('motorola') || manuf.includes('lg electronics')) {
			return 'mobile';
		}
		
		// Additional laptop/computer manufacturers
		if (manuf.includes('dell') || manuf.includes('hp') || 
			manuf.includes('lenovo') || manuf.includes('asus') || 
			manuf.includes('acer') || manuf.includes('microsoft') ||
			manuf.includes('intel corporate')) {
			return 'laptop';
		}
		
		// Everything else
		return 'unknown';
	}
	
	function isThreadDevice(device: KismetDevice): boolean {
		// Check for suspicious patterns
		if (device.ssid?.includes('deauth')) return true;
		const signal = typeof device.signal === 'object' ? device.signal?.last_signal : device.signal;
		if (device.type === 'Unknown' && signal && typeof signal === 'number' && signal < -30) return true;
		// Add more threat detection logic here
		return false;
	}
	
	function getSignalColor(signal: number): string {
		if (signal >= -50) return '#10b981'; // green
		if (signal >= -70) return '#f59e0b'; // amber
		return '#ef4444'; // red
	}
	
	function formatLastSeen(timestamp: number): string {
		const now = Date.now();
		// Check if timestamp is already in milliseconds
		const ts = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
		const diff = now - ts;
		
		if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		return `${Math.floor(diff / 3600000)}h ago`;
	}
	
	function filterByCategory(category: string) {
		if (selectedCategory === category) {
			// Deselect if clicking same category
			selectedCategory = null;
		} else {
			selectedCategory = category;
		}
		updateFilteredDevices();
	}
	
	function updateFilteredDevices() {
		if (!selectedCategory) {
			filteredDevices = devices;
		} else if (selectedCategory === 'drone') {
			filteredDevices = devices.filter(device => isDrone(device));
		} else {
			filteredDevices = devices.filter(device => {
				// Skip drones if filtering by other categories
				if (isDrone(device)) return false;
				return getDeviceType(device) === selectedCategory;
			});
		}
	}
	
	function selectDevice(device: KismetDevice) {
		selectedDevice = device;
		showDeviceDetail = true;
	}
	
	function closeDeviceDetail() {
		showDeviceDetail = false;
		selectedDevice = null;
	}
	
	onMount(() => {
		// Initial setup handled by reactive statement
	});
	
	onDestroy(() => {
		if (updateInterval) {
			clearInterval(updateInterval);
			updateInterval = undefined;
		}
	});
	
	$: if (isOpen) {
		if (!updateInterval) {
			// Show loading only on first open
			isLoading = true;
			// Reset and initialize filteredDevices
			filteredDevices = [];
			// Initial fetch
			fetchKismetData();
			// Set up polling
			updateInterval = setInterval(fetchKismetData, 5000);
		}
	} else {
		// Clean up when closed
		if (updateInterval) {
			clearInterval(updateInterval);
			updateInterval = undefined;
		}
		// Reset state when closing
		isLoading = false;
		selectedCategory = null;
		selectedDevice = null;
		showDeviceDetail = false;
		devices = [];
		filteredDevices = [];
	}
</script>

{#if isOpen}
<div class="overlay-backdrop" on:click={onClose}>
	<div class="overlay-container" on:click|stopPropagation>
		<!-- Header -->
		<div class="overlay-header">
			<h2>🛡️ Kismet Dashboard</h2>
			<button class="close-button" on:click={onClose}>×</button>
		</div>
		
		<!-- Loading Indicator -->
		{#if isLoading && devices.length === 0}
		<div class="loading-container">
			<div class="loading-spinner"></div>
			<p>Loading devices...</p>
		</div>
		{/if}
		
		<!-- Status Cards -->
		<div class="status-cards">
			<div class="status-card">
				<div class="status-label">System Status</div>
				<div class="status-value {kismetStatus}">
					{#if kismetStatus === 'running'}
						🟢 Running
					{:else if kismetStatus === 'stopped'}
						🔴 Stopped
					{:else}
						🟡 Checking...
					{/if}
				</div>
			</div>
			
			<div class="status-card">
				<div class="status-label">Active Devices</div>
				<div class="status-value">{totalDevices}</div>
			</div>
			
			<div class="status-card highlight">
				<div class="status-label">Drones Detected</div>
				<div class="status-value drone">{droneCount}</div>
			</div>
			
			<div class="status-card">
				<div class="status-label">Threat Level</div>
				<div class="status-value threat-{activeThreats > 0 ? 'high' : 'low'}">
					{activeThreats > 0 ? `⚠️ ${activeThreats} Alerts` : '✅ Clear'}
				</div>
			</div>
		</div>
		
		<!-- Device Breakdown -->
		<div class="device-breakdown">
			<h3>Device Breakdown</h3>
			<div class="breakdown-grid">
				<button 
					class="breakdown-item {selectedCategory === 'mobile' ? 'selected' : ''}"
					on:click={() => filterByCategory('mobile')}
				>
					<span class="device-icon">📱</span>
					<span class="device-type">Mobile</span>
					<span class="device-count">{deviceBreakdown.mobile}</span>
				</button>
				<button 
					class="breakdown-item {selectedCategory === 'laptop' ? 'selected' : ''}"
					on:click={() => filterByCategory('laptop')}
				>
					<span class="device-icon">💻</span>
					<span class="device-type">Laptop</span>
					<span class="device-count">{deviceBreakdown.laptop}</span>
				</button>
				<button 
					class="breakdown-item {selectedCategory === 'iot' ? 'selected' : ''}"
					on:click={() => filterByCategory('iot')}
				>
					<span class="device-icon">🏠</span>
					<span class="device-type">IoT</span>
					<span class="device-count">{deviceBreakdown.iot}</span>
				</button>
				<button 
					class="breakdown-item {selectedCategory === 'ap' ? 'selected' : ''}"
					on:click={() => filterByCategory('ap')}
				>
					<span class="device-icon">📡</span>
					<span class="device-type">AP</span>
					<span class="device-count">{deviceBreakdown.ap}</span>
				</button>
				<button 
					class="breakdown-item {selectedCategory === 'drone' ? 'selected' : ''}"
					on:click={() => filterByCategory('drone')}
				>
					<span class="device-icon">🚁</span>
					<span class="device-type">Drone</span>
					<span class="device-count">{deviceBreakdown.drone}</span>
				</button>
				<button 
					class="breakdown-item {selectedCategory === 'unknown' ? 'selected' : ''}"
					on:click={() => filterByCategory('unknown')}
				>
					<span class="device-icon">❓</span>
					<span class="device-type">Unknown</span>
					<span class="device-count">{deviceBreakdown.unknown}</span>
				</button>
			</div>
		</div>
		
		<!-- Active Devices Table -->
		<div class="devices-section">
			<h3>
				{selectedCategory ? `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Devices` : 'Active Detections'}
				{#if selectedCategory}
					<button class="clear-filter" on:click={() => filterByCategory(selectedCategory || '')}>
						Clear Filter ×
					</button>
				{/if}
			</h3>
			<div class="devices-table">
				<div class="table-header">
					<div>Device/SSID</div>
					<div>Type</div>
					<div>Signal</div>
					<div>Channel</div>
					<div>Last Seen</div>
				</div>
				<div class="table-body">
					{#if filteredDevices.length === 0 && devices.length > 0}
						<!-- Fallback if filteredDevices not initialized -->
						{#each devices.slice(0, 50) as device}
							<div 
								class="table-row {isDrone(device) ? 'drone-row' : ''} clickable"
								on:click={() => selectDevice(device)}
								role="button"
								tabindex="0"
								on:keypress={(e) => e.key === 'Enter' && selectDevice(device)}
							>
								<div class="device-name">
									{#if isDrone(device)}🚁{/if}
									{device.ssid || device.mac || 'Unknown'}
								</div>
								<div>{getDeviceType(device)}</div>
								<div>
									<span class="signal-badge" style="color: {getSignalColor(typeof device.signal === 'object' ? device.signal?.last_signal || -80 : device.signal || -80)}">
										{typeof device.signal === 'object' ? device.signal?.last_signal || 'N/A' : device.signal || 'N/A'} dBm
									</span>
								</div>
								<div>{device.channel || 'N/A'}</div>
								<div>{formatLastSeen(device.last_seen || device.last_time || Date.now())}</div>
							</div>
						{/each}
					{:else}
						{#each filteredDevices.slice(0, 50) as device}
						<div 
							class="table-row {isDrone(device) ? 'drone-row' : ''} clickable"
							on:click={() => selectDevice(device)}
							role="button"
							tabindex="0"
							on:keypress={(e) => e.key === 'Enter' && selectDevice(device)}
						>
							<div class="device-name">
								{#if isDrone(device)}🚁{/if}
								{device.ssid || device.mac || 'Unknown'}
							</div>
							<div>{getDeviceType(device)}</div>
							<div>
								<span class="signal-badge" style="color: {getSignalColor(typeof device.signal === 'object' ? device.signal?.last_signal || -80 : device.signal || -80)}">
									{typeof device.signal === 'object' ? device.signal?.last_signal || 'N/A' : device.signal || 'N/A'} dBm
								</span>
							</div>
							<div>{device.channel || 'N/A'}</div>
							<div>{formatLastSeen(device.last_seen || device.last_time || Date.now())}</div>
						</div>
					{/each}
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Device Detail Modal -->
{#if showDeviceDetail && selectedDevice}
<div class="device-detail-backdrop" on:click={closeDeviceDetail}>
	<div class="device-detail-modal" on:click|stopPropagation>
		<div class="detail-header">
			<h3>Device Details</h3>
			<button class="close-button" on:click={closeDeviceDetail}>×</button>
		</div>
		
		<div class="detail-content">
			<!-- Basic Info -->
			<div class="detail-section">
				<h4>Basic Information</h4>
				<div class="detail-row">
					<span class="detail-label">SSID:</span>
					<span class="detail-value">{selectedDevice.ssid || 'N/A'}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">MAC Address:</span>
					<span class="detail-value">{selectedDevice.mac || 'Unknown'}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Manufacturer:</span>
					<span class="detail-value">{selectedDevice.manufacturer || 'Unknown'}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Type:</span>
					<span class="detail-value">{selectedDevice.type || 'Unknown'}</span>
				</div>
			</div>
			
			<!-- Signal Info -->
			<div class="detail-section">
				<h4>Signal Information</h4>
				<div class="detail-row">
					<span class="detail-label">Current Signal:</span>
					<span class="detail-value" style="color: {getSignalColor(selectedDevice.signal?.last_signal || -80)}">
						{selectedDevice.signal?.last_signal || 'N/A'} dBm
					</span>
				</div>
				{#if selectedDevice.signal?.max_signal}
				<div class="detail-row">
					<span class="detail-label">Max Signal:</span>
					<span class="detail-value">{selectedDevice.signal.max_signal} dBm</span>
				</div>
				{/if}
				{#if selectedDevice.signal?.min_signal}
				<div class="detail-row">
					<span class="detail-label">Min Signal:</span>
					<span class="detail-value">{selectedDevice.signal.min_signal} dBm</span>
				</div>
				{/if}
				<div class="detail-row">
					<span class="detail-label">Channel:</span>
					<span class="detail-value">{selectedDevice.channel || 'N/A'}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Frequency:</span>
					<span class="detail-value">{selectedDevice.frequency || 'N/A'} MHz</span>
				</div>
			</div>
			
			<!-- Activity Info -->
			<div class="detail-section">
				<h4>Activity</h4>
				<div class="detail-row">
					<span class="detail-label">Last Seen:</span>
					<span class="detail-value">{formatLastSeen(selectedDevice.last_seen || Date.now())}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Packets:</span>
					<span class="detail-value">{selectedDevice.packets || 0}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Data Size:</span>
					<span class="detail-value">{selectedDevice.datasize || 0} bytes</span>
				</div>
			</div>
			
			<!-- Location Info if available -->
			{#if selectedDevice.location}
			<div class="detail-section">
				<h4>Location</h4>
				<div class="detail-row">
					<span class="detail-label">Latitude:</span>
					<span class="detail-value">{selectedDevice.location.lat?.toFixed(6) || 'N/A'}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Longitude:</span>
					<span class="detail-value">{selectedDevice.location.lon?.toFixed(6) || 'N/A'}</span>
				</div>
			</div>
			{/if}
			
			<!-- Classification -->
			<div class="detail-section">
				<h4>Classification</h4>
				<div class="detail-row">
					<span class="detail-label">Device Category:</span>
					<span class="detail-value">
						{#if isDrone(selectedDevice)}
							🚁 Drone
						{:else}
							{getDeviceType(selectedDevice).charAt(0).toUpperCase() + getDeviceType(selectedDevice).slice(1)}
						{/if}
					</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Threat Status:</span>
					<span class="detail-value {isThreadDevice(selectedDevice) ? 'threat' : 'safe'}">
						{isThreadDevice(selectedDevice) ? '⚠️ Potential Threat' : '✅ Normal'}
					</span>
				</div>
			</div>
		</div>
	</div>
</div>
{/if}
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
		z-index: 1000;
		padding: 1rem;
	}
	
	.overlay-container {
		background: #1a1a1a;
		border: 1px solid #444;
		border-radius: 8px;
		max-width: 900px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
	}
	
	.overlay-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #444;
		background: #2a2a2a;
		position: sticky;
		top: 0;
		z-index: 10;
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
	
	.status-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		padding: 1.5rem;
	}
	
	.status-card {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 6px;
		padding: 1.25rem;
		text-align: center;
	}
	
	.status-card.highlight {
		border-color: #3b82f6;
		background: linear-gradient(135deg, #2a2a2a 0%, #1e3a8a 100%);
	}
	
	.status-label {
		color: #888;
		font-size: 0.875rem;
		margin-bottom: 0.5rem;
	}
	
	.status-value {
		font-size: 1.5rem;
		font-weight: 600;
		color: #fff;
	}
	
	.status-value.running {
		color: #10b981;
	}
	
	.status-value.stopped {
		color: #ef4444;
	}
	
	.status-value.drone {
		color: #3b82f6;
	}
	
	.status-value.threat-high {
		color: #f59e0b;
	}
	
	.status-value.threat-low {
		color: #10b981;
	}
	
	.device-breakdown {
		padding: 0 1.5rem 1.5rem;
	}
	
	.device-breakdown h3 {
		color: #fff;
		margin-bottom: 1rem;
	}
	
	.breakdown-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
	}
	
	.breakdown-item {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 6px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
		font-size: inherit;
		color: inherit;
	}
	
	.breakdown-item:hover {
		background: #333;
		border-color: #555;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}
	
	.breakdown-item.selected {
		background: #1e3a8a;
		border-color: #3b82f6;
		box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
	}
	
	.breakdown-item.selected:hover {
		background: #1e40af;
		border-color: #60a5fa;
	}
	
	.device-icon {
		font-size: 2rem;
	}
	
	.device-type {
		color: #888;
		font-size: 0.875rem;
	}
	
	.device-count {
		font-size: 1.25rem;
		font-weight: 600;
		color: #fff;
	}
	
	.devices-section {
		padding: 0 1.5rem 1.5rem;
	}
	
	.devices-section h3 {
		color: #fff;
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	
	.clear-filter {
		background: #444;
		border: 1px solid #666;
		color: #ccc;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
	}
	
	.clear-filter:hover {
		background: #555;
		border-color: #777;
		color: #fff;
	}
	
	.devices-table {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 6px;
		overflow: hidden;
	}
	
	.table-header {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
		padding: 0.75rem 1rem;
		background: #333;
		border-bottom: 1px solid #444;
		color: #888;
		font-size: 0.875rem;
		font-weight: 600;
	}
	
	.table-body {
		max-height: 300px;
		overflow-y: auto;
	}
	
	.table-row {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #333;
		color: #ccc;
		font-size: 0.875rem;
		transition: background 0.2s;
	}
	
	.table-row:hover {
		background: #333;
	}
	
	.table-row.drone-row {
		background: rgba(59, 130, 246, 0.1);
		border-left: 3px solid #3b82f6;
	}
	
	.device-name {
		font-weight: 500;
		color: #fff;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.signal-badge {
		font-weight: 600;
	}
	
	/* Mobile responsive */
	@media (max-width: 768px) {
		.overlay-container {
			max-height: 100vh;
			border-radius: 0;
		}
		
		.status-cards {
			grid-template-columns: repeat(2, 1fr);
			gap: 0.5rem;
			padding: 1rem;
		}
		
		.table-header,
		.table-row {
			grid-template-columns: 2fr 1fr 1fr;
		}
		
		.table-header > div:nth-child(4),
		.table-row > div:nth-child(4) {
			display: none;
		}
		
		.table-header > div:last-child,
		.table-row > div:last-child {
			display: none;
		}
	}
	
	/* Clickable rows */
	.table-row.clickable {
		cursor: pointer;
	}
	
	.table-row.clickable:hover {
		background: #3a3a3a;
		transform: translateX(2px);
	}
	
	/* Device Detail Modal */
	.device-detail-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
		padding: 1rem;
	}
	
	.device-detail-modal {
		background: #1a1a1a;
		border: 1px solid #444;
		border-radius: 8px;
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
	}
	
	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #444;
		background: #2a2a2a;
		position: sticky;
		top: 0;
		z-index: 10;
	}
	
	.detail-header h3 {
		margin: 0;
		color: #fff;
		font-size: 1.25rem;
	}
	
	.detail-content {
		padding: 1.5rem;
	}
	
	.detail-section {
		margin-bottom: 2rem;
	}
	
	.detail-section:last-child {
		margin-bottom: 0;
	}
	
	.detail-section h4 {
		color: #3b82f6;
		margin: 0 0 1rem 0;
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	
	.detail-row {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid #333;
	}
	
	.detail-row:last-child {
		border-bottom: none;
	}
	
	.detail-label {
		color: #888;
		font-weight: 500;
	}
	
	.detail-value {
		color: #fff;
		text-align: right;
		font-family: monospace;
		word-break: break-all;
		max-width: 60%;
	}
	
	.detail-value.threat {
		color: #f59e0b;
		font-weight: 600;
	}
	
	.detail-value.safe {
		color: #10b981;
	}
	
	/* Mobile responsive for detail modal */
	@media (max-width: 768px) {
		.device-detail-modal {
			max-height: 100vh;
			border-radius: 0;
		}
		
		.detail-content {
			padding: 1rem;
		}
		
		.detail-row {
			flex-direction: column;
			gap: 0.25rem;
		}
		
		.detail-value {
			text-align: left;
			max-width: 100%;
		}
	}
	
	/* Loading overlay */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px;
		color: #888;
	}
	
	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #444;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}
	
	.loading-container p {
		color: #888;
		font-size: 14px;
		margin: 0;
	}
	
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>