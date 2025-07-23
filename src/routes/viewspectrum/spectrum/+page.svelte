<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let iframeElement: HTMLIFrameElement;
  let openWebRxUrl = import.meta.env.PUBLIC_OPENWEBRX_URL || 'http://localhost:8073';
  
  onMount(() => {
    if (browser) {
      // Ensure iframe loads properly
      if (iframeElement) {
        iframeElement.src = openWebRxUrl;
      }
    }
  });
</script>

<div class="spectrum-viewer">
  <div class="header">
    <h1>Spectrum Viewer - USRP B205 Mini</h1>
    <p class="status">OpenWebRX Interface</p>
  </div>
  
  <div class="iframe-container">
    <iframe
      bind:this={iframeElement}
      title="OpenWebRX Spectrum Viewer"
      allow="fullscreen"
      frameborder="0"
    />
  </div>
</div>

<style>
  .spectrum-viewer {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  .header {
    background-color: #1a1a1a;
    color: white;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .header h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .status {
    color: #4ade80;
    margin: 0;
  }
  
  .iframe-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  
  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
