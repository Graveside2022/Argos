#!/bin/bash
# Integrate OpenWebRX with Argos spectrum viewer

set -e

echo "=== Integrating OpenWebRX with Argos ==="

# Update Argos configuration to use OpenWebRX
echo "1. Updating Argos environment configuration..."
cat >> /home/ubuntu/projects/Argos/.env << 'EOF'

# OpenWebRX Integration
PUBLIC_OPENWEBRX_URL=http://localhost:8073
PUBLIC_OPENWEBRX_ENABLED=true
PUBLIC_SPECTRUM_VIEWER=openwebrx
EOF

# Create or update the spectrum viewer route
echo "2. Creating spectrum viewer integration..."
cat > /home/ubuntu/projects/Argos/src/routes/spectrum/+page.svelte << 'EOF'
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
EOF

# Update the main navigation to include spectrum viewer
echo "3. Updating navigation menu..."
cat > /home/ubuntu/projects/Argos/src/lib/components/navigation/SpectrumLink.svelte << 'EOF'
<script lang="ts">
  import { page } from '$app/stores';
</script>

<a 
  href="/spectrum" 
  class="nav-link"
  class:active={$page.url.pathname === '/spectrum'}
>
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
  <span>Spectrum</span>
</a>

<style>
  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    color: #e5e5e5;
    text-decoration: none;
    transition: all 0.2s;
    border-radius: 0.375rem;
  }
  
  .nav-link:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .nav-link.active {
    background-color: #3b82f6;
    color: white;
  }
</style>
EOF

echo "4. Creating systemd service for automatic startup..."
cat > /tmp/openwebrx-usrp.service << 'EOF'
[Unit]
Description=OpenWebRX USRP B205 Mini SDR Server
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/projects/Argos
ExecStart=/usr/bin/docker-compose -f docker-compose-openwebrx-usrp.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose-openwebrx-usrp.yml down
User=ubuntu

[Install]
WantedBy=multi-user.target
EOF

sudo cp /tmp/openwebrx-usrp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable openwebrx-usrp.service

echo
echo "=== Integration Complete ==="
echo "OpenWebRX has been integrated with Argos!"
echo "Access the spectrum viewer at: http://localhost:5173/spectrum"
echo "Direct OpenWebRX access at: http://localhost:8073"
echo
echo "The service will start automatically on boot."
echo "To manually control the service:"
echo "  sudo systemctl start openwebrx-usrp"
echo "  sudo systemctl stop openwebrx-usrp"
echo "  sudo systemctl status openwebrx-usrp"