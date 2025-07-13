<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { kismetStore } from '$lib/stores/kismet';
	import { notifications } from '$lib/stores/notifications';
	
	let isRunning = false;
	let isLoading = false;
	let unsubscribe: () => void;
	
	onMount(() => {
		unsubscribe = kismetStore.subscribe($store => {
			isRunning = $store.status.kismet_running;
		});
		
		// Check initial status
		void checkStatus();
		
		// Poll status every 5 seconds
		const interval = setInterval(() => { void checkStatus(); }, 5000);
		
		return () => {
			clearInterval(interval);
		};
	});
	
	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});
	
	async function checkStatus() {
		try {
			const response = await fetch('/api/kismet/status');
			const data = await response.json() as Record<string, unknown>;
			
			kismetStore.updateStatus({
				kismet_running: ('kismet_running' in data && Boolean(data.kismet_running)) || false,
				wigle_running: ('wigle_running' in data && Boolean(data.wigle_running)) || false,
				gps_running: ('gps_running' in data && Boolean(data.gps_running)) || false
			});
		} catch (error: unknown) {
			console.error('Failed to check status:', error);
		}
	}
	
	async function startService() {
		isLoading = true;
		try {
			const response = await fetch('/api/kismet/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ script_name: 'gps_kismet_wigle' })
			});
			
			const data = await response.json() as Record<string, unknown>;
			
			if ('success' in data && data.success) {
				notifications.add({ type: 'success', message: 'Kismet services started successfully' });
				// Wait a bit for services to start
				setTimeout(() => { void checkStatus(); }, 2000);
			} else {
				notifications.add({ type: 'error', message: ('message' in data && typeof data.message === 'string' ? data.message : undefined) || 'Failed to start Kismet services' });
			}
		} catch (error: unknown) {
			notifications.add({ type: 'error', message: 'Failed to start Kismet services' });
			console.error('Start error:', error);
		} finally {
			isLoading = false;
		}
	}
	
	async function stopService() {
		isLoading = true;
		try {
			const response = await fetch('/api/kismet/stop', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});
			
			const data = await response.json() as Record<string, unknown>;
			
			if (('success' in data && data.success) || ('status' in data && data.status === 'success')) {
				notifications.add({ type: 'success', message: 'Kismet services stopped successfully' });
				// Wait a bit for services to stop
				setTimeout(() => { void checkStatus(); }, 2000);
			} else {
				notifications.add({ type: 'error', message: ('message' in data && typeof data.message === 'string' ? data.message : undefined) || 'Failed to stop Kismet services' });
			}
		} catch (error: unknown) {
			notifications.add({ type: 'error', message: 'Failed to stop Kismet services' });
			console.error('Stop error:', error);
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="service-control">
	<div class="service-header">
		<h3>Service Control</h3>
		<div class="status-indicator">
			<span class="status-dot" class:active={isRunning}></span>
			<span class="status-text">{isRunning ? 'Running' : 'Stopped'}</span>
		</div>
	</div>
	
	<div class="control-buttons">
		<button 
			class="control-button start-button"
			on:click={startService}
			disabled={isRunning || isLoading}
			class:loading={isLoading && !isRunning}
		>
			{#if isLoading && !isRunning}
				<span class="spinner"></span>
				Starting...
			{:else}
				<span class="button-icon">▶</span>
				Start Kismet
			{/if}
		</button>
		
		<button 
			class="control-button stop-button"
			on:click={stopService}
			disabled={!isRunning || isLoading}
			class:loading={isLoading && isRunning}
		>
			{#if isLoading && isRunning}
				<span class="spinner"></span>
				Stopping...
			{:else}
				<span class="button-icon">■</span>
				Stop Kismet
			{/if}
		</button>
	</div>
	
	<div class="service-details">
		<div class="service-item">
			<span class="service-name">Kismet Server</span>
			<span class="service-status" class:active={isRunning}>
				{isRunning ? 'Active' : 'Inactive'}
			</span>
		</div>
		<div class="service-item">
			<span class="service-name">WiFi Monitor</span>
			<span class="service-status" class:active={isRunning}>
				{isRunning ? 'Scanning' : 'Idle'}
			</span>
		</div>
		<div class="service-item">
			<span class="service-name">GPS Service</span>
			<span class="service-status" class:active={isRunning}>
				{isRunning ? 'Tracking' : 'Disabled'}
			</span>
		</div>
	</div>
</div>

<style>
	.service-control {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: rgba(12, 22, 48, 0.65);
		border: 1px solid rgba(0, 190, 215, 0.35);
		border-radius: 8px;
		overflow: hidden;
	}

	.service-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: rgba(12, 22, 48, 0.85);
		border-bottom: 2px solid #00d2ff;
		box-shadow: 0 0 20px rgba(0, 220, 255, 0.5);
	}

	.service-header h3 {
		margin: 0;
		font-size: 1em;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 2px;
		color: #fff;
		text-shadow: 0 0 10px rgba(124, 58, 237, 0.8);
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #ff4444;
		transition: all 0.3s ease;
		box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
	}

	.status-dot.active {
		background: #44ff44;
		box-shadow: 0 0 15px #44ff44, 0 0 25px #44ff44;
		animation: status-pulse 2s ease-in-out infinite;
	}

	@keyframes status-pulse {
		0%, 100% { 
			transform: scale(1); 
			box-shadow: 0 0 15px #44ff44, 0 0 25px #44ff44;
		}
		50% { 
			transform: scale(1.1); 
			box-shadow: 0 0 20px #44ff44, 0 0 35px #44ff44;
		}
	}

	.status-text {
		font-size: 0.85em;
		color: #c0e8ff;
		font-weight: 500;
	}

	.control-buttons {
		display: flex;
		gap: 12px;
		padding: 20px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.control-button {
		background: linear-gradient(90deg, #00d2ff 0%, #222 100%);
		color: #fff;
		border: none;
		border-radius: 8px;
		padding: 12px 24px;
		font-size: 1em;
		font-family: inherit;
		font-weight: 500;
		cursor: pointer;
		box-shadow: 0 4px 16px rgba(0, 210, 255, 0.15);
		transition: all 0.3s ease;
		text-align: center;
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 140px;
		justify-content: center;
		position: relative;
		overflow: hidden;
	}

	.control-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		background: linear-gradient(90deg, #666 0%, #333 100%);
	}

	.control-button:not(:disabled):hover {
		background: linear-gradient(90deg, #222 0%, #00d2ff 100%);
		transform: translateY(-2px);
		box-shadow: 0 8px 32px rgba(0, 210, 255, 0.25);
	}

	.control-button:not(:disabled):active {
		transform: translateY(0);
		box-shadow: 0 4px 16px rgba(0, 210, 255, 0.15);
	}

	.start-button:not(:disabled) {
		background: linear-gradient(90deg, #44ff44 0%, #1a4d1a 100%);
	}

	.start-button:not(:disabled):hover {
		background: linear-gradient(90deg, #1a4d1a 0%, #44ff44 100%);
		box-shadow: 0 8px 32px rgba(68, 255, 68, 0.25);
	}

	.stop-button:not(:disabled) {
		background: linear-gradient(90deg, #ff4444 0%, #4d1a1a 100%);
	}

	.stop-button:not(:disabled):hover {
		background: linear-gradient(90deg, #4d1a1a 0%, #ff4444 100%);
		box-shadow: 0 8px 32px rgba(255, 68, 68, 0.25);
	}

	.button-icon {
		font-size: 1.2em;
		display: inline-block;
	}

	.control-button.loading {
		pointer-events: none;
	}

	.spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.service-details {
		flex: 1;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.service-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 16px;
		background: rgba(0, 50, 80, 0.3);
		border-radius: 6px;
		border: 1px solid rgba(0, 190, 215, 0.2);
		transition: all 0.3s ease;
	}

	.service-item:hover {
		background: rgba(0, 70, 100, 0.4);
		border-color: rgba(0, 190, 215, 0.4);
	}

	.service-name {
		font-size: 0.9em;
		color: #c0e8ff;
		font-weight: 500;
	}

	.service-status {
		font-size: 0.85em;
		color: #737373;
		background: rgba(100, 100, 100, 0.2);
		padding: 4px 12px;
		border-radius: 12px;
		transition: all 0.3s ease;
	}

	.service-status.active {
		color: #44ff44;
		background: rgba(68, 255, 68, 0.2);
		border: 1px solid rgba(68, 255, 68, 0.4);
		box-shadow: 0 0 10px rgba(68, 255, 68, 0.3);
	}

	/* Mobile optimization */
	@media (max-width: 768px) {
		.control-buttons {
			flex-direction: column;
			padding: 16px;
		}

		.control-button {
			width: 100%;
			min-width: auto;
		}

		.service-details {
			padding: 12px;
			gap: 8px;
		}

		.service-item {
			padding: 8px 12px;
		}
	}
</style>