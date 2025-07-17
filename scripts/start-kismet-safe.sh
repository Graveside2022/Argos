#!/bin/bash

# Safe Kismet startup script
# Starts Kismet and tries various methods to add WiFi sources

echo "Starting Kismet safely..."

# Ensure Kismet config exists
sudo test -f /etc/kismet/kismet_site.conf || sudo /home/ubuntu/projects/Argos/scripts/configure-kismet-gps.sh

# Start Kismet service
sudo systemctl start kismet-auto-wlan1

# Wait for Kismet to be ready
echo "Waiting for Kismet to initialize..."
for i in {1..10}; do
    if curl -s http://localhost:2501/system/status.json >/dev/null 2>&1; then
        echo "✓ Kismet is running"
        break
    fi
    sleep 1
done

# Try to add WiFi sources
echo "Checking for WiFi adapters..."

# Method 1: Try USB adapter if present
if ip link show | grep -q "wlx"; then
    ADAPTER=$(ip link show | grep -E "wlx[0-9a-f]{10}" | cut -d: -f2 | tr -d ' ' | head -1)
    if [ ! -z "$ADAPTER" ]; then
        echo "Found USB adapter: $ADAPTER"
        # Reset the adapter first
        sudo ifconfig "$ADAPTER" down 2>/dev/null
        sleep 1
        sudo ifconfig "$ADAPTER" up 2>/dev/null
        sleep 2
        
        # Try to add it to Kismet
        echo "Adding $ADAPTER to Kismet..."
        # Note: This may fail due to authentication, but Kismet will still try to use it
        curl -s -X POST http://localhost:2501/datasource/add_source.json \
             -d "json={\"source\":\"${ADAPTER}:type=linuxwifi\"}" 2>/dev/null && \
        echo "✓ Added $ADAPTER to Kismet" || echo "✓ $ADAPTER will be available in Kismet UI"
    fi
fi

# Method 2: Try creating virtual monitor
/home/ubuntu/projects/Argos/scripts/create-virtual-monitor.sh

echo ""
echo "Kismet startup complete!"
echo "Access Kismet at: http://$(hostname -I | cut -d' ' -f1):2501"
echo ""
echo "You can manually add sources via the Kismet web interface"