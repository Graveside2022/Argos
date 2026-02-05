<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Map as LeafletMap } from 'leaflet';
	import { browser } from '$app/environment';
	import { MAP_CONFIG } from '$lib/config/mapConfig';

	let map: LeafletMap | undefined;
	let mapContainer: HTMLDivElement;
	let L: typeof import('leaflet');

	// Drone tracking data
	let activeDrones = new Map<string, any>();
	let droneMarkers = new Map<string, any>();
	let dronePaths = new Map<string, any>();

	// WebSocket connection
	let ws: WebSocket | null = null;
	let isConnected = false;
	let reconnectTimer: number | null = null;
	let reconnectAttempts = 0;
	const maxReconnectAttempts = 10;
	const reconnectDelay = 5000; // 5 seconds

	// Service control
	let isServiceRunning = false;
	let isStartingStopping = false;

	// Map initialization
	async function initializeMap() {
		if (!browser) return;

		L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');

		// Initialize map
		map = L.map(mapContainer).setView([46.5197, 6.6323], 13); // Default to Lausanne

		// Use OpenStreetMap tiles directly (offline tiles not required for DroneID)
		const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

		L.tileLayer(tileUrl, {
			attribution: MAP_CONFIG.attribution,
			maxZoom: MAP_CONFIG.maxZoom,
			minZoom: MAP_CONFIG.minZoom
		}).addTo(map);

		// Add controls
		L.control.scale().addTo(map);

		// Try to get user location
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition((position) => {
				map?.setView([position.coords.latitude, position.coords.longitude], 15);
			});
		}
	}

	// Connect to RemoteIDReceiver backend
	function connectWebSocket() {
		// Clear any existing reconnect timer
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}

		// Don't reconnect if service is not running or we've exceeded max attempts
		if (!isServiceRunning || reconnectAttempts >= maxReconnectAttempts) {
			console.log(
				'WebSocket connection aborted:',
				!isServiceRunning ? 'service not running' : 'max reconnect attempts reached'
			);
			return;
		}

		try {
			// RemoteIDReceiver runs on port 8081 to avoid conflict with GSM Evil
			// Since we're accessing from browser at 100.79.154.94, use that IP with port 8081
			const wsUrl = `ws://${window.location.hostname}:8081/ws`;
			console.log(
				`Connecting to: ${wsUrl} (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`
			);
			ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				isConnected = true;
				reconnectAttempts = 0; // Reset on successful connection
				console.log('Connected to RemoteIDReceiver backend');
			};

			ws.onmessage = (event) => {
				const drones = JSON.parse(event.data);
				// RemoteIDReceiver sends an array of MinimalDroneDto objects
				if (Array.isArray(drones)) {
					drones.forEach(handleRemoteIDData);
				}
			};

			ws.onclose = () => {
				isConnected = false;
				ws = null;
				// Only retry if service is still running
				if (isServiceRunning) {
					reconnectAttempts++;
					if (reconnectAttempts < maxReconnectAttempts) {
						console.log(
							`WebSocket closed, retrying in ${reconnectDelay / 1000} seconds...`
						);
						reconnectTimer = setTimeout(
							connectWebSocket,
							reconnectDelay
						) as unknown as number;
					} else {
						console.error('Max reconnection attempts reached');
					}
				}
			};

			ws.onerror = (error) => {
				console.error('WebSocket error:', error);
			};
		} catch (error) {
			console.error('Failed to connect:', error);
			// Schedule retry on connection failure
			if (isServiceRunning && reconnectAttempts < maxReconnectAttempts) {
				reconnectAttempts++;
				reconnectTimer = setTimeout(connectWebSocket, reconnectDelay) as unknown as number;
			}
		}
	}

	// Handle RemoteIDReceiver drone data format
	function handleRemoteIDData(data: any) {
		if (!map || !L) return;

		const { sender_id, position, spoofed } = data;

		if (!position || !position.lat || !position.lng) return;

		const droneData = {
			id: sender_id,
			lat: position.lat,
			lon: position.lng,
			spoofed: spoofed || false,
			// RemoteIDReceiver doesn't provide these in MinimalDroneDto
			altitude: 0,
			speed: 0,
			heading: 0
		};

		// Update or create drone marker
		if (droneMarkers.has(sender_id)) {
			// Update existing marker
			const marker = droneMarkers.get(sender_id);
			marker.setLatLng([position.lat, position.lng]);
			marker.setPopupContent(createPopupContent(droneData));
		} else {
			// Create new marker
			const droneIcon = L.divIcon({
				html: `<div class="drone-marker">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
						<path d="M21 16V14L13 9V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z"/>
					</svg>
				</div>`,
				className: spoofed ? 'drone-icon spoofed' : 'drone-icon',
				iconSize: [32, 32],
				iconAnchor: [16, 16]
			});

			const marker = L.marker([position.lat, position.lng], { icon: droneIcon })
				.bindPopup(createPopupContent(droneData))
				.addTo(map);

			droneMarkers.set(sender_id, marker);
		}

		// Update flight path
		updateFlightPath(sender_id, position.lat, position.lng, 0);

		// Update active drones list
		activeDrones.set(sender_id, { ...droneData, lastSeen: Date.now() });
	}

	function createPopupContent(data: any): string {
		return `
			<div class="drone-popup">
				<h3>Drone ID: ${data.id}</h3>
				<p><strong>Position:</strong> ${data.lat.toFixed(6)}, ${data.lon.toFixed(6)}</p>
				${data.spoofed ? `<p class="spoofed-warning"><strong>⚠️ Spoofed Signal</strong></p>` : ''}
				<p class="note">Basic position data from Remote ID</p>
			</div>
		`;
	}

	function updateFlightPath(id: string, lat: number, lon: number, altitude: number) {
		if (!map || !L) return;

		if (!dronePaths.has(id)) {
			// Create new path
			const path = L.polyline([], {
				color: getAltitudeColor(altitude),
				weight: 3,
				opacity: 0.7
			}).addTo(map);
			dronePaths.set(id, { polyline: path, points: [] });
		}

		const pathData = dronePaths.get(id);
		pathData.points.push([lat, lon]);

		// Keep only last 100 points
		if (pathData.points.length > 100) {
			pathData.points.shift();
		}

		pathData.polyline.setLatLngs(pathData.points);
		pathData.polyline.setStyle({ color: getAltitudeColor(altitude) });
	}

	function getAltitudeColor(altitude: number): string {
		// Color gradient based on altitude
		if (altitude < 50) return '#10b981'; // green
		if (altitude < 120) return '#f59e0b'; // amber
		return '#ef4444'; // red
	}

	// Clean up old drones
	function cleanupOldDrones() {
		const timeout = 60000; // 1 minute
		const now = Date.now();

		activeDrones.forEach((drone, id) => {
			if (now - drone.lastSeen > timeout) {
				// Remove from map
				const marker = droneMarkers.get(id);
				if (marker && map) {
					map.removeLayer(marker);
				}
				droneMarkers.delete(id);

				const pathData = dronePaths.get(id);
				if (pathData && map) {
					map.removeLayer(pathData.polyline);
				}
				dronePaths.delete(id);

				activeDrones.delete(id);
			}
		});
	}

	// Check service status
	async function checkServiceStatus() {
		try {
			const response = await fetch('/api/droneid');
			const data = await response.json();
			isServiceRunning = data.running;

			// If service claims to be running but we're not connected, double-check
			if (isServiceRunning && !isConnected) {
				// Try to connect if not already trying
				if (!ws || ws.readyState === WebSocket.CLOSED) {
					connectWebSocket();
				}
			}
		} catch (error) {
			console.error('Failed to check service status:', error);
			isServiceRunning = false;
		}
	}

	// Start/stop service
	async function toggleService() {
		if (isStartingStopping) return;

		isStartingStopping = true;
		const action = isServiceRunning ? 'stop' : 'start';

		try {
			const response = await fetch('/api/droneid', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});

			const result = await response.json();

			if (result.success) {
				// Wait a bit for service to start/stop
				await new Promise((resolve) =>
					setTimeout(resolve, action === 'start' ? 3000 : 1000)
				);

				// Update status
				await checkServiceStatus();

				// Try to connect if we just started
				if (action === 'start') {
					reconnectAttempts = 0; // Reset reconnection attempts
					if (!ws || ws.readyState !== WebSocket.OPEN) {
						connectWebSocket();
					}
				} else if (action === 'stop') {
					// Immediately set service as not running to stop reconnection attempts
					isServiceRunning = false;
					// Clear any reconnect timers
					if (reconnectTimer) {
						clearTimeout(reconnectTimer);
						reconnectTimer = null;
					}
					reconnectAttempts = 0;
					if (ws) {
						ws.close();
						ws = null;
					}
				}
			} else {
				console.error('Failed to toggle service:', result.error);
				alert(`Failed to ${action} DroneID: ${result.error}`);
			}
		} catch (error) {
			console.error('Error toggling service:', error);
		} finally {
			isStartingStopping = false;
		}
	}

	onMount(() => {
		initializeMap();
		checkServiceStatus();
		// Don't auto-connect on mount - wait for user to start service

		const cleanupInterval = setInterval(cleanupOldDrones, 10000);
		const statusInterval = setInterval(checkServiceStatus, 5000);

		return () => {
			clearInterval(cleanupInterval);
			clearInterval(statusInterval);
		};
	});

	onDestroy(() => {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		if (ws) {
			ws.close();
		}
		if (map) {
			map.remove();
		}
	});
