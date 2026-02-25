<!-- Hardware Config sub-panel — 3 device category cards with status dots -->
<script lang="ts">
	import { onMount } from 'svelte';

	import { activePanel } from '$lib/stores/dashboard/dashboard-store';

	interface WifiDevice {
		interface: string;
		chipset: string;
		driver: string;
		mode: string;
		mac: string;
	}

	interface SdrDevice {
		make: string;
		model: string;
		serial: string;
		firmwareVersion: string;
		usbBus: string;
	}

	interface GpsDevice {
		device: string;
		driver: string;
		activated: string;
		native: number;
		bps: number;
	}

	interface HardwareData {
		wifi: WifiDevice[];
		sdr: SdrDevice[];
		gps: GpsDevice[];
	}

	let data: HardwareData | null = $state(null);
	let isLoading = $state(true);
	let error: string | null = $state(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/hardware/details', { credentials: 'same-origin' });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			data = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load hardware';
		} finally {
			isLoading = false;
		}
	});
</script>

<div class="hardware-config-panel">
	<header class="panel-header">
		<button class="back-btn" onclick={() => activePanel.set('settings')}>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg
			>
			Settings
		</button>
		<span class="panel-title">HARDWARE</span>
	</header>

	<div class="cards-container">
		{#if isLoading}
			<p class="status-text">Loading hardware...</p>
		{:else if error}
			<p class="status-text error">{error}</p>
		{:else if data}
			<!-- GPS Devices -->
			<div class="device-card">
				<h3 class="section-header">GPS DEVICES</h3>
				{#if data.gps.length === 0}
					<p class="empty-text">No devices detected</p>
				{:else}
					{#each data.gps as device}
						<div class="device-row">
							<span class="status-dot active"></span>
							<div class="device-info">
								<span class="device-name">{device.device}</span>
								<span class="device-detail">{device.driver} · {device.bps} bps</span
								>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- SDR Radios -->
			<div class="device-card">
				<h3 class="section-header">SDR / SOFTWARE DEFINED RADIOS</h3>
				{#if data.sdr.length === 0}
					<p class="empty-text">No devices detected</p>
				{:else}
					{#each data.sdr as device}
						<div class="device-row">
							<span class="status-dot active"></span>
							<div class="device-info">
								<span class="device-name">{device.make} {device.model}</span>
								<span class="device-detail"
									>SN: {device.serial} · FW: {device.firmwareVersion}</span
								>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- WiFi Adapters -->
			<div class="device-card">
				<h3 class="section-header">WIFI ADAPTERS</h3>
				{#if data.wifi.length === 0}
					<p class="empty-text">No devices detected</p>
				{:else}
					{#each data.wifi as device}
						<div class="device-row">
							<span class="status-dot active"></span>
							<div class="device-info">
								<span class="device-name">{device.interface}</span>
								<span class="device-detail">{device.chipset} · {device.mode}</span>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	@import './hardware-config-panel.css';
</style>
