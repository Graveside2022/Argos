<script lang="ts">
	import HardwareDeviceRow from './HardwareDeviceRow.svelte';
	import type { HardwareDetailRow, HardwareDetails, HardwareStatus } from './types';

	interface Props {
		hardwareStatus: HardwareStatus | null;
		hardwareDetails: HardwareDetails | null;
		expandedRow: string | null;
		onToggleExpand: (id: string) => void;
	}

	let { hardwareStatus, hardwareDetails, expandedRow, onToggleExpand }: Props = $props();

	let hackrfDetails = $derived.by((): HardwareDetailRow[] => {
		const rows: HardwareDetailRow[] = [];
		const sdr = hardwareDetails?.sdr;
		if (sdr?.manufacturer) rows.push({ key: 'Make', value: sdr.manufacturer });
		if (sdr?.product) rows.push({ key: 'Model', value: sdr.product });
		if (sdr?.serial) rows.push({ key: 'Serial', value: sdr.serial });
		if (sdr?.firmwareApi) rows.push({ key: 'FW API', value: sdr.firmwareApi });
		if (sdr?.usbSpeed) rows.push({ key: 'USB', value: sdr.usbSpeed });
		if (hardwareStatus?.hackrf.owner) {
			rows.push({ key: 'Used by', value: hardwareStatus.hackrf.owner, className: 'accent' });
		}
		if (!sdr?.manufacturer && !hardwareStatus?.hackrf.isDetected) {
			rows.push({ key: 'Status', value: 'Not detected', className: 'dim' });
		}
		return rows;
	});

	let alfaDetails = $derived.by((): HardwareDetailRow[] => {
		const rows: HardwareDetailRow[] = [];
		const wifi = hardwareDetails?.wifi;
		if (wifi?.chipset) rows.push({ key: 'Chipset', value: wifi.chipset });
		if (wifi?.mac) rows.push({ key: 'MAC', value: wifi.mac });
		if (wifi?.driver) rows.push({ key: 'Driver', value: wifi.driver });
		if (wifi?.interface || wifi?.monitorInterface) {
			rows.push({ key: 'Interface', value: wifi.monitorInterface || wifi.interface || '' });
		}
		if (wifi?.mode) rows.push({ key: 'Mode', value: wifi.mode });
		if (wifi?.bands && wifi.bands.length > 0) {
			rows.push({ key: 'Bands', value: wifi.bands.join(', ') });
		}
		if (hardwareStatus?.alfa.owner) {
			rows.push({ key: 'Used by', value: hardwareStatus.alfa.owner, className: 'accent' });
		}
		if (!wifi?.chipset && !hardwareStatus?.alfa.isDetected) {
			rows.push({ key: 'Status', value: 'Not detected', className: 'dim' });
		}
		return rows;
	});

	let bluetoothDetails = $derived.by((): HardwareDetailRow[] => {
		const rows: HardwareDetailRow[] = [];
		if (hardwareStatus?.bluetooth) {
			rows.push({
				key: 'Status',
				value: hardwareStatus.bluetooth.isDetected ? 'Detected' : 'Not detected'
			});
			if (hardwareStatus.bluetooth.owner) {
				rows.push({
					key: 'Used by',
					value: hardwareStatus.bluetooth.owner,
					className: 'accent'
				});
			}
		}
		return rows;
	});
</script>

<section class="panel-section">
	<div class="section-label">HARDWARE</div>
	{#if hardwareStatus}
		<HardwareDeviceRow
			deviceId="hackrf"
			displayName="HackRF"
			device={hardwareStatus.hackrf}
			details={hackrfDetails}
			expanded={expandedRow === 'hackrf'}
			onToggle={onToggleExpand}
		/>
		<HardwareDeviceRow
			deviceId="alfa"
			displayName="ALFA WiFi"
			device={hardwareStatus.alfa}
			details={alfaDetails}
			expanded={expandedRow === 'alfa'}
			onToggle={onToggleExpand}
		/>
		<HardwareDeviceRow
			deviceId="bluetooth"
			displayName="Bluetooth"
			device={hardwareStatus.bluetooth}
			details={bluetoothDetails}
			expanded={expandedRow === 'bluetooth'}
			onToggle={onToggleExpand}
		/>
	{:else}
		<div class="no-data">Scanning hardware...</div>
	{/if}
</section>

<style>
	.panel-section {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.section-label {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
	}

	.no-data {
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
		font-style: italic;
	}
</style>
