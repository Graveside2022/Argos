<script lang="ts">
  import { onMount } from 'svelte';
  import { kismetRSSIService } from '$lib/services/map/kismetRSSIService';
  
  export let selectedDevice: string | null = null;
  export let onHeatmapToggle: (enabled: boolean) => void = () => {};
  
  let enabled = false;
  let status = {
    enabled: false,
    usingCoralTPU: false,
    deviceCount: 0,
    totalMeasurements: 0
  };
  
  let showDetails = false;
  
  onMount(async () => {
    // Initialize the service
    await kismetRSSIService.initialize();
    updateStatus();
    
    // Update status periodically
    const interval = setInterval(updateStatus, 2000);
    
    return () => {
      clearInterval(interval);
    };
  });
  
  function updateStatus() {
    status = kismetRSSIService.getStatus();
    enabled = status.enabled;
  }
  
  function toggleLocalization() {
    enabled = !enabled;
    kismetRSSIService.setEnabled(enabled);
    onHeatmapToggle(enabled);
    updateStatus();
  }
  
  function clearMeasurements() {
    if (selectedDevice) {
      kismetRSSIService.clearDeviceMeasurements(selectedDevice);
    } else {
      kismetRSSIService.clearAllMeasurements();
    }
    updateStatus();
  }
</script>

<div class="rssi-controls">
  <div class="control-header">
    <button 
      class="toggle-btn {enabled ? 'active' : ''}"
      on:click={toggleLocalization}
      title="Toggle RSSI Localization"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
        {#if enabled}
          <circle cx="12" cy="12" r="8" stroke-dasharray="2 2" class="pulse"/>
        {/if}
      </svg>
      RSSI Localization
    </button>
    
    {#if status.usingCoralTPU}
      <span class="coral-badge" title="Coral TPU Accelerated">
        ⚡ TPU
      </span>
    {/if}
  </div>
  
  {#if enabled}
    <div class="control-body">
      <div class="status-row">
        <span class="label">Devices:</span>
        <span class="value">{status.deviceCount}</span>
      </div>
      
      <div class="status-row">
        <span class="label">Measurements:</span>
        <span class="value">{status.totalMeasurements}</span>
      </div>
      
      {#if selectedDevice}
        <div class="selected-device">
          <span class="label">Selected:</span>
          <span class="mac">{selectedDevice}</span>
        </div>
      {/if}
      
      <button 
        class="clear-btn"
        on:click={clearMeasurements}
        disabled={status.totalMeasurements === 0}
      >
        Clear {selectedDevice ? 'Device' : 'All'} Data
      </button>
      
      <button
        class="details-btn"
        on:click={() => showDetails = !showDetails}
      >
        {showDetails ? 'Hide' : 'Show'} Details
      </button>
      
      {#if showDetails}
        <div class="details">
          <p>RSSI Localization estimates device positions based on signal strength measurements collected as the drone moves.</p>
          <p>Requirements:</p>
          <ul>
            <li>GPS accuracy &lt; 20m</li>
            <li>Min 5 measurements per device</li>
            <li>Movement helps improve accuracy</li>
          </ul>
          {#if status.usingCoralTPU}
            <p class="tpu-info">✅ Coral TPU detected - 10-50x faster processing!</p>
          {:else}
            <p class="tpu-info">ℹ️ Using CPU processing (Coral TPU not available)</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .rssi-controls {
    position: absolute;
    top: 80px;
    right: 10px;
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid #333;
    border-radius: 8px;
    padding: 10px;
    min-width: 250px;
    z-index: 1000;
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }
  
  .control-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: #222;
    border: 1px solid #444;
    color: #888;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
  }
  
  .toggle-btn:hover {
    border-color: #666;
    color: #aaa;
  }
  
  .toggle-btn.active {
    background: #0a4f0a;
    border-color: #0f0;
    color: #0f0;
  }
  
  .coral-badge {
    background: linear-gradient(135deg, #ff6b00, #ff8800);
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: bold;
  }
  
  .control-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .status-row {
    display: flex;
    justify-content: space-between;
    color: #aaa;
  }
  
  .label {
    color: #888;
  }
  
  .value {
    color: #0f0;
    font-weight: bold;
  }
  
  .selected-device {
    background: #111;
    padding: 5px;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .mac {
    color: #ff8800;
    font-size: 11px;
  }
  
  .clear-btn, .details-btn {
    background: #333;
    border: 1px solid #555;
    color: #aaa;
    padding: 5px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
  }
  
  .clear-btn:hover:not(:disabled) {
    background: #500;
    border-color: #f00;
    color: #f00;
  }
  
  .clear-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .details-btn:hover {
    background: #444;
    border-color: #666;
  }
  
  .details {
    margin-top: 10px;
    padding: 10px;
    background: #111;
    border-radius: 4px;
    color: #999;
    font-size: 11px;
  }
  
  .details p {
    margin: 5px 0;
  }
  
  .details ul {
    margin: 5px 0 5px 20px;
  }
  
  .tpu-info {
    margin-top: 10px;
    padding: 5px;
    border-radius: 4px;
  }
  
  .tpu-info:first-of-type {
    background: #0a4f0a;
    color: #0f0;
  }
  
  @keyframes pulse {
    0% { r: 8; opacity: 1; }
    100% { r: 12; opacity: 0; }
  }
  
  .pulse {
    animation: pulse 2s ease-out infinite;
  }
</style>