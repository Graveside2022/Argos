<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  export let timeWindow = 30; // Default 30 seconds
  export let minWindow = 10;
  export let maxWindow = 300;
  export let enabled = true;
  
  const dispatch = createEventDispatcher();
  
  let selectedPreset: number | null = null;
  let updateTimer: ReturnType<typeof setTimeout> | null = null;
  
  const presets = [
    { value: 10, label: '10s' },
    { value: 30, label: '30s' },
    { value: 60, label: '1m' },
    { value: 120, label: '2m' },
    { value: 300, label: '5m' }
  ];
  
  function handleTimeWindowChange() {
    // Clear preset selection if custom value
    selectedPreset = presets.find(p => p.value === timeWindow)?.value || null;
    
    // Debounce updates
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      dispatch('timeWindowChange', { timeWindow });
    }, 100);
  }
  
  function selectPreset(value: number) {
    timeWindow = value;
    selectedPreset = value;
    handleTimeWindowChange();
  }
  
  function formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
  }
  
  function toggleEnabled() {
    enabled = !enabled;
    dispatch('enabledChange', { enabled });
  }
  
  onDestroy(() => {
    if (updateTimer) clearTimeout(updateTimer);
  });
</script>

<div class="time-filter-controls {enabled ? '' : 'disabled'}">
  <div class="header">
    <h3 class="title">Time Filter</h3>
    <button 
      class="toggle-btn {enabled ? 'active' : ''}"
      on:click={toggleEnabled}
      title={enabled ? 'Disable time filter' : 'Enable time filter'}
    >
      {#if enabled}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      {:else}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18"></path>
        </svg>
      {/if}
    </button>
  </div>
  
  {#if enabled}
    <div class="controls">
      <!-- Preset buttons -->
      <div class="presets">
        {#each presets as preset}
          <button
            class="preset-btn {selectedPreset === preset.value ? 'selected' : ''}"
            on:click={() => selectPreset(preset.value)}
          >
            {preset.label}
          </button>
        {/each}
      </div>
      
      <!-- Time window slider -->
      <div class="slider-container">
        <label for="timeWindowSlider" class="slider-label">
          Window: <span class="time-value">{formatTime(timeWindow)}</span>
        </label>
        <input
          id="timeWindowSlider"
          type="range"
          min={minWindow}
          max={maxWindow}
          step="5"
          bind:value={timeWindow}
          on:input={handleTimeWindowChange}
          class="time-slider"
        />
        <div class="slider-bounds">
          <span class="min">{minWindow}s</span>
          <span class="max">{maxWindow}s</span>
        </div>
      </div>
      
      <!-- Info text -->
      <div class="info">
        <p class="info-text">
          Showing signals from the last {formatTime(timeWindow)}
        </p>
        <p class="info-text secondary">
          Older signals fade out automatically
        </p>
      </div>
    </div>
  {/if}
</div>

<style>
  .time-filter-controls {
    background: rgba(17, 24, 39, 0.95);
    backdrop-filter: blur(8px);
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    transition: opacity 0.2s;
  }
  
  .time-filter-controls.disabled {
    opacity: 0.7;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .title {
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
  }
  
  .toggle-btn {
    padding: 0.25rem;
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }
  
  .toggle-btn:hover {
    background: rgba(55, 65, 81, 0.5);
    color: white;
  }
  
  .toggle-btn.active {
    color: #06b6d4;
  }
  
  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .presets {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.25rem;
  }
  
  .preset-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    background: #374151;
    color: #9ca3af;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .preset-btn:hover {
    background: #4b5563;
    color: white;
  }
  
  .preset-btn.selected {
    background: #06b6d4;
    color: white;
    border-color: #0891b2;
  }
  
  .slider-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .slider-label {
    font-size: 0.75rem;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .time-value {
    color: white;
    font-weight: 500;
  }
  
  .time-slider {
    -webkit-appearance: none;
    width: 100%;
    height: 0.25rem;
    background: #374151;
    outline: none;
    border-radius: 0.125rem;
    cursor: pointer;
  }
  
  .time-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 1rem;
    height: 1rem;
    background: #06b6d4;
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.2s;
  }
  
  .time-slider::-webkit-slider-thumb:hover {
    background: #0891b2;
    transform: scale(1.1);
  }
  
  .time-slider::-moz-range-thumb {
    width: 1rem;
    height: 1rem;
    background: #06b6d4;
    cursor: pointer;
    border-radius: 50%;
    border: none;
    transition: all 0.2s;
  }
  
  .time-slider::-moz-range-thumb:hover {
    background: #0891b2;
    transform: scale(1.1);
  }
  
  .slider-bounds {
    display: flex;
    justify-content: space-between;
    font-size: 0.625rem;
    color: #6b7280;
  }
  
  .info {
    border-top: 1px solid #374151;
    padding-top: 0.75rem;
  }
  
  .info-text {
    font-size: 0.75rem;
    color: #9ca3af;
    margin: 0.25rem 0;
  }
  
  .info-text.secondary {
    color: #6b7280;
    font-size: 0.625rem;
  }
</style>