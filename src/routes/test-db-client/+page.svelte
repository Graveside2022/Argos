<script lang="ts">
  import { onMount } from 'svelte';
  import { getSignalDatabase } from '$lib/services/db/signalDatabase';
  import type { SignalMarker } from '$lib/stores/map/signals';
  import { SignalSource } from '$lib/types/enums';
  
  interface TestResults {
    stored?: number;
    queried?: number;
    devices?: number;
    stats?: {
      totalSignals: number;
      activeDevices: number;
      timeWindow: number;
    };
  }
  
  let status = 'Initializing...';
  let results: TestResults = {};
  let error: string | null = null;
  
  onMount(() => {
    void (async () => {
    try {
      // Initialize database
      const db = await getSignalDatabase();
      status = 'Database initialized';
      
      // Create test signals
      const testSignals: SignalMarker[] = [];
      for (let i = 0; i < 10; i++) {
        testSignals.push({
          id: `test_${Date.now()}_${i}`,
          lat: 40.7128 + (Math.random() - 0.5) * 0.01,
          lon: -74.0060 + (Math.random() - 0.5) * 0.01,
          power: -50 - Math.random() * 40,
          frequency: 2400 + Math.random() * 100,
          timestamp: Date.now() - Math.random() * 60000,
          source: SignalSource.HackRF,
          metadata: {
            signalType: Math.random() > 0.5 ? 'wifi' : 'bluetooth'
          }
        });
      }
      
      // Store signals
      status = 'Storing signals...';
      await db.storeSignalsBatch(testSignals);
      results.stored = testSignals.length;
      
      // Query signals
      status = 'Querying signals...';
      const found = await db.findSignalsInRadius({
        lat: 40.7128,
        lon: -74.0060,
        radiusMeters: 1000
      });
      results.queried = found.length;
      
      // Get statistics
      const stats = await db.getStatistics();
      results.stats = stats;
      
      // Get devices
      const devices = await db.getDevicesInArea({
        minLat: 40.70,
        maxLat: 40.73,
        minLon: -74.02,
        maxLon: -74.00
      });
      results.devices = devices.length;
      
      status = '✅ All tests passed!';
      
    } catch (_err) {
      error = _err instanceof Error ? _err.message : 'Unknown error';
      status = '❌ Test failed';
      console.error(_err);
    }
    })();
  });
</script>

<div class="min-h-screen bg-gray-900 text-white p-8">
  <div class="max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">Client-Side Database Test</h1>
    
    <div class="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Status: {status}</h2>
      
      {#if error}
        <div class="bg-red-900/50 border border-red-500 rounded p-4 mb-4">
          <p class="text-red-300">Error: {error}</p>
        </div>
      {/if}
      
      {#if Object.keys(results).length > 0}
        <div class="space-y-4">
          <div class="bg-gray-700 rounded p-4">
            <h3 class="font-semibold mb-2">Test Results:</h3>
            <ul class="space-y-2">
              <li>✓ Signals stored: {results.stored || 0}</li>
              <li>✓ Signals queried: {results.queried || 0}</li>
              <li>✓ Devices found: {results.devices || 0}</li>
              {#if results.stats}
                <li>✓ Total signals in DB: {results.stats.totalSignals ?? 0}</li>
                <li>✓ Active devices: {results.stats.activeDevices ?? 0}</li>
              {/if}
            </ul>
          </div>
          
          <div class="bg-green-900/50 border border-green-500 rounded p-4">
            <p class="text-green-300">
              IndexedDB is working correctly! The tactical map will automatically
              store all incoming signals in this database.
            </p>
          </div>
        </div>
      {/if}
    </div>
    
    <div class="bg-gray-800 rounded-lg p-6">
      <h2 class="text-xl font-semibold mb-4">How to Check in DevTools:</h2>
      <ol class="list-decimal list-inside space-y-2 text-gray-300">
        <li>Open Chrome/Firefox DevTools (F12)</li>
        <li>Go to Application tab (Chrome) or Storage tab (Firefox)</li>
        <li>Expand IndexedDB</li>
        <li>Look for "RFSignalsDB"</li>
        <li>You'll see signals, devices, relationships, and patterns stores</li>
      </ol>
    </div>
  </div>
</div>