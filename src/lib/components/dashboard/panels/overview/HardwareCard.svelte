<script lang="ts">
	import HardwareDeviceRow from './HardwareDeviceRow.svelte';
	import type { DeviceState, HardwareDetailRow, HardwareDetails, HardwareStatus } from './types';

	interface Props {
		hardwareStatus: HardwareStatus | null;
		hardwareDetails: HardwareDetails | null;
		expandedRow: string | null;
		onToggleExpand: (id: string) => void;
	}

	let { hardwareStatus, hardwareDetails, expandedRow, onToggleExpand }: Props = $props();

	type FieldMapping = [string, string | undefined, HardwareDetailRow['className']?];

	/** Collect truthy field mappings into detail rows. */
	function collectRows(fields: FieldMapping[]): HardwareDetailRow[] {
		return fields
			.filter((f): f is [string, string, HardwareDetailRow['className']?] => !!f[1])
			.map(([key, value, className]) =>
				className ? { key, value, className } : { key, value }
			);
	}

	/** SDR field mappings from a resolved sdr info object. */
	function sdrFields(sdr: NonNullable<HardwareDetails['sdr']>): FieldMapping[] {
		return [
			['Make', sdr.manufacturer],
			['Model', sdr.product],
			['Serial', sdr.serial],
			['FW API', sdr.firmwareApi],
			['USB', sdr.usbSpeed]
		];
	}

	/** WiFi field mappings from a resolved wifi info object. */
	function wifiFields(wifi: NonNullable<HardwareDetails['wifi']>): FieldMapping[] {
		return [
			['Chipset', wifi.chipset],
			['MAC', wifi.mac],
			['Driver', wifi.driver],
			['Interface', wifi.monitorInterface || wifi.interface],
			['Mode', wifi.mode],
			['Bands', wifi.bands?.length ? wifi.bands.join(', ') : undefined]
		];
	}

	/** Build detail rows for a device given its field mappings, owner, and detection state. */
	function buildDetails(
		fields: FieldMapping[],
		owner: string | undefined,
		hasInfo: boolean,
		isDetected: boolean
	): HardwareDetailRow[] {
		fields.push(['Used by', owner, 'accent']);
		const rows = collectRows(fields);
		if (!hasInfo && !isDetected)
			rows.push({ key: 'Status', value: 'Not detected', className: 'dim' });
		return rows;
	}

	/** Map a nullable info object to field mappings, returning [] if null. */
	function mapFields<T>(
		info: T | undefined | null,
		mapper: (v: T) => FieldMapping[]
	): FieldMapping[] {
		return info ? mapper(info) : [];
	}

	/** Get owner and detection from a nullable device status entry. */
	function deviceStatus(device: DeviceState | undefined): [string | undefined, boolean] {
		return [device?.owner ?? undefined, !!device?.isDetected];
	}

	let hackrfDetails = $derived.by(() => {
		const fields = mapFields(hardwareDetails?.sdr, sdrFields);
		const [owner, detected] = deviceStatus(hardwareStatus?.hackrf);
		return buildDetails(fields, owner, !!hardwareDetails?.sdr?.manufacturer, detected);
	});

	let alfaDetails = $derived.by(() => {
		const fields = mapFields(hardwareDetails?.wifi, wifiFields);
		const [owner, detected] = deviceStatus(hardwareStatus?.alfa);
		return buildDetails(fields, owner, !!hardwareDetails?.wifi?.chipset, detected);
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
	<h3 class="section-header">HARDWARE</h3>
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

	.section-header {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
		margin: 0;
	}

	.no-data {
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
		font-style: italic;
	}
</style>
