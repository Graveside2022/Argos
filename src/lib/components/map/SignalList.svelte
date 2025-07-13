<script lang="ts">
  import { formatDistance, calculateDistance } from '$lib/services/map/mapUtils';
  import type { SignalMarker } from '$lib/stores/map/signals';
  import { userPosition } from '$lib/stores/map/signals';
  import { SignalSource } from '$lib/types/enums';
  
  export let signals: SignalMarker[] = [];
  export let onSignalClick: (signal: SignalMarker) => void = () => {};
  
  let sortBy: 'power' | 'distance' | 'time' = 'power';
  let sortedSignals: SignalMarker[] = [];
  
  $: {
    sortedSignals = [...signals].sort((a, b) => {
      switch (sortBy) {
        case 'power':
          return b.power - a.power;
        case 'distance':
          if ($userPosition) {
            const distA = calculateDistance($userPosition.lat, $userPosition.lon, a.lat, a.lon);
            const distB = calculateDistance($userPosition.lat, $userPosition.lon, b.lat, b.lon);
            return distA - distB;
          }
          return 0;
        case 'time':
          return b.timestamp - a.timestamp;
        default:
          return 0;
      }
    });
  }
  
  function getTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }
  
  function getSignalIcon(signal: SignalMarker): string {
    if (signal.source === SignalSource.HackRF) {
      return '📡';
    } else if (signal.metadata.signalType === 'wifi') {
      return '📶';
    } else if (signal.metadata.signalType === 'bluetooth') {
      return '🔷';
    }
    return '📊';
  }
</script>

<div class="bg-gray-900/90 backdrop-blur-sm text-white rounded-lg shadow-lg">
  <div class="p-4 border-b border-gray-700">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-lg font-bold">Signal List</h3>
      <span class="text-sm text-gray-400">{signals.length} signals</span>
    </div>
    
    <div class="flex space-x-2">
      <button
        on:click={() => sortBy = 'power'}
        class="px-3 py-1 text-xs rounded {sortBy === 'power' ? 'bg-cyan-600' : 'bg-gray-700'} hover:bg-cyan-600 transition-colors"
      >
        Power
      </button>
      <button
        on:click={() => sortBy = 'distance'}
        class="px-3 py-1 text-xs rounded {sortBy === 'distance' ? 'bg-cyan-600' : 'bg-gray-700'} hover:bg-cyan-600 transition-colors"
        disabled={!$userPosition}
      >
        Distance
      </button>
      <button
        on:click={() => sortBy = 'time'}
        class="px-3 py-1 text-xs rounded {sortBy === 'time' ? 'bg-cyan-600' : 'bg-gray-700'} hover:bg-cyan-600 transition-colors"
      >
        Recent
      </button>
    </div>
  </div>
  
  <div class="max-h-96 overflow-y-auto">
    {#if sortedSignals.length === 0}
      <p class="text-center text-gray-500 py-8">No signals detected</p>
    {:else}
      {#each sortedSignals as signal (signal.id)}
        <button
          on:click={() => onSignalClick(signal)}
          class="w-full p-3 hover:bg-gray-800/50 transition-colors border-b border-gray-800 text-left"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center mb-1">
                <span class="text-lg mr-2">{getSignalIcon(signal)}</span>
                <span class="font-semibold">
                  {signal.frequency} MHz
                  {#if signal.metadata.ssid}
                    - {signal.metadata.ssid}
                  {/if}
                </span>
              </div>
              
              <div class="text-sm text-gray-400 space-y-1">
                <div class="flex items-center space-x-3">
                  <span class="flex items-center">
                    <span class="w-2 h-2 rounded-full mr-1" 
                          style="background-color: {signal.power >= -50 ? '#ff0000' : 
                                                   signal.power >= -70 ? '#ffcc00' : '#00ff00'}">
                    </span>
                    {signal.power} dBm
                  </span>
                  
                  {#if $userPosition}
                    <span>
                      {formatDistance(calculateDistance($userPosition.lat, $userPosition.lon, signal.lat, signal.lon))}
                    </span>
                  {/if}
                  
                  <span>{getTimeAgo(signal.timestamp)}</span>
                </div>
                
                {#if signal.metadata.mac}
                  <div class="text-xs">MAC: {signal.metadata.mac}</div>
                {/if}
              </div>
            </div>
            
            <div class="ml-2">
              <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </button>
      {/each}
    {/if}
  </div>
</div>