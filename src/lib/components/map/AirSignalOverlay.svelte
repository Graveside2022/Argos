<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { hackrfAPI } from '$lib/services/hackrf/api';
  import { spectrumData } from '$lib/stores/hackrf';
  
  export let isOpen = false;
  export let onClose: () => void = () => {};
  
  // State
  let isRFEnabled = false;
  let isProcessing = false;
  let connectionStatus = 'Disconnected';
  let signalCount = 0;
  let targetFrequency = '';
  let frequencyBands = {
    wifi24: false,
    wifi5: false,
    drone24: false,
    drone58: false,
    drone900: false,
    custom: false
  };
  
  // Signal stats
  let detectedSignals: Array<{
    frequency: number;
    power: number;
    type: string;
    timestamp: number;
  }> = [];
  
  let updateInterval: ReturnType<typeof setInterval>;
  let spectrumUnsubscribe: (() => void) | null = null;
  
  async function toggleRFDetection() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
      if (!isRFEnabled) {
        // First check if HackRF is already running
        const statusResponse = await fetch('/api/hackrf/status');
        const status = await statusResponse.json();
        
        console.log('HackRF current status:', status);
        
        if (status.state === 'running') {
          // HackRF is already running, just connect to existing stream
          isRFEnabled = true;
          connectionStatus = 'Connected (Using Existing Sweep)';
          console.log('HackRF already running, connecting to existing data stream');
          
          // Reconnect to data stream
          hackrfAPI.reconnect();
          
          // Subscribe to spectrum data
          if (!spectrumUnsubscribe) {
            spectrumUnsubscribe = spectrumData.subscribe((data) => {
              console.log('Received spectrum data:', data);
              if (data && isRFEnabled) {
                processSpectrumData(data);
              }
            });
          }
        } else {
          // HackRF not running, start new sweep
          // Connect to data stream
          hackrfAPI.connectToDataStream();
          connectionStatus = 'Connecting...';
          
          // Build frequency ranges based on selected bands
          const frequencies = [];
          
          if (frequencyBands.wifi24) {
            frequencies.push({ start: 2400, stop: 2500, step: 1 });
          }
          if (frequencyBands.wifi5) {
            frequencies.push({ start: 5150, stop: 5850, step: 5 });
          }
          if (frequencyBands.drone24) {
            frequencies.push({ start: 2400, stop: 2483, step: 1 });
          }
          if (frequencyBands.drone58) {
            frequencies.push({ start: 5725, stop: 5875, step: 1 });
          }
          if (frequencyBands.drone900) {
            frequencies.push({ start: 900, stop: 928, step: 1 });
          }
          if (frequencyBands.custom && targetFrequency) {
            const freq = Number(targetFrequency);
            frequencies.push({ start: freq - 10, stop: freq + 10, step: 1 });
          }
          
          // If no specific bands selected, use wide scan
          if (frequencies.length === 0) {
            frequencies.push({ start: 1, stop: 6000, step: 1 });
          }
          
          // Start RF sweep
          const response = await fetch('/api/hackrf/start-sweep', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              frequencies,
              cycleTime: 10
            })
          });
          
          if (response.ok) {
            isRFEnabled = true;
            connectionStatus = 'Connected';
            console.log('HackRF sweep started successfully with frequencies:', frequencies);
            
            // Subscribe to spectrum data
            if (!spectrumUnsubscribe) {
              spectrumUnsubscribe = spectrumData.subscribe((data) => {
                console.log('Received spectrum data:', data);
                if (data && isRFEnabled) {
                  processSpectrumData(data);
                }
              });
            }
          } else {
            const errorText = await response.text();
            console.error('Failed to start HackRF sweep:', response.status, errorText);
            connectionStatus = 'Connection Failed';
            hackrfAPI.disconnect();
            alert('Failed to start HackRF sweep. Check if HackRF is connected.');
          }
        }
      } else {
        // Stop RF detection - don't stop the actual sweep, just disconnect from data
        hackrfAPI.disconnect();
        
        if (spectrumUnsubscribe) {
          spectrumUnsubscribe();
          spectrumUnsubscribe = null;
        }
        
        isRFEnabled = false;
        connectionStatus = 'Disconnected';
        detectedSignals = [];
        signalCount = 0;
      }
    } catch (error) {
      console.error('Error toggling RF detection:', error);
      connectionStatus = 'Error';
      hackrfAPI.disconnect();
    } finally {
      isProcessing = false;
    }
  }
  
  function processSpectrumData(data: any) {
    // Debug logging
    console.log('Processing spectrum data:', data);
    
    const freq = data.peak_freq || data.centerFreq;
    const power = data.peak_power || data.avg_power;
    
    // Lower threshold to -90 dBm to catch weaker signals
    if (!freq || !power || power < -90) return;
    
    // Classify signal type
    let signalType = 'Unknown';
    
    if (freq >= 2400 && freq <= 2500) {
      signalType = 'WiFi 2.4GHz / Drone';
    } else if (freq >= 5150 && freq <= 5850) {
      signalType = 'WiFi 5GHz';
    } else if (freq >= 5725 && freq <= 5875) {
      signalType = 'Drone Video';
    } else if (freq >= 900 && freq <= 928) {
      signalType = 'Drone Control';
    }
    
    // Add to detected signals
    detectedSignals = [
      {
        frequency: freq,
        power: power,
        type: signalType,
        timestamp: Date.now()
      },
      ...detectedSignals.slice(0, 49) // Keep last 50 signals
    ];
    
    signalCount = detectedSignals.length;
  }
  
  function getSignalStrength(power: number): string {
    if (power > -50) return 'Very Strong';
    if (power > -60) return 'Strong';
    if (power > -70) return 'Good';
    if (power > -80) return 'Fair';
    return 'Weak';
  }
  
  function getSignalColor(power: number): string {
    if (power > -50) return '#ff0000';
    if (power > -60) return '#ff4400';
    if (power > -70) return '#ff8800';
    if (power > -80) return '#ffff00';
    return '#0088ff';
  }
  
  function toggleFrequencyBand(band: keyof typeof frequencyBands) {
    frequencyBands[band] = !frequencyBands[band];
    // Don't automatically restart - user needs to toggle RF detection manually
  }
  
  function applyCustomFrequency() {
    if (!targetFrequency || isNaN(Number(targetFrequency))) {
      alert('Please enter a valid frequency in MHz');
      return;
    }
    
    frequencyBands.custom = true;
    // Don't automatically restart - user needs to toggle RF detection manually
  }
  
  onMount(() => {
    // Update detected signals periodically
    updateInterval = setInterval(() => {
      // Remove signals older than 30 seconds
      const cutoff = Date.now() - 30000;
      detectedSignals = detectedSignals.filter(s => s.timestamp > cutoff);
      signalCount = detectedSignals.length;
    }, 1000);
  });
  
  onDestroy(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    
    if (spectrumUnsubscribe) {
      spectrumUnsubscribe();
    }
    
    // Stop RF if still running
    if (isRFEnabled) {
      fetch('/api/hackrf/stop-sweep', { method: 'POST' });
      hackrfAPI.disconnect();
    }
  });
