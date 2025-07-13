/**
 * Example usage of API client services
 * This file demonstrates how to use the API clients in your Svelte components
 */

import { hackrfAPI, kismetAPI, systemAPI, APIError } from './index';
// Example usage - imports would be used in actual implementation
// import { logError, logInfo, logDebug } from '$lib/utils/logger';

// Example: Using HackRF API in a Svelte component
export async function hackrfExample() {
  try {
    // Check device status
    const status = await hackrfAPI.getStatus();
    // logDebug('HackRF Status:', { status });

    // Connect to device
    if (!status.connected) {
      await hackrfAPI.connect();
    }

    // Start frequency sweep with custom config
    await hackrfAPI.startSweep({
      startFreq: 88_000_000,    // 88 MHz
      endFreq: 108_000_000,     // 108 MHz
      gain: 40,
      amplifierEnabled: true
    });

    // Get sweep results
    const _results = await hackrfAPI.getSweepResults(50);
    // logDebug('Latest sweep results:', { results: _results });

    // Get detected signals
    const _signals = await hackrfAPI.getDetectedSignals({
      minPower: -60,
      frequencyRange: { start: 88_000_000, end: 108_000_000 }
    });
    // logDebug('Detected signals:', { signals: _signals });

  } catch (error) {
    if (error instanceof APIError) {
    // logError('API Error:', { message: error.message, status: error.status });
    } else {
    // logError('Unexpected error:', { error });
    }
  }
}

// Example: Using Kismet API in a Svelte component
export async function kismetExample() {
  try {
    // Check Kismet status
    const status = await kismetAPI.getStatus();
    // logDebug('Kismet Status:', { status });

    // Start Kismet if not running
    if (!status.running) {
      await kismetAPI.startService();
    }

    // Get all devices with pagination
    const { devices: _devices, total: _total } = await kismetAPI.getDevices({
      limit: 20,
      offset: 0,
      sort: 'lastSeen',
      order: 'desc'
    });
    // logDebug(`Found ${_total} devices, showing first 20:`, { devices: _devices });

    // Search for specific devices
    const _searchResults = await kismetAPI.searchDevices({
      minSignal: -70,
      lastSeenMinutes: 10,
      manufacturer: 'Apple'
    });
    // logDebug('Apple devices seen in last 10 minutes:', { searchResults: _searchResults });

    // Get channel statistics
    const _channelStats = await kismetAPI.getChannelStats();
    // logDebug('Channel usage:', { channelStats: _channelStats });

  } catch (error) {
    if (error instanceof APIError) {
    // logError('API Error:', { message: error.message, status: error.status });
    } else {
    // logError('Unexpected error:', { error });
    }
  }
}

// Example: Using System API in a Svelte component
export async function systemExample() {
  try {
    // Get system information
    const _info = await systemAPI.getInfo();
    // logDebug('System Info:', { info: _info });

    // Check system health
    const _health = await systemAPI.getHealth();
    // logDebug('System Health:', { health: _health });

    // Get all services status
    const _services = await systemAPI.getServices();
    // logDebug('Services:', { services: _services });

    // Get recent error logs
    const _logs = await systemAPI.getLogs({
      level: 'error',
      limit: 10,
      since: new Date(Date.now() - 3600000) // Last hour
    });
    // logDebug('Recent errors:', { logs: _logs });

  } catch (error) {
    if (error instanceof APIError) {
    // logError('API Error:', { message: error.message, status: error.status });
    } else {
    // logError('Unexpected error:', { error });
    }
  }
}

// Example: Using in a Svelte component with reactive updates
/*
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { hackrfAPI, type HackRFStatus } from '$lib/services/api';
  
  let status: HackRFStatus | null = null;
  let loading = false;
  let error: string | null = null;
  let refreshInterval: number;
  
  async function fetchStatus() {
    loading = true;
    error = null;
    
    try {
      status = await hackrfAPI.getStatus();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }
  
  onMount(() => {
    fetchStatus();
    // Refresh every 5 seconds
    refreshInterval = setInterval(fetchStatus, 5000);
  });
  
  onDestroy(() => {
    clearInterval(refreshInterval);
  });
</script>

<div>
  {#if loading && !status}
    <p>Loading...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
  {:else if status}
    <div>
      <p>Connected: {status.connected}</p>
      <p>Sweeping: {status.sweeping}</p>
      {#if status.currentFrequency}
        <p>Frequency: {(status.currentFrequency / 1_000_000).toFixed(3)} MHz</p>
      {/if}
    </div>
  {/if}
</div>
*/