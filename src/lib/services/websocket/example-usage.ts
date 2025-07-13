/**
 * Example usage of WebSocket services in Svelte components
 */

// Example usage - imports would be used in actual implementation
// import { logError, logInfo } from '$lib/utils/logger';

// Example 1: Using individual WebSocket clients in a Svelte component
/*
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getHackRFWebSocketClient, getKismetWebSocketClient } from '$lib/services/websocket';
  import { spectrumData, sweepStatus, connectionStatus as hackrfConnection } from '$lib/stores/hackrf';
  import { devices, alerts, connectionStatus as kismetConnection } from '$lib/stores/kismet';
  
  let hackrfClient: ReturnType<typeof getHackRFWebSocketClient>;
  let kismetClient: ReturnType<typeof getKismetWebSocketClient>;
  
  onMount(() => {
    // Initialize WebSocket clients
    hackrfClient = getHackRFWebSocketClient({
      reconnectInterval: 3000,
      bufferSize: 20
    });
    
    kismetClient = getKismetWebSocketClient({
      reconnectInterval: 5000
    });
    
    // Connect to servers
    hackrfClient.connect();
    kismetClient.connect();
    
    // Subscribe to specific HackRF events
    hackrfClient.on('error', (event) => {
      // logError('HackRF error:', { error: event.error });
    });
    
    // Subscribe to Kismet events
    kismetClient.on('open', () => {
      // logInfo('Kismet connected!');
      // Request initial data
      kismetClient.requestDevicesList();
    });
  });
  
  onDestroy(() => {
    // Clean up connections
    hackrfClient?.disconnect();
    kismetClient?.disconnect();
  });
  
  function startSweep() {
    hackrfClient?.startSweep({
      startFreq: 400e6,
      endFreq: 500e6,
      gain: 30
    });
  }
  
  function stopSweep() {
    hackrfClient?.stopSweep();
  }
</script>

<div>
  {#if $hackrfConnection.connected}
    <button on:click={startSweep}>Start Sweep</button>
    <button on:click={stopSweep}>Stop Sweep</button>
  {:else}
    <p>HackRF not connected</p>
  {/if}
  
  {#if $spectrumData}
    <p>Center Freq: {$spectrumData.centerFreq}</p>
    <p>Peak Power: {Math.max(...$spectrumData.power)} dBm</p>
  {/if}
  
  <h3>Kismet Devices ({$devices.size})</h3>
  {#each [...$devices.values()] as device}
    <div>{device.ssid || device.mac} - {device.signal}dBm</div>
  {/each}
</div>
*/

// Example 2: Using the WebSocket Manager in app initialization
/*
// In +layout.svelte or app initialization
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getWebSocketManager } from '$lib/services/websocket';
  import { browser } from '$app/environment';
  
  let wsManager: ReturnType<typeof getWebSocketManager>;
  
  onMount(() => {
    if (browser) {
      // Initialize WebSocket manager with configuration
      wsManager = getWebSocketManager({
        hackrf: {
          url: 'ws://localhost:5173/ws/hackrf',
          reconnectInterval: 3000,
          bufferSize: 15
        },
        kismet: {
          url: 'ws://localhost:5173/ws/kismet',
          reconnectInterval: 5000
        },
        autoConnect: true // Automatically connect on initialization
      });
      
      wsManager.init();
    }
  });
  
  onDestroy(() => {
    wsManager?.destroy();
  });
</script>
*/

