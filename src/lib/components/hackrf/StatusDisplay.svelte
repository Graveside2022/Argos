<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { hackrfService } from '$lib/services/hackrf';
  import type { HackRFStatus, SpectrumData, SignalDetection } from '$lib/services/api/hackrf';
  
  let currentFrequency = '0.0';
  let cycleStatus = 'Disconnected';
  let signalStrength = -100;
  let elapsedTime = '00:00';
  let isConnected = false;
  let _detectedSignals: SignalDetection[] = [];
  let sweepStartTime: number | null = null;
  let timeInterval: ReturnType<typeof setInterval> | null = null;
  
  // Subscribe to service data
  let statusUnsubscribe: (() => void) | undefined;
  let spectrumUnsubscribe: (() => void) | undefined;
  let signalsUnsubscribe: (() => void) | undefined;
  
  function updateElapsedTime() {
    if (!sweepStartTime) {
      elapsedTime = '00:00';
      return;
    }
    
    const elapsed = Date.now() - sweepStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    elapsedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  onMount(() => {
    // Subscribe to status updates
    statusUnsubscribe = hackrfService.status.subscribe((status: HackRFStatus) => {
      isConnected = status.connected;
      
      if (status.connected && status.sweeping) {
        cycleStatus = 'Sweeping';
        if (!sweepStartTime) {
          sweepStartTime = Date.now();
          timeInterval = setInterval(updateElapsedTime, 1000);
        }
      } else if (status.connected) {
        cycleStatus = 'Idle';
        if (timeInterval) {
          clearInterval(timeInterval);
          timeInterval = null;
          sweepStartTime = null;
          elapsedTime = '00:00';
        }
      } else {
        cycleStatus = 'Disconnected';
        if (timeInterval) {
          clearInterval(timeInterval);
          timeInterval = null;
          sweepStartTime = null;
          elapsedTime = '00:00';
        }
      }
      
      // Update current frequency from status
      if (status.currentFrequency) {
        currentFrequency = (status.currentFrequency / 1e6).toFixed(1);
      }
    });
    
    // Subscribe to spectrum data for real-time frequency
    spectrumUnsubscribe = hackrfService.spectrumData.subscribe((data: SpectrumData | null) => {
      if (data && data.centerFrequency) {
        currentFrequency = (data.centerFrequency / 1e6).toFixed(1);
        
        // Find peak power in spectrum
        if (data.powers && data.powers.length > 0) {
          const maxPower = Math.max(...data.powers);
          signalStrength = Math.round(maxPower);
        }
      }
    });
    
    // Subscribe to detected signals
    signalsUnsubscribe = hackrfService.detectedSignals.subscribe((signals: SignalDetection[]) => {
      _detectedSignals = signals;
      
      // Show strength of most recent strong signal
      if (signals.length > 0) {
        const recentSignal = signals[signals.length - 1];
        if (recentSignal && recentSignal.power > signalStrength) {
          signalStrength = Math.round(recentSignal.power);
        }
      }
    });
  });
  
  onDestroy(() => {
    if (statusUnsubscribe) statusUnsubscribe();
    if (spectrumUnsubscribe) spectrumUnsubscribe();
    if (signalsUnsubscribe) signalsUnsubscribe();
    if (timeInterval) clearInterval(timeInterval);
  });
</script>

<!-- Status Display -->
<div class="glass-panel rounded-2xl p-8">
  <div class="flex items-center justify-between mb-6">
    <h2 class="font-heading text-2xl font-bold">System Status</h2>
    <div class="flex items-center space-x-2">
      <div class="w-2 h-2 rounded-full {isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}"></div>
      <span class="text-sm text-text-secondary">{isConnected ? 'Connected' : 'Disconnected'}</span>
    </div>
  </div>
  
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- Current Frequency -->
    <div class="glass-panel-light rounded-xl p-6">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-text-muted uppercase tracking-wide">Current Frequency</span>
        <svg class="w-5 h-5 text-neon-cyan" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 12h4l3-9 4 18 3-9h4M3 3v18M21 3v18"/>
        </svg>
      </div>
      <div class="flex items-baseline space-x-2">
        <span class="text-3xl font-bold font-mono">{currentFrequency}</span>
        <span class="text-sm text-text-secondary">MHz</span>
      </div>
    </div>
    
    <!-- Cycle Status -->
    <div class="glass-panel-light rounded-xl p-6">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-text-muted uppercase tracking-wide">Cycle Status</span>
        <svg class="w-5 h-5 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/>
        </svg>
      </div>
      <div class="flex items-baseline space-x-2">
        <span class="text-2xl font-semibold">{cycleStatus}</span>
      </div>
    </div>
    
    <!-- Signal Strength -->
    <div class="glass-panel-light rounded-xl p-6">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-text-muted uppercase tracking-wide">Signal Strength</span>
        <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.265a1.542 1.542 0 01.997 0c.22.069.412.162.567.265a.752.752 0 01.302.442c.055.174.083.358.083.55 0 .192-.028.376-.083.55a.752.752 0 01-.302.442c-.155.103-.346.196-.567.265a1.542 1.542 0 01-.997 0 1.531 1.531 0 01-.567-.265.752.752 0 01-.302-.442 1.534 1.534 0 01-.083-.55c0-.192.028-.376.083-.55a.752.752 0 01.302-.442zM11 2a1 1 0 011 1v2.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L9 5.586V3a1 1 0 011-1zm0 16a1 1 0 01-1-1v-2.586l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 14.414V17a1 1 0 01-1 1z"/>
        </svg>
      </div>
      <div class="flex items-baseline space-x-2">
        <span class="text-3xl font-bold font-mono">{signalStrength}</span>
        <span class="text-sm text-text-secondary">dBm</span>
      </div>
    </div>
    
    <!-- Elapsed Time -->
    <div class="glass-panel-light rounded-xl p-6">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-text-muted uppercase tracking-wide">Elapsed Time</span>
        <svg class="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/>
        </svg>
      </div>
      <div class="flex items-baseline space-x-2">
        <span class="text-2xl font-semibold font-mono">{elapsedTime}</span>
      </div>
    </div>
  </div>
</div>