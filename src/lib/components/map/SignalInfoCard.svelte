<script lang="ts">
	import type { SignalMarker } from '$lib/types/signals';
	import type { SignalCluster } from '$lib/services/map/signalClustering';
	import SignalTypeIndicator from './SignalTypeIndicator.svelte';
	import SignalStrengthMeter from './SignalStrengthMeter.svelte';
	import { getSimplifiedSignalType } from '$lib/services/map/signalClustering';

	export let data: SignalMarker | SignalCluster;
	export let isCluster = false;

	// Helper to check if data is a cluster
	function isSignalCluster(data: SignalMarker | SignalCluster): data is SignalCluster {
		return 'signals' in data && 'stats' in data;
	}

	$: cluster = isCluster && isSignalCluster(data) ? data : null;
	$: signal = !isCluster && !isSignalCluster(data) ? data : null;

	// Format frequency display
	function formatFrequency(freq: number): string {
		if (freq >= 1000) {
			return `${(freq / 1000).toFixed(2)} GHz`;
		}
		return `${freq.toFixed(0)} MHz`;
	}

	// Format time ago
	function formatTimeAgo(timestamp: number): string {
		const seconds = Math.floor((Date.now() - timestamp) / 1000);
		if (seconds < 60) return `${seconds}s ago`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ago`;
	}
</script>

<div class="bg-gray-800 rounded-lg p-4 shadow-lg min-w-[280px]">
	{#if cluster}
		<!-- Cluster view -->
		<div class="flex items-center justify-between mb-3">
			<h3 class="text-lg font-bold text-white">Signal Cluster</h3>
			<div class="bg-gray-700 px-2 py-1 rounded text-sm text-cyan-400">
				{cluster.stats.count} signals
			</div>
		</div>

		<div class="space-y-3">
			<!-- Power stats -->
			<div>
				<div class="text-xs text-gray-400 mb-1">Signal Strength Range</div>
				<SignalStrengthMeter power={cluster.stats.avgPower} showLabel={true} />
				<div class="flex justify-between text-xs text-gray-500 mt-1">
					<span>Min: {cluster.stats.minPower.toFixed(0)} dBm</span>
					<span>Max: {cluster.stats.maxPower.toFixed(0)} dBm</span>
				</div>
			</div>

			<!-- Frequency -->
			<div>
				<div class="text-xs text-gray-400 mb-1">Dominant Frequency</div>
				<div class="text-white">{formatFrequency(cluster.stats.dominantFreq)}</div>
			</div>

			<!-- Signal types -->
			<div>
				<div class="text-xs text-gray-400 mb-1">Signal Types</div>
				<div class="flex flex-wrap gap-2">
					{#each Array.from(cluster.stats.signalTypes.entries()) as [type, count]}
						<div class="flex items-center gap-1 bg-gray-700 px-2 py-1 rounded">
							<SignalTypeIndicator signalType={type} size="small" />
							<span class="text-xs text-white">{count}</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Time range -->
			<div>
				<div class="text-xs text-gray-400 mb-1">Time Span</div>
				<div class="text-sm text-white">
					{formatTimeAgo(cluster.stats.timeRange.end)} - {formatTimeAgo(
						cluster.stats.timeRange.start
					)}
				</div>
			</div>
		</div>
	{:else if signal}
		<!-- Single signal view -->
		<div class="flex items-center justify-between mb-3">
			<h3 class="text-lg font-bold text-white">RF Signal</h3>
			<SignalTypeIndicator
				signalType={getSimplifiedSignalType(
					typeof signal.metadata?.type === 'string' ? signal.metadata.type : 'unknown'
				)}
			/>
		</div>

		<div class="space-y-3">
			<!-- Signal strength -->
			<div>
				<div class="text-xs text-gray-400 mb-1">Signal Strength</div>
				<SignalStrengthMeter power={signal.power} showLabel={true} />
			</div>

			<!-- Frequency -->
			<div>
				<div class="text-xs text-gray-400 mb-1">Frequency</div>
				<div class="text-white">{formatFrequency(signal.frequency)}</div>
			</div>

			<!-- Position -->
			<div>
				<div class="text-xs text-gray-400 mb-1">Position</div>
				<div class="font-mono text-sm text-cyan-400">
					{signal.position.lat.toFixed(6)}°, {signal.position.lon.toFixed(6)}°
				</div>
			</div>

			<!-- Time -->
			<div>
				<div class="text-xs text-gray-400 mb-1">Detected</div>
				<div class="text-sm text-white">{formatTimeAgo(signal.timestamp)}</div>
			</div>

			<!-- Source -->
			<div>
				<div class="text-xs text-gray-400 mb-1">Source</div>
				<div class="text-sm text-white uppercase">{signal.source}</div>
			</div>
		</div>
	{/if}
</div>
