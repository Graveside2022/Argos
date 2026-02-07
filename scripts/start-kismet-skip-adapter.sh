#!/bin/bash

# Start Kismet without automatically adding the problematic adapter
echo "Starting Kismet (adapter will need manual configuration)..."

# Stop any existing Kismet
sudo systemctl stop kismet-auto-wlan1 2>/dev/null
sleep 2

# Start Kismet service
echo "Starting Kismet service..."
sudo systemctl start kismet-auto-wlan1

# Wait for Kismet to be ready
echo "Waiting for Kismet to initialize..."
ready=false
for i in {1..20}; do
    if curl -s http://localhost:2501/ 2>/dev/null | grep -q "Kismet"; then
        ready=true
        echo "[PASS] Kismet is running!"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ "$ready" = false ]; then
    echo "[ERROR] Kismet failed to start"
    echo "Checking status..."
    sudo systemctl status kismet-auto-wlan1 --no-pager | head -10
    exit 1
fi

# Show adapter status but don't try to add it
echo ""
echo "=== Adapter Status ==="
if ip link show wlan1 2>/dev/null; then
    echo "[PASS] Adapter is present"
    echo ""
    echo "To add the adapter manually:"
    echo "1. Open Kismet at http://$(hostname -I | cut -d' ' -f1):2501"
    echo "2. Go to Data Sources"
    echo "3. Add source: wlan1"
    echo "4. Type: linuxwifi"
else
    echo "[ERROR] Adapter not found"
fi

echo ""
echo "=== Important ==="
echo "The mt76x2u adapter has known issues with error -71."
echo "If it fails, try:"
echo "1. Unplug and replug the USB adapter"
echo "2. Run: sudo /home/ubuntu/projects/Argos/scripts/safe-adapter-reset.sh"
echo "3. Add the adapter manually in Kismet UI"