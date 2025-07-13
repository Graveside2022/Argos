<script lang="ts">
	import { mapConfig, signalStats, clearSignals } from '$lib/stores/map/signals';
	import { exportAsGeoJSON, exportAsKML } from '$lib/services/map/mapUtils';
	import type { SignalMarker } from '$lib/stores/map/signals';
	import { SignalSource } from '$lib/types/enums';

	export let signals: SignalMarker[] = [];

	let showPanel = true;

	function handleExport(format: 'geojson' | 'kml') {
		const data = format === 'geojson' ? exportAsGeoJSON(signals) : exportAsKML(signals);
		const blob = new Blob([data], {
			type: format === 'geojson' ? 'application/json' : 'application/vnd.google-earth.kml+xml'
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `signals_${new Date().toISOString()}.${format === 'geojson' ? 'json' : 'kml'}`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<!-- Toggle Button -->
<button
	on:click={() => (showPanel = !showPanel)}
	class="absolute top-4 left-4 z-[1000] bg-gray-900/90 text-white p-3 rounded-lg shadow-lg hover:bg-gray-800/90 transition-colors"
	aria-label="Toggle controls"
>
	<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M4 6h16M4 12h16M4 18h16"
		/>
	</svg>
</button>

<!-- Control Panel -->
{#if showPanel}
	<div
		class="absolute top-16 left-4 z-[999] bg-gray-900/90 backdrop-blur-sm text-white p-4 rounded-lg shadow-lg w-80 max-h-[calc(100vh-5rem)] overflow-y-auto"
	>
		<!-- Signal Statistics -->
		<div class="mb-4 pb-4 border-b border-gray-700">
			<h3 class="text-lg font-bold mb-2">Signal Statistics</h3>
			<div class="grid grid-cols-2 gap-2 text-sm">
				<div>Total Signals:</div>
				<div class="text-right font-mono">{$signalStats.total}</div>

				<div>HackRF:</div>
				<div class="text-right font-mono">{$signalStats.hackrf}</div>

				<div>Kismet:</div>
				<div class="text-right font-mono">{$signalStats.kismet}</div>

				<div>Avg Power:</div>
				<div class="text-right font-mono">{$signalStats.avgPower.toFixed(1)} dBm</div>
			</div>

			<div class="mt-2 space-y-1">
				<div class="flex items-center justify-between text-xs">
					<span class="flex items-center">
						<span class="w-3 h-3 bg-red-500 rounded-full mr-1"></span>
						Strong
					</span>
					<span class="font-mono">{$signalStats.strongSignals}</span>
				</div>
				<div class="flex items-center justify-between text-xs">
					<span class="flex items-center">
						<span class="w-3 h-3 bg-yellow-500 rounded-full mr-1"></span>
						Medium
					</span>
					<span class="font-mono">{$signalStats.mediumSignals}</span>
				</div>
				<div class="flex items-center justify-between text-xs">
					<span class="flex items-center">
						<span class="w-3 h-3 bg-green-500 rounded-full mr-1"></span>
						Weak
					</span>
					<span class="font-mono">{$signalStats.weakSignals}</span>
				</div>
			</div>
		</div>

		<!-- Layer Controls -->
		<div class="mb-4 pb-4 border-b border-gray-700">
			<h3 class="text-lg font-bold mb-2">Layers</h3>
			<div class="space-y-2">
				<label class="flex items-center">
					<input
						type="checkbox"
						bind:checked={$mapConfig.showHackRF}
						class="mr-2 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
					/>
					<span>HackRF Signals</span>
				</label>

				<label class="flex items-center">
					<input
						type="checkbox"
						bind:checked={$mapConfig.showKismet}
						class="mr-2 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
					/>
					<span>Kismet Devices</span>
				</label>

				<label class="flex items-center">
					<input
						type="checkbox"
						bind:checked={$mapConfig.showClustering}
						class="mr-2 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
					/>
					<span>Cluster Markers</span>
				</label>

				<label class="flex items-center">
					<input
						type="checkbox"
						bind:checked={$mapConfig.showHeatmap}
						class="mr-2 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
					/>
					<span>Signal Heatmap</span>
				</label>
			</div>
		</div>

		<!-- Filter Controls -->
		<div class="mb-4 pb-4 border-b border-gray-700">
			<h3 class="text-lg font-bold mb-2">Filters</h3>

			<div class="mb-3">
				<label class="block text-sm mb-1">Min Signal Strength</label>
				<div class="flex items-center space-x-2">
					<input
						type="range"
						bind:value={$mapConfig.signalThreshold}
						min="-100"
						max="-30"
						step="5"
						class="flex-1"
					/>
					<span class="text-sm font-mono w-16 text-right"
						>{$mapConfig.signalThreshold} dBm</span
					>
				</div>
			</div>

			<div>
				<label class="block text-sm mb-1">Max Age</label>
				<div class="flex items-center space-x-2">
					<input
						type="range"
						bind:value={$mapConfig.maxAge}
						min="60"
						max="3600"
						step="60"
						class="flex-1"
					/>
					<span class="text-sm font-mono w-16 text-right"
						>{Math.floor($mapConfig.maxAge / 60)}m</span
					>
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="space-y-2">
			<button
				on:click={() => clearSignals()}
				class="w-full px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600 rounded text-sm transition-colors"
			>
				Clear All Signals
			</button>

			<button
				on:click={() => clearSignals(SignalSource.HackRF)}
				class="w-full px-3 py-2 bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 rounded text-sm transition-colors"
			>
				Clear HackRF
			</button>

			<button
				on:click={() => clearSignals(SignalSource.Kismet)}
				class="w-full px-3 py-2 bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600 rounded text-sm transition-colors"
			>
				Clear Kismet
			</button>

			<div class="pt-2 border-t border-gray-700">
				<p class="text-xs text-gray-400 mb-2">Export Data</p>
				<div class="grid grid-cols-2 gap-2">
					<button
						on:click={() => handleExport('geojson')}
						disabled={signals.length === 0}
						class="px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-600 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						GeoJSON
					</button>
					<button
						on:click={() => handleExport('kml')}
						disabled={signals.length === 0}
						class="px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-600 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						KML
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