</script>

<div class="droneid-container">
	<header class="droneid-header">
		<div class="header-left">
			<a href="/" class="back-to-console-btn"> ← Back to Console </a>
			<h1>
				<span class="title-drone">Drone</span>
				<span class="title-id">ID</span>
				<span class="title-subtitle">Remote ID Detection System</span>
			</h1>
		</div>
		<div class="header-controls">
			<button
				class="service-control-btn"
				class:running={isServiceRunning}
				onclick={toggleService}
				disabled={isStartingStopping}
			>
				{#if isStartingStopping}
					<span class="spinner"></span>
					{isServiceRunning ? 'Stopping...' : 'Starting...'}
				{:else}
					{isServiceRunning ? 'Stop' : 'Start'}
				{/if}
			</button>

			<div class="connection-status" class:connected={isConnected}>
				<span class="status-dot"></span>
				<span>{isConnected ? 'Connected' : 'Disconnected'}</span>
			</div>
		</div>
	</header>

	<div class="main-content">
		<div class="map-container" bind:this={mapContainer}></div>

		<aside class="info-panel">
			<h2>Active Drones</h2>
			<div class="drone-list">
				{#if activeDrones.size === 0}
					<p class="no-drones">No drones detected</p>
				{:else}
					{#each [...activeDrones.entries()] as [id, drone]}
						<div class="drone-item" class:spoofed={drone.spoofed}>
							<h3>{id}</h3>
							<div class="drone-stats">
								<span>Lat: {drone.lat.toFixed(6)}</span>
								<span>Lon: {drone.lon.toFixed(6)}</span>
							</div>
							{#if drone.spoofed}
								<div class="spoofed-badge">Spoofed</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>

			<div class="legend">
				<h3>Altitude Legend</h3>
				<div class="legend-item">
					<span class="legend-color" style="background: #10b981"></span>
					<span>0-50m</span>
				</div>
				<div class="legend-item">
					<span class="legend-color" style="background: #f59e0b"></span>
					<span>50-120m</span>
				</div>
				<div class="legend-item">
					<span class="legend-color" style="background: #ef4444"></span>
					<span>&gt;120m</span>
				</div>
			</div>

			<div class="backend-info">
				<h3>Backend Status</h3>
				{#if !isConnected}
					<p>RemoteIDReceiver backend not connected.</p>
					<p>Start the backend to detect drones.</p>
				{:else}
					<p>Connected and scanning for Remote ID signals.</p>
				{/if}
			</div>
		</aside>
	</div>
</div>

<style>
	:global(.drone-icon) {
		background: none !important;
		border: none !important;
		color: #06b6d4;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
	}

	:global(.drone-icon.spoofed) {
		color: #f59e0b;
		filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.6));
	}

	:global(.drone-marker) {
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.3s ease;
	}

	:global(.drone-popup) {
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}

	:global(.drone-popup h3) {
		margin: 0 0 8px 0;
		color: #06b6d4;
		font-size: 14px;
		font-weight: 600;
	}

	:global(.drone-popup p) {
		margin: 4px 0;
		font-size: 12px;
	}

	:global(.drone-popup .spoofed-warning) {
		color: #f59e0b;
		font-weight: 600;
	}

	:global(.drone-popup .note) {
		color: #666;
		font-style: italic;
		font-size: 11px;
		margin-top: 8px;
	}

	.droneid-container {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: #0e1116;
		color: #e8eaed;
	}

	.droneid-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		background: rgba(28, 31, 38, 0.8);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid #262626;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.back-to-console-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: rgba(55, 65, 81, 0.5);
		color: #d1d5db;
		text-decoration: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px solid rgba(75, 85, 99, 0.3);
		transition: all 0.2s ease;
	}

	.back-to-console-btn:hover {
		background: rgba(75, 85, 99, 0.7);
		color: #e8eaed;
		border-color: rgba(107, 114, 128, 0.5);
		transform: translateX(-2px);
	}

	.droneid-header h1 {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.title-drone {
		color: #06b6d4;
	}

	.title-id {
		color: #e8eaed;
	}

	.title-subtitle {
		font-size: 0.875rem;
		color: #9aa0a6;
		font-weight: 400;
		margin-left: 1rem;
	}

	.header-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.service-control-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1.5rem;
		background: rgba(16, 185, 129, 0.1); /* Green for Start */
		border: 1px solid rgba(16, 185, 129, 0.3);
		border-radius: 20px;
		color: #10b981;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.3s ease;
		outline: none;
	}

	.service-control-btn:hover:not(:disabled) {
		background: rgba(16, 185, 129, 0.2);
		border-color: #10b981;
		transform: translateY(-1px);
	}

	.service-control-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.service-control-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.service-control-btn.running {
		background: rgba(239, 68, 68, 0.1); /* Red for Stop */
		border-color: rgba(239, 68, 68, 0.3);
		color: #ef4444;
	}

	.service-control-btn.running:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.2);
		border-color: #ef4444;
	}

	.spinner {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 2px solid transparent;
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 20px;
		font-size: 0.875rem;
		transition: all 0.3s ease;
	}

	.connection-status.connected {
		background: rgba(16, 185, 129, 0.1);
		border-color: rgba(16, 185, 129, 0.3);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ef4444;
		animation: pulse 2s infinite;
	}

	.connected .status-dot {
		background: #10b981;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.main-content {
		flex: 1;
		display: flex;
		overflow: hidden;
	}

	.map-container {
		flex: 1;
		position: relative;
	}

	.info-panel {
		width: 320px;
		background: rgba(28, 31, 38, 0.8);
		backdrop-filter: blur(10px);
		border-left: 1px solid #262626;
		padding: 1.5rem;
		overflow-y: auto;
	}

	.info-panel h2 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #06b6d4;
	}

	.drone-list {
		margin-bottom: 2rem;
	}

	.no-drones {
		color: #737373;
		font-style: italic;
		text-align: center;
		padding: 2rem 0;
	}

	.drone-item {
		background: rgba(30, 30, 30, 0.5);
		border: 1px solid #262626;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 0.75rem;
		transition: all 0.3s ease;
	}

	.drone-item:hover {
		border-color: #06b6d4;
		background: rgba(6, 182, 212, 0.05);
	}

	.drone-item.spoofed {
		border-color: rgba(245, 158, 11, 0.3);
		background: rgba(245, 158, 11, 0.05);
	}

	.drone-item.spoofed:hover {
		border-color: #f59e0b;
		background: rgba(245, 158, 11, 0.1);
	}

	.drone-item h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #06b6d4;
		font-family: 'JetBrains Mono', monospace;
	}

	.drone-stats {
		display: flex;
		gap: 1rem;
		font-size: 0.75rem;
		color: #9aa0a6;
	}

	.spoofed-badge {
		display: inline-block;
		padding: 2px 8px;
		background: rgba(245, 158, 11, 0.2);
		border: 1px solid #f59e0b;
		border-radius: 12px;
		color: #f59e0b;
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		margin-top: 0.5rem;
	}

	.legend {
		background: rgba(30, 30, 30, 0.5);
		border: 1px solid #262626;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 2rem;
	}

	.legend h3 {
		margin: 0 0 0.75rem 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #e8eaed;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
		color: #9aa0a6;
	}

	.legend-color {
		width: 24px;
		height: 3px;
		border-radius: 2px;
	}

	.backend-info {
		background: rgba(251, 146, 60, 0.1);
		border: 1px solid rgba(251, 146, 60, 0.3);
		border-radius: 8px;
		padding: 1rem;
	}

	.backend-info h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #f97316;
	}

	.backend-info p {
		margin: 0.25rem 0;
		font-size: 0.75rem;
		color: #fbbf24;
	}

	@media (max-width: 768px) {
		.info-panel {
			display: none;
		}
	}
</style>
