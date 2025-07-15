<script lang="ts">
  export let enabled = false;
  export let onToggle: (enabled: boolean) => void = () => {};
  
  function toggle() {
    enabled = !enabled;
    onToggle(enabled);
  }
</script>

<button 
  class="rssi-toggle-btn {enabled ? 'active' : ''}"
  on:click={toggle}
  title="Toggle RSSI Localization"
>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
    {#if enabled}
      <circle cx="12" cy="12" r="8" stroke-dasharray="2 2" class="pulse"/>
    {/if}
  </svg>
  RSSI {enabled ? 'ON' : 'OFF'}
</button>

<style>
  .rssi-toggle-btn {
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
  
  .rssi-toggle-btn:hover {
    border-color: #666;
    color: #aaa;
  }
  
  .rssi-toggle-btn.active {
    background: #0a4f0a;
    border-color: #0f0;
    color: #0f0;
  }
  
  @keyframes pulse {
    0% { r: 8; opacity: 1; }
    100% { r: 12; opacity: 0; }
  }
  
  .pulse {
    animation: pulse 2s ease-out infinite;
  }
</style>