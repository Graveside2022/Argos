<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { kismetStore } from '$lib/stores/kismet';

	let stats = {
		totalDevices: 0,
		totalNetworks: 0,
		activeDevices: 0,
		packetsPerSecond: 0,
		dataRate: '0 KB/s',
		uptime: '00:00:00',
		lastUpdate: new Date()
	};

	let unsubscribe: () => void;
	let updateInterval: NodeJS.Timeout;

	onMount(() => {
		unsubscribe = kismetStore.subscribe(($store) => {
			// Update stats from store
			stats.totalDevices = $store.devices.length;
			stats.totalNetworks = $store.networks.length;

			// Count active devices (seen in last 5 minutes)
			const fiveMinutesAgo = Date.now() / 1000 - 300;
			stats.activeDevices = $store.devices.filter((d) => d.last_seen > fiveMinutesAgo).length;

			stats.lastUpdate = new Date();
		});

		// Update uptime counter every second
		updateInterval = setInterval(() => {
			updateUptime();
		}, 1000);

		// Simulate packet rate updates
		simulatePacketStats();
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
		if (updateInterval) clearInterval(updateInterval);
	});

	function updateUptime() {
		const kismetStatus = kismetStore.getStatus();
		if (kismetStatus.kismet_running && kismetStatus.startTime) {
			const elapsed = Date.now() - kismetStatus.startTime;
			const hours = Math.floor(elapsed / 3600000);
			const minutes = Math.floor((elapsed % 3600000) / 60000);
			const seconds = Math.floor((elapsed % 60000) / 1000);
			stats.uptime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		} else {
			stats.uptime = '00:00:00';
		}
	}

	function simulatePacketStats() {
		// In a real implementation, these would come from Kismet
		setInterval(() => {
			if (kismetStore.getStatus().kismet_running) {
				stats.packetsPerSecond = Math.floor(Math.random() * 500) + 100;
				const dataRate = Math.random() * 2048 + 512; // KB/s
				stats.dataRate =
					dataRate > 1024
						? `${(dataRate / 1024).toFixed(1)} MB/s`
						: `${dataRate.toFixed(0)} KB/s`;
			} else {
				stats.packetsPerSecond = 0;
				stats.dataRate = '0 KB/s';
			}
		}, 2000);
	}

	function formatNumber(num: number): string {
		return num.toLocaleString();
	}
</script>

