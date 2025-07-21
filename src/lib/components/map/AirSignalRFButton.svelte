<script lang="ts">
  import { hackrfAPI } from '$lib/services/hackrf/api';
  
  export let enabled = false;
  export let onToggle: (enabled: boolean) => void = () => {};
  
  let isProcessing = false;
  
  async function toggle() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
      if (!enabled) {
        // Connect to data stream first
        hackrfAPI.connectToDataStream();
        
        // Start RF detection with wide frequency range
        const response = await fetch('/api/hackrf/start-sweep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frequencies: [
              { start: 1, stop: 6000, step: 1 }  // 1 MHz to 6 GHz
            ],
            cycleTime: 10  // 10 second cycles
          })
        });
        
        if (response.ok) {
          enabled = true;
          onToggle(true);
        } else {
          const errorData = await response.text();
          console.error('Failed to start HackRF sweep:', response.status, errorData);
          hackrfAPI.disconnect();
          alert(`HackRF sweep failed: ${response.status} - Check if HackRF is connected and hackrf_sweep is available`);
        }
      } else {
        // Stop RF detection
        const response = await fetch('/api/hackrf/stop-sweep', {
          method: 'POST'
        });
        
        // Disconnect data stream
        hackrfAPI.disconnect();
        
        if (response.ok) {
          enabled = false;
          onToggle(false);
        } else {
          console.error('Failed to stop HackRF sweep');
        }
      }
    } catch (error) {
      console.error('Error toggling RF detection:', error);
      hackrfAPI.disconnect();
    } finally {
      isProcessing = false;
    }
  }
</script>

<button 
  class="airsignal-rf-btn {enabled ? 'active' : ''} {isProcessing ? 'processing' : ''}"
  on:click={toggle}
  title="Toggle AirSignal RF Detection"
  disabled={isProcessing}
>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <circle cx="12" cy="12" r="10" stroke-width="2"/>
    <path d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12" stroke-width="2"/>
    <path d="M4.22 4.22 L7.05 7.05 M16.95 16.95 L19.78 19.78 M19.78 4.22 L16.95 7.05 M7.05 16.95 L4.22 19.78" stroke-width="1.5"/>
    {#if enabled}
      <circle cx="12" cy="12" r="4" fill="currentColor" class="pulse-center"/>
      <circle cx="12" cy="12" r="8" stroke-dasharray="2 2" class="pulse"/>
    {/if}
  </svg>
  📡 AirSignal RF {enabled ? 'ON' : 'OFF'}
</button>

<style>
  .airsignal-rf-btn {
    position: absolute;
    top: 80px;
    right: 10px;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid #444;
    color: #888;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    transition: all 0.3s;
  }
  
  .airsignal-rf-btn:hover:not(:disabled) {
    border-color: #666;
    color: #aaa;
  }
  
  .airsignal-rf-btn.active {
    background: #0a4f0a;
    border-color: #0f0;
    color: #0f0;
  }
  
  .airsignal-rf-btn.processing {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .airsignal-rf-btn:disabled {
    cursor: not-allowed;
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