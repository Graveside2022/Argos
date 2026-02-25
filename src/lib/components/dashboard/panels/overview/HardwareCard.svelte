<script lang="ts">
	import type { HardwareDetails, HardwareStatus } from './types';

	interface Props {
		hardwareStatus: HardwareStatus | null;
		hardwareDetails: HardwareDetails | null;
	}

	let { hardwareStatus, hardwareDetails }: Props = $props();

	// Build display label: "HackRF One" or "wlan1 (RT5370)"
	let hackrfLabel = $derived(hardwareDetails?.sdr?.product ?? 'HackRF One');

	function buildWifiLabel(iface: string | undefined, chipset: string | undefined): string {
		if (iface && chipset) return `${iface} (${chipset})`;
		return iface ?? 'WiFi Adapter';
	}

	let wifiLabel = $derived(
		buildWifiLabel(
			hardwareDetails?.wifi?.monitorInterface ?? hardwareDetails?.wifi?.interface,
			hardwareDetails?.wifi?.chipset
		)
	);

	let hackrfStatus = $derived(
		hardwareStatus?.hackrf?.isDetected
			? (hardwareStatus.hackrf.owner ?? 'connected')
			: 'not found'
	);

	let wifiStatus = $derived(
		hardwareStatus?.alfa?.isDetected
			? (hardwareDetails?.wifi?.mode ?? (hardwareStatus.alfa.owner ? 'in use' : 'connected'))
			: 'not found'
	);

	let hackrfActive = $derived(!!hardwareStatus?.hackrf?.isDetected);
	let wifiActive = $derived(!!hardwareStatus?.alfa?.isDetected);
</script>

<section class="hw-section">
	<h3 class="section-label">HARDWARE</h3>

	{#if hardwareStatus}
		<div class="hw-row">
			<span class="hw-dot" class:active={hackrfActive}></span>
			<span class="hw-name">{hackrfLabel}</span>
			<span class="hw-status" class:active={hackrfActive}>{hackrfStatus}</span>
		</div>
		<div class="hw-row">
			<span class="hw-dot" class:active={wifiActive}></span>
			<span class="hw-name">{wifiLabel}</span>
			<span class="hw-status" class:active={wifiActive}>{wifiStatus}</span>
		</div>
	{:else}
		<span class="loading">Scanning hardware...</span>
	{/if}
</section>

<style>
	.hw-section {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.section-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground, #888888);
		margin: 0;
	}

	.hw-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.hw-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--muted-foreground, #555555);
	}

	.hw-dot.active {
		background: var(--success, #8bbfa0);
	}

	.hw-name {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
		flex: 1;
	}

	.hw-status {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.hw-status.active {
		color: var(--success, #8bbfa0);
	}

	.loading {
		font-size: 11px;
		color: var(--muted-foreground);
		font-style: italic;
	}
</style>
