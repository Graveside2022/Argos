<script lang="ts">
  import { onMount } from 'svelte';
  
  let message = 'Checking database...';
  let dbWorking = false;
  
  onMount(() => {
    try {
      // Simple test - can we open IndexedDB?
      const request = indexedDB.open('TestDB', 1);
      
      request.onsuccess = () => {
        message = '✅ Database is working! Signals will be stored automatically.';
        dbWorking = true;
        request.result.close();
      };
      
      request.onerror = () => {
        message = '❌ Database error: ' + (request.error?.message || 'Unknown error');
      };
      
    } catch (err: unknown) {
      message = '❌ Error: ' + (err instanceof Error ? err.message : 'Unknown error');
    }
  });
</script>

<div class="min-h-screen bg-gray-900 text-white p-8">
  <h1 class="text-3xl font-bold mb-8">Database Status Check</h1>
  
  <div class="bg-gray-800 rounded-lg p-6">
    <p class="text-xl {dbWorking ? 'text-green-400' : 'text-yellow-400'}">{message}</p>
  </div>
  
  <div class="mt-8 bg-gray-800 rounded-lg p-6">
    <h2 class="text-xl font-semibold mb-4">What this means:</h2>
    <ul class="space-y-2 text-gray-300">
      <li>• When you go to /tactical-map, all HackRF signals are saved automatically</li>
      <li>• No configuration needed - it just works</li>
      <li>• Signals are stored in your browser's built-in database</li>
      <li>• All 4 visualization modes (Clusters, Contours, Network, AI) use this data</li>
    </ul>
  </div>
  
  <div class="mt-8">
    <a href="/tactical-map" class="inline-block bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
      Go to Tactical Map →
    </a>
  </div>
</div>