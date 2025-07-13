<script lang="ts">
  import { onMount } from 'svelte';
  
  let status = 'Initializing...';
  
  onMount(() => {
    status = 'Page loaded successfully!';
  });
</script>

<div class="p-8">
  <h1 class="text-2xl font-bold text-white mb-4">Map Test Page</h1>
  <p class="text-white">{status}</p>
  <a href="/tactical-map" class="text-cyan-400 underline">Go to Tactical Map</a>
</div>