<div class="statistics-panel">
	<div class="stats-header">
		<h3>Statistics</h3>
		<span class="last-update" title={stats.lastUpdate.toLocaleString()}>
			Updated {stats.lastUpdate.toLocaleTimeString()}
		</span>
	</div>

	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-icon">📊</div>
			<div class="stat-content">
				<div class="stat-value">{formatNumber(stats.totalDevices)}</div>
				<div class="stat-label">Total Devices</div>
			</div>
			<div class="stat-indicator" class:positive={stats.totalDevices > 0}></div>
		</div>

		<div class="stat-card">
			<div class="stat-icon">📡</div>
			<div class="stat-content">
				<div class="stat-value">{formatNumber(stats.totalNetworks)}</div>
				<div class="stat-label">Networks</div>
			</div>
			<div class="stat-indicator" class:positive={stats.totalNetworks > 0}></div>
		</div>

		<div class="stat-card">
			<div class="stat-icon">🟢</div>
			<div class="stat-content">
				<div class="stat-value">{formatNumber(stats.activeDevices)}</div>
				<div class="stat-label">Active Devices</div>
			</div>
			<div class="stat-indicator" class:positive={stats.activeDevices > 0}></div>
		</div>

		<div class="stat-card">
			<div class="stat-icon">📦</div>
			<div class="stat-content">
				<div class="stat-value">{formatNumber(stats.packetsPerSecond)}</div>
				<div class="stat-label">Packets/sec</div>
			</div>
			<div class="stat-indicator animated" class:positive={stats.packetsPerSecond > 0}></div>
		</div>

		<div class="stat-card">
			<div class="stat-icon">📈</div>
			<div class="stat-content">
				<div class="stat-value">{stats.dataRate}</div>
				<div class="stat-label">Data Rate</div>
			</div>
			<div class="stat-indicator animated" class:positive={stats.dataRate !== '0 KB/s'}></div>
		</div>

		<div class="stat-card">
			<div class="stat-icon">⏱️</div>
			<div class="stat-content">
				<div class="stat-value">{stats.uptime}</div>
				<div class="stat-label">Uptime</div>
			</div>
			<div class="stat-indicator" class:positive={stats.uptime !== '00:00:00'}></div>
		</div>
	</div>

	<div class="stats-footer">
		<div class="channel-distribution">
			<h4>Channel Distribution</h4>
			<div class="channel-bars">
				{#each Array(14) as _, i}
					<div class="channel-bar" title="Channel {i + 1}">
						<div class="channel-fill" style="height: {Math.random() * 80 + 20}%"></div>
						<span class="channel-num">{i + 1}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.statistics-panel {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: rgba(12, 22, 48, 0.65);
		border: 1px solid rgba(0, 190, 215, 0.35);
		border-radius: 8px;
		overflow: hidden;
	}

	.stats-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: rgba(12, 22, 48, 0.85);
		border-bottom: 2px solid #00d2ff;
		box-shadow: 0 0 20px rgba(0, 220, 255, 0.5);
	}

	.stats-header h3 {
		margin: 0;
		font-size: 1em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 2px;
		color: #fff;
		text-shadow: 0 0 10px rgba(124, 58, 237, 0.8);
	}

	.last-update {
		font-size: 0.75em;
		color: #737373;
		font-family: 'Courier New', monospace;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 12px;
		padding: 16px;
		flex: 1;
		align-content: start;
		overflow-y: auto;
	}

	.stat-card {
		background: rgba(0, 50, 80, 0.3);
		border: 1px solid rgba(0, 190, 215, 0.2);
		border-radius: 8px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.stat-card:hover {
		background: rgba(0, 70, 100, 0.4);
		border-color: rgba(0, 190, 215, 0.4);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 210, 255, 0.2);
	}

	.stat-icon {
		font-size: 2em;
		margin-bottom: 8px;
		filter: drop-shadow(0 0 8px rgba(0, 210, 255, 0.5));
	}

	.stat-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.stat-value {
		font-size: 1.8em;
		font-weight: 700;
		color: #00d2ff;
		text-shadow: 0 0 10px rgba(0, 210, 255, 0.6);
		line-height: 1;
		margin-bottom: 4px;
		font-family: 'Courier New', monospace;
	}

	.stat-label {
		font-size: 0.8em;
		color: #c0e8ff;
		text-transform: uppercase;
		letter-spacing: 1px;
		font-weight: 500;
	}

	.stat-indicator {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: rgba(100, 100, 100, 0.3);
		transition: all 0.3s ease;
	}

	.stat-indicator.positive {
		background: linear-gradient(90deg, transparent 0%, #44ff44 50%, transparent 100%);
		box-shadow: 0 0 10px #44ff44;
	}

	.stat-indicator.animated.positive {
		animation: indicator-pulse 2s ease-in-out infinite;
	}

	@keyframes indicator-pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}

	.stats-footer {
		padding: 16px;
		border-top: 1px solid rgba(0, 190, 215, 0.2);
		background: rgba(12, 22, 48, 0.5);
	}

	.channel-distribution h4 {
		margin: 0 0 12px 0;
		font-size: 0.9em;
		color: #c0e8ff;
		text-transform: uppercase;
		letter-spacing: 1px;
		font-weight: 600;
	}

	.channel-bars {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		height: 60px;
		gap: 2px;
		position: relative;
		padding-bottom: 20px;
	}

	.channel-bar {
		flex: 1;
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
	}

	.channel-fill {
		width: 100%;
		background: linear-gradient(to top, #00d2ff, rgba(0, 210, 255, 0.3));
		border-radius: 2px 2px 0 0;
		transition: height 0.5s ease;
		position: relative;
		box-shadow: 0 0 8px rgba(0, 210, 255, 0.4);
	}

	.channel-num {
		position: absolute;
		bottom: -16px;
		font-size: 0.7em;
		color: #737373;
	}

	/* Mobile optimization */
	@media (max-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
			padding: 12px;
		}

		.stat-card {
			padding: 12px;
		}

		.stat-icon {
			font-size: 1.5em;
		}

		.stat-value {
			font-size: 1.4em;
		}

		.stat-label {
			font-size: 0.75em;
		}

		.channel-bars {
			height: 50px;
		}

		.channel-num {
			font-size: 0.6em;
		}
	}

	/* Very small screens */
	@media (max-width: 480px) {
		.stats-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
