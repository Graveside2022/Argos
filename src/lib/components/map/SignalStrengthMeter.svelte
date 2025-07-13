<script lang="ts">
  export let power: number; // in dBm
  export let showLabel = true;
  export let compact = false;
  
  // Calculate signal strength percentage (0-100)
  // -100 dBm = 0%, -30 dBm = 100%
  $: strengthPercent = Math.max(0, Math.min(100, ((power + 100) / 70) * 100));
  
  // Get color based on signal strength
  $: strengthColor = (() => {
    if (power >= -50) return 'bg-red-500'; // Excellent
    if (power >= -60) return 'bg-orange-500'; // Good
    if (power >= -70) return 'bg-yellow-500'; // Fair
    if (power >= -80) return 'bg-green-500'; // Weak
    return 'bg-blue-500'; // Very weak
  })();
  
  // Get text color for contrast
  $: textColor = (() => {
    if (power >= -50) return 'text-red-600';
    if (power >= -60) return 'text-orange-600';
    if (power >= -70) return 'text-yellow-600';
    if (power >= -80) return 'text-green-600';
    return 'text-blue-600';
  })();
  
  // Signal quality label
  $: qualityLabel = (() => {
    if (power >= -50) return 'Excellent';
    if (power >= -60) return 'Good';
    if (power >= -70) return 'Fair';
    if (power >= -80) return 'Weak';
    return 'Poor';
  })();
</script>

<div class="flex items-center gap-2">
  {#if !compact}
    <div class="flex-1">
      <div class="relative w-full bg-gray-700 rounded-full h-2">
        <div 
          class="absolute top-0 left-0 h-full rounded-full transition-all duration-300 {strengthColor}"
          style="width: {strengthPercent}%"
        />
      </div>
      {#if showLabel}
        <div class="flex justify-between items-center mt-1">
          <span class="text-xs {textColor} font-medium">{qualityLabel}</span>
          <span class="text-xs text-gray-400">{power.toFixed(0)} dBm</span>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Compact view - just colored bars -->
    <div class="flex gap-0.5">
      {#each Array(5) as _, i}
        <div 
          class="w-1 h-3 rounded-sm transition-all duration-300"
          class:bg-gray-700={i >= Math.ceil(strengthPercent / 20)}
          class:{strengthColor}={i < Math.ceil(strengthPercent / 20)}
        />
      {/each}
    </div>
    <span class="text-xs {textColor}">{power.toFixed(0)}</span>
  {/if}
</div>