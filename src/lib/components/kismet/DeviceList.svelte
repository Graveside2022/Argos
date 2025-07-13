<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { kismetStore } from '$lib/stores/kismet';
	import type { KismetDevice } from '$lib/types/kismet';

	export let maxItems = 10;
	export let showEmpty = true;
	
	let devices: KismetDevice[] = [];
	let unsubscribe: () => void;

	onMount(() => {
		unsubscribe = kismetStore.subscribe($store => {
			devices = $store.devices
				.sort((a, b) => b.last_seen - a.last_seen)
				.slice(0, maxItems);
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	function formatTime(timestamp: number): string {
		const now = Date.now() / 1000;
		const diff = now - timestamp;
		
		if (diff < 60) return 'Just now';
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}

	function getDeviceIcon(type: string): string {
		switch (type.toLowerCase()) {
			case 'wifi ap': return '📡';
			case 'wifi client': return '📱';
			case 'bluetooth': return '🔷';
			default: return '📶';
		}
	}

	function getSignalStrength(signal: number): { class: string; bars: number } {
		if (signal > -50) return { class: 'excellent', bars: 4 };
		if (signal > -60) return { class: 'good', bars: 3 };
		if (signal > -70) return { class: 'fair', bars: 2 };
		if (signal > -80) return { class: 'poor', bars: 1 };
		return { class: 'very-poor', bars: 0 };
	}
</script>

<div class="device-list">
	<div class="device-list-header">
		<h3>Recent Devices</h3>
		<span class="device-count">{devices.length}</span>
	</div>
	
	<div class="device-list-content">
		{#if devices.length === 0 && showEmpty}
			<div class="empty-message">No devices detected</div>
		{:else}
			{#each devices as device (device.mac)}
				<div class="device-item" class:new-device={Date.now() / 1000 - device.last_seen < 30}>
					<div class="device-header">
						<span class="device-icon">{getDeviceIcon(device.type)}</span>
						<span class="device-mac">{device.mac}</span>
						<span class="device-time">{formatTime(device.last_seen)}</span>
					</div>
					
					<div class="device-details">
						<span class="device-manufacturer">{device.manufacturer || 'Unknown'}</span>
						<span class="device-type">{device.type}</span>
						{#if device.channel > 0}
							<span class="device-channel">CH {device.channel}</span>
						{/if}
					</div>
					
					<div class="device-signal">
						<span class="signal-value">{device.signal.last_signal || -100} dBm</span>
						<div class="signal-bars signal-{getSignalStrength(device.signal.last_signal || -100).class}">
							{#each Array(4) as _, i}
								<div 
									class="signal-bar" 
									class:active={i < getSignalStrength(device.signal.last_signal || -100).bars}
								/>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.device-list {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: rgba(12, 22, 48, 0.65);
		border: 1px solid rgba(0, 190, 215, 0.35);
		border-radius: 8px;
		overflow: hidden;
	}

	.device-list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: rgba(12, 22, 48, 0.85);
		border-bottom: 2px solid #00d2ff;
		box-shadow: 0 0 20px rgba(0, 220, 255, 0.5);
	}

	.device-list-header h3 {
		margin: 0;
		font-size: 1em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 2px;
		color: #fff;
		text-shadow: 0 0 10px rgba(124, 58, 237, 0.8);
	}

	.device-count {
		background: rgba(0, 210, 255, 0.2);
		color: #00d2ff;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 0.85em;
		font-weight: 600;
		border: 1px solid rgba(0, 210, 255, 0.5);
	}

	.device-list-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		scrollbar-width: thin;
		scrollbar-color: rgba(124, 58, 237, 0.5) rgba(3, 6, 16, 0.5);
	}

	.device-list-content::-webkit-scrollbar {
		width: 6px;
	}

	.device-list-content::-webkit-scrollbar-track {
		background: rgba(3, 6, 16, 0.3);
		border-radius: 3px;
	}

	.device-list-content::-webkit-scrollbar-thumb {
		background-color: rgba(124, 58, 237, 0.4);
		border-radius: 3px;
		border: 1px solid rgba(124, 58, 237, 0.2);
	}

	.empty-message {
		text-align: center;
		color: #737373;
		padding: 40px 20px;
		font-size: 0.9em;
	}

	.device-item {
		background-color: rgba(0, 50, 80, 0.55);
		border-left: 3px solid #00bcd4;
		padding: 12px;
		margin-bottom: 8px;
		border-radius: 0 6px 6px 0;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.device-item:hover {
		background-color: rgba(0, 70, 100, 0.75);
		border-left-color: #00f2ff;
		transform: translateX(2px);
		box-shadow: 0 0 15px rgba(0, 220, 255, 0.3);
	}

	.device-item.new-device {
		animation: device-blink 2s ease-in-out;
		border-left-color: #44ff44;
	}

	.device-item.new-device::after {
		content: 'NEW';
		position: absolute;
		top: 8px;
		right: 8px;
		background: #44ff44;
		color: #030610;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.7em;
		font-weight: 700;
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes device-blink {
		0%, 100% { background-color: rgba(0, 50, 80, 0.55); }
		50% { background-color: rgba(68, 255, 68, 0.2); }
	}

	@keyframes pulse {
		0%, 100% { transform: scale(1); opacity: 0.9; }
		50% { transform: scale(1.05); opacity: 1; }
	}

	.device-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		font-size: 0.85em;
	}

	.device-icon {
		font-size: 1.2em;
	}

	.device-mac {
		font-family: 'Courier New', monospace;
		color: #c0e8ff;
		flex: 1;
		font-weight: 600;
	}

	.device-time {
		color: #737373;
		font-size: 0.85em;
	}

	.device-details {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 8px;
		font-size: 0.8em;
		color: rgba(0, 220, 255, 0.8);
	}

	.device-manufacturer {
		flex: 1;
		min-width: 100px;
	}

	.device-type {
		background: rgba(0, 190, 215, 0.2);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid rgba(0, 190, 215, 0.4);
	}

	.device-channel {
		background: rgba(124, 58, 237, 0.2);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid rgba(124, 58, 237, 0.4);
	}

	.device-signal {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.signal-value {
		font-size: 0.8em;
		color: #c0e8ff;
		font-family: 'Courier New', monospace;
	}

	.signal-bars {
		display: flex;
		gap: 2px;
		align-items: flex-end;
	}

	.signal-bar {
		width: 3px;
		height: 12px;
		background: rgba(100, 100, 100, 0.3);
		border-radius: 1px;
		transition: all 0.3s ease;
	}

	.signal-bar:nth-child(2) { height: 16px; }
	.signal-bar:nth-child(3) { height: 20px; }
	.signal-bar:nth-child(4) { height: 24px; }

	.signal-bar.active {
		background: #00d2ff;
		box-shadow: 0 0 8px rgba(0, 210, 255, 0.8);
	}

	.signal-excellent .signal-bar.active { background: #44ff44; box-shadow: 0 0 8px rgba(68, 255, 68, 0.8); }
	.signal-good .signal-bar.active { background: #00d2ff; }
	.signal-fair .signal-bar.active { background: #f59e0b; }
	.signal-poor .signal-bar.active { background: #ff4444; box-shadow: 0 0 8px rgba(255, 68, 68, 0.8); }

	/* Mobile optimization */
	@media (max-width: 768px) {
		.device-list-header {
			padding: 10px 12px;
		}

		.device-item {
			padding: 10px;
			margin-bottom: 6px;
		}

		.device-header {
			font-size: 0.8em;
		}

		.device-details {
			font-size: 0.75em;
		}
	}
</style>