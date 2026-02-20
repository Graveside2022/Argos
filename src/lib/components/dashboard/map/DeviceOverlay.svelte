<!-- @constitutional-exemption Article-IV-4.2 — overlay-close button uses custom micro icon, shadcn Button not appropriate for 12px close control -->
<script lang="ts">
	import { isolateDevice } from '$lib/stores/dashboard/dashboard-store';
	import type { Affiliation } from '$lib/stores/tactical-map/kismet-store';
	import { setDeviceAffiliation } from '$lib/stores/tactical-map/kismet-store';

	import { formatFrequency, formatTimeAgo } from './map-helpers';

	interface Props {
		content: {
			ssid: string;
			mac: string;
			rssi: number;
			type: string;
			manufacturer: string;
			channel: number;
			frequency: number;
			packets: number;
			last_seen: number;
			clientCount: number;
			parentAP: string;
			affiliation: Affiliation;
		};
		onclose: () => void;
	}

	let { content, onclose }: Props = $props();
</script>

<div class="device-overlay">
	<button
		class="overlay-close"
		onclick={() => {
			onclose();
			isolateDevice(null);
		}}
	>
		<svg
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
		>
	</button>
	<div class="overlay-title">{content.ssid}</div>
	<div class="overlay-row">
		<span class="overlay-label">MAC</span>
		<span class="overlay-value">{content.mac}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">VENDOR</span>
		<span class="overlay-value">{content.manufacturer}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">TYPE</span>
		<span class="overlay-value">{content.type}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">AFFIL</span>
		<span class="overlay-value">
			<span class="affil-indicator affil-{content.affiliation}"></span>
			<select
				class="affil-select"
				value={content.affiliation}
				onchange={(e) => {
					const val = (e.target as HTMLSelectElement).value as Affiliation;
					setDeviceAffiliation(content.mac, val);
					content = { ...content, affiliation: val };
				}}
			>
				<option value="unknown">Unknown</option>
				<option value="friendly">Friendly</option>
				<option value="hostile">Hostile</option>
			</select>
		</span>
	</div>
	<div class="overlay-divider"></div>
	<div class="overlay-row">
		<span class="overlay-label">RSSI</span>
		<span class="overlay-value">{content.rssi !== 0 ? `${content.rssi} dBm` : '—'}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">CH</span>
		<span class="overlay-value">{content.channel || '—'}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">FREQ</span>
		<span class="overlay-value">{formatFrequency(content.frequency)}</span>
	</div>
	<div class="overlay-divider"></div>
	<div class="overlay-row">
		<span class="overlay-label">PKTS</span>
		<span class="overlay-value">{content.packets.toLocaleString()}</span>
	</div>
	<div class="overlay-row">
		<span class="overlay-label">LAST</span>
		<span class="overlay-value">{formatTimeAgo(content.last_seen)}</span>
	</div>
	{#if content.clientCount > 0}
		<div class="overlay-divider"></div>
		<div class="overlay-row">
			<span class="overlay-label">CLIENTS</span>
			<span class="overlay-value overlay-accent">{content.clientCount}</span>
		</div>
	{/if}
	{#if content.parentAP}
		<div class="overlay-divider"></div>
		<div class="overlay-row">
			<span class="overlay-label">PARENT</span>
			<span class="overlay-value overlay-mono">{content.parentAP}</span>
		</div>
	{/if}
</div>

<style>
	.device-overlay {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 10;
		background: color-mix(in srgb, var(--card) 95%, transparent);
		border: 1px solid var(--palantir-border-default, #2a2a3e);
		border-radius: 8px;
		padding: 10px 12px;
		min-width: 180px;
		max-width: 220px;
		box-shadow: 0 4px 16px color-mix(in srgb, var(--background) 50%, transparent);
		backdrop-filter: blur(8px);
		pointer-events: auto;
	}

	.overlay-close {
		position: absolute;
		top: 6px;
		right: 6px;
		background: none;
		border: none;
		color: var(--palantir-text-tertiary, #666);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
	}

	.overlay-close:hover {
		color: var(--palantir-text-primary, #e0e0e8);
	}

	.overlay-title {
		font-weight: 600;
		font-size: 13px;
		margin-bottom: 6px;
		padding-right: 16px;
		color: var(--palantir-text-primary, #e0e0e8);
	}

	.overlay-row {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		padding: 1.5px 0;
	}

	.overlay-label {
		color: var(--palantir-text-tertiary, #666);
		letter-spacing: 0.05em;
	}

	.overlay-value {
		color: var(--palantir-text-secondary, #aaa);
		font-family: var(--font-mono, monospace);
		font-size: 10px;
	}

	.overlay-accent {
		color: var(--palantir-accent, #4a90e2);
	}

	.overlay-mono {
		font-size: 9px;
		word-break: break-all;
	}

	.overlay-divider {
		border-top: 1px solid var(--palantir-border-default, #2a2a3e);
		margin: 3px 0;
	}

	/* Affiliation dropdown */
	.affil-select {
		background: var(--palantir-bg-overlay, #1a1a2e);
		color: var(--palantir-text-secondary, #aaa);
		border: 1px solid var(--palantir-border-default, #2a2a3e);
		border-radius: 3px;
		font-family: var(--font-mono, monospace);
		font-size: 10px;
		padding: 1px 4px;
		cursor: pointer;
		outline: none;
		-webkit-appearance: none;
		appearance: none;
		padding-right: 14px;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 3px center;
	}

	.affil-select:hover {
		border-color: var(--palantir-accent, #4a90e2);
	}

	.affil-select:focus {
		border-color: var(--palantir-accent, #4a90e2);
		box-shadow: 0 0 0 1px var(--palantir-accent, #4a90e2);
	}

	.affil-indicator {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		margin-right: 4px;
		vertical-align: middle;
	}

	.affil-unknown {
		background: var(--color-warning);
	}

	.affil-friendly {
		background: var(--color-info);
	}

	.affil-hostile {
		background: var(--color-destructive);
	}
</style>