</script>

{#if isOpen}
<div class="overlay-backdrop" on:click={onClose}>
  <div class="overlay-container" on:click|stopPropagation>
    <!-- Header -->
    <div class="overlay-header">
      <h2>AirSignal RF Detection</h2>
      <button class="close-button" on:click={onClose}>×</button>
    </div>
    
    <!-- Status Bar -->
    <div class="status-bar">
      <div class="status-item">
        <span class="status-label">Status:</span>
        <span class="status-value {isRFEnabled ? 'connected' : 'disconnected'}">
          {connectionStatus}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">Mode:</span>
        <span class="status-value">{isRFEnabled ? 'Scanning' : 'Idle'}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Signals:</span>
        <span class="status-value">{signalCount}</span>
      </div>
    </div>
    
    <!-- Main Control -->
    <div class="main-control">
      <button 
        class="rf-toggle-button {isRFEnabled ? 'active' : ''} {isProcessing ? 'processing' : ''}"
        on:click={toggleRFDetection}
        disabled={isProcessing}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <path d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12" stroke-width="2"/>
          <path d="M4.22 4.22 L7.05 7.05 M16.95 16.95 L19.78 19.78 M19.78 4.22 L16.95 7.05 M7.05 16.95 L4.22 19.78" stroke-width="1.5"/>
          {#if isRFEnabled}
            <circle cx="12" cy="12" r="4" fill="currentColor" class="pulse-center"/>
            <circle cx="12" cy="12" r="8" stroke-dasharray="2 2" class="pulse"/>
          {/if}
        </svg>
        <span>{isRFEnabled ? 'RF Detection ON' : 'RF Detection OFF'}</span>
      </button>
    </div>
    
    <!-- Frequency Bands -->
    <div class="frequency-section">
      <h3>Target Frequencies</h3>
      <div class="frequency-grid">
        <button 
          class="freq-button {frequencyBands.wifi24 ? 'active' : ''}"
          on:click={() => toggleFrequencyBand('wifi24')}
        >
          <span class="freq-icon">📶</span>
          <span class="freq-name">WiFi 2.4GHz</span>
          <span class="freq-range">2400-2500 MHz</span>
        </button>
        
        <button 
          class="freq-button {frequencyBands.wifi5 ? 'active' : ''}"
          on:click={() => toggleFrequencyBand('wifi5')}
        >
          <span class="freq-icon">📶</span>
          <span class="freq-name">WiFi 5GHz</span>
          <span class="freq-range">5150-5850 MHz</span>
        </button>
        
        <button 
          class="freq-button {frequencyBands.drone24 ? 'active' : ''}"
          on:click={() => toggleFrequencyBand('drone24')}
        >
          <span class="freq-icon">🚁</span>
          <span class="freq-name">Drone 2.4GHz</span>
          <span class="freq-range">2400-2483 MHz</span>
        </button>
        
        <button 
          class="freq-button {frequencyBands.drone58 ? 'active' : ''}"
          on:click={() => toggleFrequencyBand('drone58')}
        >
          <span class="freq-icon">🚁</span>
          <span class="freq-name">Drone 5.8GHz</span>
          <span class="freq-range">5725-5875 MHz</span>
        </button>
        
        <button 
          class="freq-button {frequencyBands.drone900 ? 'active' : ''}"
          on:click={() => toggleFrequencyBand('drone900')}
        >
          <span class="freq-icon">🚁</span>
          <span class="freq-name">Drone 900MHz</span>
          <span class="freq-range">900-928 MHz</span>
        </button>
      </div>
      
      <!-- Custom Frequency -->
      <div class="custom-freq">
        <input 
          type="number" 
          placeholder="Custom frequency (MHz)"
          bind:value={targetFrequency}
          class="freq-input"
        />
        <button 
          class="apply-button"
          on:click={applyCustomFrequency}
        >
          Apply
        </button>
      </div>
    </div>
    
    <!-- Detected Signals -->
    <div class="signals-section">
      <h3>Detected Signals</h3>
      <div class="signals-table">
        <div class="table-header">
          <div>Frequency</div>
          <div>Power</div>
          <div>Strength</div>
          <div>Type</div>
          <div>Age</div>
        </div>
        <div class="table-body">
          {#each detectedSignals as signal}
            <div class="table-row">
              <div>{signal.frequency.toFixed(1)} MHz</div>
              <div style="color: {getSignalColor(signal.power)}">{signal.power.toFixed(1)} dBm</div>
              <div>{getSignalStrength(signal.power)}</div>
              <div>{signal.type}</div>
              <div>{Math.floor((Date.now() - signal.timestamp) / 1000)}s</div>
            </div>
          {/each}
          
          {#if detectedSignals.length === 0}
            <div class="empty-message">
              {isRFEnabled ? 'Scanning for signals...' : 'Start RF detection to see signals'}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
{/if}

<style>
  .overlay-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }
  
  .overlay-container {
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 8px;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
  
  .overlay-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #444;
    background: #2a2a2a;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  
  .overlay-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #fff;
  }
  
  .close-button {
    background: none;
    border: none;
    color: #888;
    font-size: 2rem;
    cursor: pointer;
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .close-button:hover {
    color: #fff;
    background: #444;
  }
  
  .status-bar {
    display: flex;
    gap: 2rem;
    padding: 1rem 1.5rem;
    background: #222;
    border-bottom: 1px solid #444;
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .status-label {
    color: #888;
    font-size: 0.875rem;
  }
  
  .status-value {
    color: #fff;
    font-weight: 500;
  }
  
  .status-value.connected {
    color: #10b981;
  }
  
  .status-value.disconnected {
    color: #ef4444;
  }
  
  .main-control {
    display: flex;
    justify-content: center;
    padding: 2rem;
  }
  
  .rf-toggle-button {
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #444;
    color: #888;
    padding: 1rem 2rem;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 1.125rem;
    font-weight: 500;
    transition: all 0.3s;
  }
  
  .rf-toggle-button:hover:not(:disabled) {
    border-color: #666;
    color: #aaa;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }
  
  .rf-toggle-button.active {
    background: #0a4f0a;
    border-color: #0f0;
    color: #0f0;
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
  }
  
  .rf-toggle-button.processing {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .frequency-section {
    padding: 0 1.5rem 1.5rem;
  }
  
  .frequency-section h3 {
    color: #fff;
    margin-bottom: 1rem;
  }
  
  .frequency-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .freq-button {
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 8px;
    padding: 1rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    font-family: inherit;
    color: inherit;
  }
  
  .freq-button:hover {
    background: #333;
    border-color: #555;
    transform: translateY(-2px);
  }
  
  .freq-button.active {
    background: #1e3a8a;
    border-color: #3b82f6;
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
  }
  
  .freq-icon {
    font-size: 1.5rem;
  }
  
  .freq-name {
    color: #fff;
    font-weight: 500;
  }
  
  .freq-range {
    color: #888;
    font-size: 0.75rem;
  }
  
  .custom-freq {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }
  
  .freq-input {
    flex: 1;
    background: #2a2a2a;
    border: 1px solid #444;
    color: #fff;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-family: inherit;
  }
  
  .freq-input:focus {
    outline: none;
    border-color: #3b82f6;
  }
  
  .apply-button {
    background: #3b82f6;
    border: none;
    color: #fff;
    padding: 0.5rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .apply-button:hover {
    background: #2563eb;
  }
  
  .signals-section {
    padding: 0 1.5rem 1.5rem;
  }
  
  .signals-section h3 {
    color: #fff;
    margin-bottom: 1rem;
  }
  
  .signals-table {
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 6px;
    overflow: hidden;
  }
  
  .table-header {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1.5fr 0.8fr;
    padding: 0.75rem 1rem;
    background: #333;
    border-bottom: 1px solid #444;
    color: #888;
    font-size: 0.875rem;
    font-weight: 600;
  }
  
  .table-body {
    max-height: 300px;
    overflow-y: auto;
  }
  
  .table-row {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1.5fr 0.8fr;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #333;
    color: #ccc;
    font-size: 0.875rem;
  }
  
  .table-row:hover {
    background: #333;
  }
  
  .empty-message {
    padding: 3rem;
    text-align: center;
    color: #666;
  }
  
  @keyframes pulse {
    0% { r: 8; opacity: 1; }
    100% { r: 12; opacity: 0; }
  }
  
  @keyframes pulse-center {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
  
  .pulse {
    animation: pulse 2s ease-out infinite;
  }
  
  .pulse-center {
    animation: pulse-center 1s ease-in-out infinite;
  }
</style>