// Example 3: Using stores reactively with auto-subscriptions
/*
<script lang="ts">
  import { 
    spectrumData, 
    sweepProgress, 
    formatFrequency, 
    formatPower 
  } from '$lib/stores/hackrf';
  import { 
    deviceList, 
    recentAlerts, 
    deviceCount 
  } from '$lib/stores/kismet';
  import {
    allConnected,
    connectionErrors,
    systemHealthy
  } from '$lib/stores/connection';
  
  // Reactive statements
  $: isScanning = $sweepProgress > 0;
  $: hasDevices = $deviceCount > 0;
</script>

<div class="dashboard">
  <!-- Connection Status -->
  <div class="status-bar" class:connected={$allConnected}>
    {#if $allConnected}
      <span>✓ All systems connected</span>
    {:else}
      <span>⚠ Connection issues</span>
      {#each $connectionErrors as error}
        <p class="error">{error}</p>
      {/each}
    {/if}
  </div>
  
  <!-- System Health -->
  <div class="health" class:healthy={$systemHealthy}>
    System: {$systemHealthy ? 'Healthy' : 'Check required'}
  </div>
  
  <!-- Spectrum Display -->
  {#if $spectrumData}
    <div class="spectrum">
      <h3>Spectrum Analysis</h3>
      <p>Center: {formatFrequency($spectrumData.centerFreq)}</p>
      <p>Max Power: {formatPower(Math.max(...$spectrumData.power))}</p>
      <!-- Add spectrum visualization here -->
    </div>
  {/if}
  
  <!-- Device List -->
  <div class="devices">
    <h3>Detected Devices ({$deviceCount})</h3>
    {#each $deviceList as device}
      <div class="device-card">
        <strong>{device.ssid || 'Hidden'}</strong>
        <span>{device.mac}</span>
        <span>{device.signal}dBm</span>
      </div>
    {/each}
  </div>
  
  <!-- Recent Alerts -->
  <div class="alerts">
    <h3>Recent Alerts</h3>
    {#each $recentAlerts as alert}
      <div class="alert {alert.severity}">
        <time>{new Date(alert.timestamp).toLocaleTimeString()}</time>
        <p>{alert.message}</p>
      </div>
    {/each}
  </div>
</div>
*/

// Example 4: Custom event handling and message filtering
/*
<script lang="ts">
  import { onMount } from 'svelte';
  import { getHackRFWebSocketClient } from '$lib/services/websocket';
  
  let client: ReturnType<typeof getHackRFWebSocketClient>;
  let customData: any[] = [];
  
  onMount(() => {
    client = getHackRFWebSocketClient();
    
    // Add custom message handler
    client.onMessage('custom_event', (data) => {
      customData = [...customData, data];
    });
    
    // Listen to raw WebSocket events
    client.on('message', (event) => {
      if (event.data?.type === 'special_alert') {
        // Handle special alerts
      // logInfo('Special alert:', { data: event.data });
      }
    });
    
    // Connection state monitoring
    client.on('open', () => logInfo('Connected'));
    client.on('close', () => logInfo('Disconnected'));
    client.on('reconnecting', (event) => {
      // logInfo(`Reconnecting... Attempt ${event.data.attempt}`);
    });
    
    client.connect();
  });
</script>
*/

// Example 5: Integration with forms and user input
/*
<script lang="ts">
  import { getHackRFWebSocketClient } from '$lib/services/websocket';
  import { sweepStatus } from '$lib/stores/hackrf';
  
  let client = getHackRFWebSocketClient();
  let startFreq = 400;
  let endFreq = 500;
  let gain = 30;
  
  function handleSubmit() {
    if ($sweepStatus.active) {
      client.stopSweep();
    } else {
      client.startSweep({
        startFreq: startFreq * 1e6,
        endFreq: endFreq * 1e6,
        gain
      });
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <label>
    Start Frequency (MHz):
    <input type="number" bind:value={startFreq} min="1" max="6000" />
  </label>
  
  <label>
    End Frequency (MHz):
    <input type="number" bind:value={endFreq} min="1" max="6000" />
  </label>
  
  <label>
    Gain:
    <input type="range" bind:value={gain} min="0" max="47" />
    <span>{gain} dB</span>
  </label>
  
  <button type="submit">
    {$sweepStatus.active ? 'Stop Sweep' : 'Start Sweep'}
  </button>
</form>
*/

export {};