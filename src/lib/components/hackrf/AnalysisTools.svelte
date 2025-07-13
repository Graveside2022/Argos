<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { hackrfService } from '$lib/services/hackrf';
  import type { SignalDetection } from '$lib/services/api/hackrf';
  
  let detectedSignals: SignalDetection[] = [];
  let signalsUnsubscribe: (() => void) | undefined;
  let isExporting = false;
  
  function launchOpenWebRX() {
    window.open('http://localhost:8073', '_blank');
  }
  
  function launchSpectrumAnalyzer() {
    window.open('http://localhost:8092', '_blank');
  }
  
  function exportData(format: 'csv' | 'json') {
    isExporting = true;
    try {
      void hackrfService.exportData(format);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      isExporting = false;
    }
  }
  
  onMount(() => {
    // Subscribe to detected signals
    signalsUnsubscribe = hackrfService.detectedSignals.subscribe((signals: SignalDetection[]) => {
      detectedSignals = signals.slice(-5); // Keep last 5 signals
    });
  });
  
  onDestroy(() => {
    if (signalsUnsubscribe) signalsUnsubscribe();
  });
</script>

<div class="saasfly-feature-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-purple-400/30 hover:bg-gradient-to-br hover:from-bg-card/90 hover:via-bg-card/70 hover:to-bg-card/50 transition-all duration-300">
  <div class="flex items-center mb-6">
    <div class="p-3 bg-gradient-to-br from-purple-500/20 to-purple-500/10 rounded-xl mr-4 border border-purple-400/20 group-hover:border-purple-400/40 group-hover:shadow-lg group-hover:shadow-purple-400/20 transition-all duration-300">
      <svg class="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01.293.707V12a1 1 0 01-.293.707l-2.293 2.293H8a1 1 0 010 2H4a1 1 0 01-1-1v-4a1 1 0 01.293-.707L5.586 9 3.293 6.707A1 1 0 013 6V4zm8-2a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-.293.707L14.414 7l2.293 2.293A1 1 0 0117 10v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293A1 1 0 0111 10V8a1 1 0 01.293-.707L13.586 5H12a1 1 0 010-2z"/>
      </svg>
    </div>
    <div>
      <h3 class="font-heading text-xl font-semibold external-tools-header mb-1 transition-colors duration-300">Analysis Tools</h3>
      <p class="text-sm text-text-muted group-hover:text-text-secondary transition-colors duration-300">External monitoring tools</p>
    </div>
  </div>
  
  <div class="space-y-6">
    <!-- External Tools -->
    <div class="space-y-3">
      <button on:click={launchOpenWebRX} class="saasfly-btn saasfly-btn-outline w-full group">
        <svg class="w-4 h-4 group-hover:text-neon-cyan transition-colors duration-200" fill="currentColor" viewBox="0 0 20 20">
          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
        </svg>
        Open WebRX
      </button>
      
      <button on:click={launchSpectrumAnalyzer} class="saasfly-btn saasfly-btn-outline w-full group">
        <svg class="w-4 h-4 group-hover:text-purple-400 transition-colors duration-200" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/>
          <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/>
        </svg>
        Spectrum Analyzer
      </button>
    </div>
    
    <!-- Detected Signals -->
    {#if detectedSignals.length > 0}
      <div>
        <h4 class="text-sm font-medium text-text-muted mb-3 uppercase tracking-wide">Recent Signals</h4>
        <div class="space-y-2 max-h-[150px] overflow-y-auto">
          {#each detectedSignals as signal}
            <div class="p-3 bg-bg-input/40 rounded-lg border border-border-primary/30 hover:border-purple-400/30 transition-all duration-200">
              <div class="flex justify-between items-center">
                <span class="font-mono text-sm">{(signal.frequency / 1e6).toFixed(2)} MHz</span>
                <span class="text-xs text-text-muted">{signal.power.toFixed(1)} dBm</span>
              </div>
              {#if signal.modulation}
                <span class="text-xs text-purple-400">{signal.modulation}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    <!-- Export Options -->
    <div>
      <h4 class="text-sm font-medium text-text-muted mb-3 uppercase tracking-wide">Export Data</h4>
      <div class="grid grid-cols-2 gap-2">
        <button 
          on:click={() => exportData('json')}
          disabled={isExporting}
          class="saasfly-btn saasfly-btn-sm saasfly-btn-secondary"
          class:opacity-50={isExporting}
        >
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
          </svg>
          JSON
        </button>
        <button 
          on:click={() => exportData('csv')}
          disabled={isExporting}
          class="saasfly-btn saasfly-btn-sm saasfly-btn-secondary"
          class:opacity-50={isExporting}
        >
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
          </svg>
          CSV
        </button>
      </div>
    </div>
  </div>
</div>