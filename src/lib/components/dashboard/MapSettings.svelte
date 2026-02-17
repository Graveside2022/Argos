<script lang="ts">
	import { slide } from 'svelte/transition';

	import {
		DEFAULT_SATELLITE_SOURCE,
		DEFAULT_VECTOR_SOURCE,
		mapSettings
	} from '$lib/stores/dashboard/map-settings-store';

	let isOpen = $state(false);
	let customUrl = $state('');

	function selectVector() {
		mapSettings.setProvider(DEFAULT_VECTOR_SOURCE);
	}

	function selectSatellite() {
		mapSettings.setProvider(DEFAULT_SATELLITE_SOURCE);
	}

	function toggle() {
		isOpen = !isOpen;
	}

	function applyCustom() {
		if (!customUrl) return;
		mapSettings.setProvider({
			name: 'Custom',
			type: 'satellite', // Treat as raster/satellite
			url: customUrl,
			attribution: 'Custom'
		});
	}
</script>

<div class="map-settings-ctrl">
	<button class="settings-btn" onclick={toggle} title="Map Layers">
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<polygon points="12 2 2 7 12 12 22 7 12 2" />
			<polyline points="2 17 12 22 22 17" />
			<polyline points="2 12 12 17 22 12" />
		</svg>
	</button>

	{#if isOpen}
		<div class="settings-popover" transition:slide={{ duration: 200 }}>
			<div class="settings-title">Map Provider</div>

			<button
				class="layer-option"
				class:active={$mapSettings.type === 'vector'}
				onclick={selectVector}
			>
				<span class="layer-icon vector"></span>
				<div class="layer-info">
					<span class="layer-name">Tactical Dark</span>
					<span class="layer-sub">Vector (Stadia)</span>
				</div>
			</button>

			<button
				class="layer-option"
				class:active={$mapSettings.name === 'Satellite Hybrid'}
				onclick={selectSatellite}
			>
				<span class="layer-icon satellite"></span>
				<div class="layer-info">
					<span class="layer-name">Satellite Hybrid</span>
					<span class="layer-sub">Google Maps</span>
				</div>
			</button>

			<div class="settings-divider"></div>
			<div class="custom-input">
				<input type="text" placeholder="Custom XYZ URL..." bind:value={customUrl} />
				<button class="apply-btn" onclick={applyCustom}>Set</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.map-settings-ctrl {
		position: relative;
		pointer-events: auto;
	}

	.settings-btn {
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		background: var(--card);
		color: var(--primary);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 0;
		transition: all 0.2s;
	}

	.settings-btn:hover {
		background: var(--accent);
		color: var(--primary-foreground);
	}

	.settings-popover {
		position: absolute;
		bottom: 40px;
		right: 0;
		width: 220px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.settings-title {
		font-size: 11px;
		font-weight: 600;
		color: var(--muted-foreground);
		text-transform: uppercase;
		margin-bottom: 4px;
		padding-left: 4px;
	}

	.layer-option {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
	}

	.layer-option:hover {
		background: var(--accent);
	}

	.layer-option.active {
		background: color-mix(in srgb, var(--primary) 15%, transparent);
		border-color: var(--primary);
	}

	.layer-icon {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		background-size: cover;
	}

	.layer-icon.vector {
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
		border: 1px solid #333;
	}

	.layer-icon.satellite {
		background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
		border: 1px solid #333;
	}

	.layer-info {
		display: flex;
		flex-direction: column;
	}

	.layer-name {
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
	}

	.layer-sub {
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.settings-divider {
		height: 1px;
		background: var(--border);
		margin: 4px 0;
	}

	.custom-input {
		display: flex;
		gap: 4px;
	}

	.custom-input input {
		flex: 1;
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: 4px;
		font-size: 10px;
		padding: 4px;
		color: var(--foreground);
	}

	.apply-btn {
		background: var(--primary);
		color: var(--primary-foreground);
		border: none;
		border-radius: 4px;
		font-size: 10px;
		padding: 0 8px;
		cursor: pointer;
	}
</style>
