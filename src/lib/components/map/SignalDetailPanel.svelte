<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SignalMarker } from '$lib/stores/map/signals';
  import type { SignalCluster } from '$lib/services/map/signalClustering';
  import SignalTypeIndicator from './SignalTypeIndicator.svelte';
  import SignalStrengthMeter from './SignalStrengthMeter.svelte';
  
  export let cluster: SignalCluster | null = null;
  export let isOpen = false;
  
  const dispatch = createEventDispatcher();
  
  function close() {
    dispatch('close');
  }
  
  function selectSignal(signal: SignalMarker) {
    dispatch('selectSignal', signal);
  }
  
  // Sort signals by power (strongest first)
  $: sortedSignals = cluster ? [...cluster.signals].sort((a, b) => b.power - a.power) : [];
  
  // Group signals by type
  $: signalsByType = sortedSignals.reduce((acc: Record<string, SignalMarker[]>, signal) => {
    const type = signal.metadata.signalType || 'unknown';
    if (!acc[type]) acc[type] = [];
    acc[type].push(signal);
    return acc;
  }, {} as Record<string, SignalMarker[]>);
</script>

{#if isOpen && cluster}
  <div class="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4"
       on:click={close}
       on:keydown={(e) => e.key === 'Escape' && close()}
       role="button"
       tabindex="0">
    <div class="bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
         on:click|stopPropagation>
      <!-- Header -->
      <div class="bg-gray-800 px-6 py-4 border-b border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-white">Cluster Details</h2>
            <p class="text-sm text-gray-400 mt-1">
              {cluster.stats.count} signals at {cluster.lat.toFixed(6)}°, {cluster.lon.toFixed(6)}°
            </p>
          </div>
          <button
            on:click={close}
            class="text-gray-400 hover:text-white transition-colors p-2"
            aria-label="Close">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Content -->
      <div class="overflow-y-auto max-h-[calc(80vh-100px)] p-6">
        <!-- Summary Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="bg-gray-800 rounded-lg p-4">
            <div class="text-xs text-gray-400 mb-1">Average Power</div>
            <SignalStrengthMeter power={cluster.stats.avgPower} compact={false} />
          </div>
          <div class="bg-gray-800 rounded-lg p-4">
            <div class="text-xs text-gray-400 mb-1">Power Range</div>
            <div class="text-white">
              {cluster.stats.minPower.toFixed(0)} to {cluster.stats.maxPower.toFixed(0)} dBm
            </div>
          </div>
          <div class="bg-gray-800 rounded-lg p-4">
            <div class="text-xs text-gray-400 mb-1">Time Span</div>
            <div class="text-white">
              {new Date(cluster.stats.timeRange.start).toLocaleTimeString()} - 
              {new Date(cluster.stats.timeRange.end).toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        <!-- Signals by Type -->
        <div class="space-y-4">
          {#each Object.entries(signalsByType) as [type, signals]}
            <div class="bg-gray-800 rounded-lg p-4">
              <div class="flex items-center gap-2 mb-3">
                <SignalTypeIndicator signalType={type} size="medium" />
                <h3 class="text-lg font-semibold text-white capitalize">{type}</h3>
                <span class="text-sm text-gray-400">({signals.length} signals)</span>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                {#each signals as signal}
                  <button
                    on:click={() => selectSignal(signal)}
                    class="bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-colors">
                    <div class="flex items-center justify-between mb-2">
                      <div class="text-sm text-white">
                        {(signal.frequency / 1000).toFixed(2)} GHz
                      </div>
                      <SignalStrengthMeter power={signal.power} compact={true} showLabel={false} />
                    </div>
                    <div class="text-xs text-gray-400">
                      {new Date(signal.timestamp).toLocaleTimeString()}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Footer -->
      <div class="bg-gray-800 px-6 py-3 border-t border-gray-700">
        <div class="flex justify-end gap-3">
          <button
            on:click={close}
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Ensure the panel is above map controls */
  :global(.leaflet-control) {
    z-index: 1000 !important;
  }
</style>