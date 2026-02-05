<script lang="ts">
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';

	// Define SystemInfo interface to match the API response
	interface SystemInfo {
		hostname: string;
		ip: string;
		wifiInterfaces: Array<{
			name: string;
			ip: string;
			mac: string;
		}>;
		cpu: {
			usage: number;
			model: string;
			cores: number;
		};
		memory: {
			total: number;
			used: number;
			percentage: number;
		};
		storage: {
			total: number;
			used: number;
			percentage: number;
		};
		temperature: number;
		uptime: number;
		battery?: {
			level: number;
			charging: boolean;
		};
	}

	interface Props {
		userMarker?: any;
	}

	let { userMarker = null }: Props = $props();

	let gpsState = $derived($gpsStore);

	let systemInfo: SystemInfo | null = null;

	// Fetch system information from API
	async function fetchSystemInfo(): Promise<void> {
		try {
			const response = await fetch('/api/system/info');
			if (response.ok) {
				systemInfo = (await response.json()) as SystemInfo;
			}
		} catch (error) {
			console.error('Error fetching system info:', error);
		}
	}

	// Show Pi popup with system information
	export async function showSystemPopup(): Promise<void> {
		if (!userMarker) return;

		// Fetch latest system info
		await fetchSystemInfo();

		if (!systemInfo) {
			const loadingContent = createLoadingContent();
			userMarker.setPopupContent(loadingContent);
			userMarker.openPopup();
			return;
		}

		const popupContent = createSystemInfoContent(systemInfo);
		userMarker.setPopupContent(popupContent);
		userMarker.openPopup();
	}

	function createLoadingContent(): string {
		return `
			<div style="padding: 16px; font-family: 'Courier New', monospace; color: #4ade80; text-align: center;">
				<div style="margin-bottom: 8px;">⚡ Loading system info...</div>
				<div style="font-size: 10px; color: #88ff88;">Please wait...</div>
			</div>
		`;
	}

	function createSystemInfoContent(info: SystemInfo): string {
		// Format uptime
		const hours = Math.floor(info.uptime / 3600);
		const minutes = Math.floor((info.uptime % 3600) / 60);
		const uptimeStr = `${hours}h ${minutes}m`;

		// Format storage sizes
		const formatBytes = (bytes: number): string => {
			const gb = bytes / (1024 * 1024 * 1024);
			return gb.toFixed(1) + ' GB';
		};

		// Build WiFi interfaces list
		let wifiInterfacesHtml = '';
		const wifiInterfaces = info.wifiInterfaces || [];
		if (wifiInterfaces.length > 0) {
			wifiInterfacesHtml = wifiInterfaces
				.map(
					(iface) => `
						<tr>
							<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">${iface.name}:</td>
							<td style="padding: 4px 0; font-family: monospace; color: #ffffff;">${iface.ip || 'N/A'}</td>
						</tr>
					`
				)
				.join('');
		}

		// Get GPS coordinate information
		const mgrsCoord = gpsState.status.mgrsCoord || 'Invalid';
		const formattedLat =
			gpsState.position.lat !== 0
				? `${Math.abs(gpsState.position.lat).toFixed(6)}°${gpsState.position.lat >= 0 ? 'N' : 'S'}`
				: '0.000000°N';
		const formattedLon =
			gpsState.position.lon !== 0
				? `${Math.abs(gpsState.position.lon).toFixed(6)}°${gpsState.position.lon >= 0 ? 'E' : 'W'}`
				: '0.000000°E';

		return `
			<div style="font-family: 'Courier New', monospace; min-width: 300px; color: #ffffff; background: rgba(0, 0, 0, 0.95);">
				<h3 style="margin: 0 0 12px 0; color: #00ff88; font-size: 16px; text-align: center; border-bottom: 1px solid #004400; padding-bottom: 8px;">
					🖥️ Tactical System Info
				</h3>
				<table style="width: 100%; border-collapse: collapse; font-size: 12px;">
					<tr>
						<td colspan="2" style="padding: 8px 0 4px 0; border-bottom: 1px solid #004400; margin-bottom: 8px;">
							<strong style="color: #88ff88;">📍 Position Information:</strong>
						</td>
					</tr>
					<tr>
						<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">GPS:</td>
						<td style="padding: 4px 0; font-family: monospace; color: #fbbf24;">${formattedLat}, ${formattedLon}</td>
					</tr>
					<tr>
						<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">MGRS:</td>
						<td style="padding: 4px 0; font-family: monospace; color: #fbbf24;">${mgrsCoord}</td>
					</tr>
					<tr>
						<td colspan="2" style="padding: 8px 0 4px 0; border-top: 1px solid #004400;">
							<strong style="color: #88ff88;">🌐 Network Information:</strong>
						</td>
					</tr>
					<tr>
						<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">Hostname:</td>
						<td style="padding: 4px 0; color: #ffffff;">${info.hostname}</td>
					</tr>
					<tr>
						<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">Primary IP:</td>
						<td style="padding: 4px 0; font-family: monospace; color: #ffffff;">${info.ip}</td>
					</tr>
					${wifiInterfacesHtml}
					<tr>
						<td colspan="2" style="padding: 8px 0 4px 0; border-top: 1px solid #004400;">
							<strong style="color: #88ff88;">⚡ System Resources:</strong>
						</td>
					</tr>
					<tr>
						<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">CPU:</td>
						<td style="padding: 4px 0;">
							<span style="color: ${getCpuColor(info.cpu.usage)}; font-weight: bold;">
								${info.cpu.usage.toFixed(1)}%
							</span>
							<span style="color: #888888;"> (${info.cpu.cores} cores)</span>
						</td>
					</tr>
					<tr>
						<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">Memory:</td>
						<td style="padding: 4px 0;">
							<span style="color: ${getMemoryColor(info.memory.percentage)}; font-weight: bold;">
								${info.memory.percentage.toFixed(1)}%
							</span>
							<span style="color: #888888;"> (${formatBytes(info.memory.used)} / ${formatBytes(info.memory.total)})</span>
						</td>
					</tr>
					<tr>
						<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">Storage:</td>
						<td style="padding: 4px 0;">
							<span style="color: ${getStorageColor(info.storage.percentage)}; font-weight: bold;">
								${info.storage.percentage}%
							</span>
							<span style="color: #888888;"> (${formatBytes(info.storage.used)} / ${formatBytes(info.storage.total)})</span>
						</td>
					</tr>
					<tr>
						<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">Temperature:</td>
						<td style="padding: 4px 0;">
							<span style="color: ${getTemperatureColor(info.temperature)}; font-weight: bold;">
								${info.temperature.toFixed(1)}°C
							</span>
						</td>
					</tr>
					<tr>
						<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">Uptime:</td>
						<td style="padding: 4px 0; color: #ffffff;">${uptimeStr}</td>
					</tr>
					${info.battery ? getBatteryRow(info.battery) : ''}
				</table>
			</div>
		`;
	}

	function getCpuColor(usage: number): string {
		if (usage > 80) return '#f87171'; // Red - high usage
		if (usage > 60) return '#fbbf24'; // Orange - medium usage
		return '#4ade80'; // Green - low usage
	}

	function getMemoryColor(percentage: number): string {
		if (percentage > 80) return '#f87171'; // Red - high usage
		if (percentage > 60) return '#fbbf24'; // Orange - medium usage
		return '#4ade80'; // Green - low usage
	}

	function getStorageColor(percentage: number): string {
		if (percentage > 80) return '#f87171'; // Red - high usage
		if (percentage > 60) return '#fbbf24'; // Orange - medium usage
		return '#4ade80'; // Green - low usage
	}

	function getTemperatureColor(temp: number): string {
		if (temp > 70) return '#f87171'; // Red - too hot
		if (temp > 60) return '#fbbf24'; // Orange - warm
		return '#4ade80'; // Green - normal
	}

	function getBatteryRow(battery: { level: number; charging: boolean }): string {
		const batteryColor =
			battery.level < 20 ? '#f87171' : battery.level < 50 ? '#fbbf24' : '#4ade80';
		const chargingStatus = battery.charging ? ' (Charging ⚡)' : '';

		return `
			<tr>
				<td style="padding: 4px 8px 4px 0; font-weight: bold; color: #88ff88;">Battery:</td>
				<td style="padding: 4px 0;">
					<span style="color: ${batteryColor}; font-weight: bold;">
						${battery.level}%
					</span>
					<span style="color: #888888;">${chargingStatus}</span>
				</td>
			</tr>
		`;
	}

	// Export function to refresh system info
	export async function refreshSystemInfo(): Promise<void> {
		await fetchSystemInfo();
	}

	// Auto-refresh system info periodically when popup is open
	export function startAutoRefresh(intervalMs: number = 30000): NodeJS.Timeout {
		return setInterval(async () => {
			if (userMarker && userMarker.isPopupOpen()) {
				await fetchSystemInfo();
				if (systemInfo) {
					const updatedContent = createSystemInfoContent(systemInfo);
					userMarker.setPopupContent(updatedContent);
				}
			}
		}, intervalMs);
	}
</script>

<!-- This component manages system information display in popups -->
<!-- It has no visual representation but provides system info functionality -->
