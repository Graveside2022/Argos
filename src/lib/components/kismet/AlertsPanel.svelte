<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { kismetStore } from '$lib/stores/kismet';
	import type { KismetAlert } from '$lib/types/kismet';
	
	export let maxAlerts = 50;
	export let autoScroll = true;
	
	let alerts: KismetAlert[] = [];
	let alertsContainer: HTMLDivElement;
	let unsubscribe: () => void;
	
	// Alert types with their styling
	const alertTypes = {
		new_device: { icon: '🆕', color: '#00d2ff', label: 'New Device' },
		security: { icon: '⚠️', color: '#ff4444', label: 'Security Alert' },
		deauth: { icon: '🚫', color: '#ff4444', label: 'Deauth Attack' },
		probe: { icon: '🔍', color: '#f59e0b', label: 'Probe Request' },
		handshake: { icon: '🤝', color: '#44ff44', label: 'Handshake' },
		suspicious: { icon: '🔴', color: '#ff4444', label: 'Suspicious' },
		info: { icon: 'ℹ️', color: '#737373', label: 'Information' }
	};
	
	onMount(() => {
		unsubscribe = kismetStore.subscribe($store => {
			alerts = $store.alerts.slice(-maxAlerts);
			
			// Auto-scroll to bottom when new alerts arrive
			if (autoScroll && alertsContainer) {
				setTimeout(() => {
					alertsContainer.scrollTop = alertsContainer.scrollHeight;
				}, 100);
			}
		});
	});
	
	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});
	
	function formatTime(timestamp: number): string {
		const date = new Date(timestamp * 1000);
		return date.toLocaleTimeString('en-US', { 
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
	
	function clearAlerts() {
		kismetStore.clearAlerts();
	}
	
	function getAlertType(alert: KismetAlert) {
		return alertTypes[alert.type] || alertTypes.info;
	}
</script>

<div class="alerts-panel">
	<div class="alerts-header">
		<h3>Security Alerts</h3>
		<div class="header-controls">
			<span class="alert-count">{alerts.length}</span>
			<button 
				class="clear-button"
				on:click={clearAlerts}
				disabled={alerts.length === 0}
				title="Clear all alerts"
			>
				Clear
			</button>
		</div>
	</div>
	
	<div class="alerts-container" bind:this={alertsContainer}>
		{#if alerts.length === 0}
			<div class="empty-alerts">
				<span class="empty-icon">🛡️</span>
				<p>No security alerts</p>
				<p class="empty-subtitle">System monitoring active</p>
			</div>
		{:else}
			{#each alerts as alert (alert.id)}
				<div 
					class="alert-item alert-{alert.severity}"
					class:new-alert={Date.now() / 1000 - alert.timestamp < 5}
				>
					<div class="alert-header">
						<span class="alert-icon" style="color: {getAlertType(alert).color}">
							{getAlertType(alert).icon}
						</span>
						<span class="alert-type">{getAlertType(alert).label}</span>
						<span class="alert-time">{formatTime(alert.timestamp)}</span>
					</div>
					
					<div class="alert-content">
						<p class="alert-message">{alert.message}</p>
						
						{#if alert.details}
							<div class="alert-details">
								{#if alert.details.mac}
									<span class="detail-item">
										<span class="detail-label">MAC:</span>
										<span class="detail-value">{alert.details.mac}</span>
									</span>
								{/if}
								{#if alert.details.ssid}
									<span class="detail-item">
										<span class="detail-label">SSID:</span>
										<span class="detail-value">{alert.details.ssid}</span>
									</span>
								{/if}
								{#if alert.details.channel}
									<span class="detail-item">
										<span class="detail-label">CH:</span>
										<span class="detail-value">{alert.details.channel}</span>
									</span>
								{/if}
								{#if alert.details.signal}
									<span class="detail-item">
										<span class="detail-label">Signal:</span>
										<span class="detail-value">{alert.details.signal} dBm</span>
									</span>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.alerts-panel {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: rgba(12, 22, 48, 0.65);
		border: 1px solid rgba(0, 190, 215, 0.35);
		border-radius: 8px;
		overflow: hidden;
	}

	.alerts-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: rgba(12, 22, 48, 0.85);
		border-bottom: 2px solid #00d2ff;
		box-shadow: 0 0 20px rgba(0, 220, 255, 0.5);
	}

	.alerts-header h3 {
		margin: 0;
		font-size: 1em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 2px;
		color: #fff;
		text-shadow: 0 0 10px rgba(124, 58, 237, 0.8);
	}

	.header-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.alert-count {
		background: rgba(255, 68, 68, 0.2);
		color: #ff4444;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 0.85em;
		font-weight: 600;
		border: 1px solid rgba(255, 68, 68, 0.5);
		min-width: 30px;
		text-align: center;
	}

	.clear-button {
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid #00d2ff;
		border-radius: 4px;
		color: #00d2ff;
		cursor: pointer;
		padding: 4px 12px;
		font-size: 0.85em;
		transition: all 0.3s ease;
		font-family: inherit;
	}

	.clear-button:hover:not(:disabled) {
		background: rgba(0, 210, 255, 0.2);
		transform: translateY(-1px);
	}

	.clear-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.alerts-container {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		scrollbar-width: thin;
		scrollbar-color: rgba(124, 58, 237, 0.5) rgba(3, 6, 16, 0.5);
	}

	.alerts-container::-webkit-scrollbar {
		width: 6px;
	}

	.alerts-container::-webkit-scrollbar-track {
		background: rgba(3, 6, 16, 0.3);
		border-radius: 3px;
	}

	.alerts-container::-webkit-scrollbar-thumb {
		background-color: rgba(124, 58, 237, 0.4);
		border-radius: 3px;
		border: 1px solid rgba(124, 58, 237, 0.2);
	}

	.empty-alerts {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		color: #737373;
		padding: 40px 20px;
	}

	.empty-icon {
		font-size: 3em;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-alerts p {
		margin: 4px 0;
		font-size: 0.9em;
	}

	.empty-subtitle {
		font-size: 0.8em;
		opacity: 0.7;
	}

	.alert-item {
		background-color: rgba(0, 50, 80, 0.55);
		border-left: 3px solid #737373;
		padding: 12px;
		margin-bottom: 8px;
		border-radius: 0 6px 6px 0;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.alert-item.alert-high {
		border-left-color: #ff4444;
		background-color: rgba(80, 0, 0, 0.3);
	}

	.alert-item.alert-medium {
		border-left-color: #f59e0b;
		background-color: rgba(80, 50, 0, 0.3);
	}

	.alert-item.alert-low {
		border-left-color: #00d2ff;
	}

	.alert-item.new-alert {
		animation: alert-flash 1s ease-in-out;
	}

	@keyframes alert-flash {
		0%, 100% { background-color: inherit; }
		50% { background-color: rgba(255, 255, 255, 0.1); }
	}

	.alert-item:hover {
		background-color: rgba(0, 70, 100, 0.75);
		transform: translateX(2px);
	}

	.alert-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		font-size: 0.85em;
	}

	.alert-icon {
		font-size: 1.2em;
		filter: drop-shadow(0 0 4px currentColor);
	}

	.alert-type {
		flex: 1;
		font-weight: 600;
		color: #c0e8ff;
	}

	.alert-time {
		font-family: 'Courier New', monospace;
		color: #737373;
		font-size: 0.85em;
	}

	.alert-content {
		margin-left: 28px;
	}

	.alert-message {
		margin: 0 0 8px 0;
		color: #d0d8f0;
		font-size: 0.9em;
		line-height: 1.4;
	}

	.alert-details {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		font-size: 0.8em;
	}

	.detail-item {
		display: flex;
		gap: 4px;
		background: rgba(0, 0, 0, 0.3);
		padding: 2px 8px;
		border-radius: 4px;
		border: 1px solid rgba(0, 190, 215, 0.2);
	}

	.detail-label {
		color: #737373;
		font-weight: 500;
	}

	.detail-value {
		color: #00d2ff;
		font-family: 'Courier New', monospace;
	}

	/* Mobile optimization */
	@media (max-width: 768px) {
		.alerts-header {
			padding: 10px 12px;
		}

		.alert-item {
			padding: 10px;
			margin-bottom: 6px;
		}

		.alert-header {
			font-size: 0.8em;
		}

		.alert-message {
			font-size: 0.85em;
		}

		.alert-details {
			font-size: 0.75em;
			gap: 8px;
		}
	}
</style>