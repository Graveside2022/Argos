#!/bin/bash

# Setup script for Kismet WiFi adapter
# Handles MediaTek MT7612U USB adapter issues

echo "Setting up Kismet WiFi adapter..."

# Function to find the MediaTek adapter
find_adapter() {
    # Look for the adapter by vendor/product ID
    ADAPTER=$(ip link show | grep -E "wlx[0-9a-f]{10}" | cut -d: -f2 | tr -d ' ' | head -1)
    if [ -z "$ADAPTER" ]; then
        # Try to find by USB device
        if lsusb | grep -q "0e8d:7612"; then
            echo "MediaTek adapter detected via USB but no interface found"
            # Reload driver
            sudo modprobe -r mt76x2u mt76_usb 2>/dev/null
            sleep 2
            sudo modprobe mt76x2u
            sleep 3
            ADAPTER=$(ip link show | grep -E "wlx[0-9a-f]{10}" | cut -d: -f2 | tr -d ' ' | head -1)
        fi
    fi
    echo "$ADAPTER"
}

# Apply USB fixes
echo "Applying USB stability fixes..."
echo -1 | sudo tee /sys/module/usbcore/parameters/autosuspend >/dev/null
echo 'on' | sudo tee /sys/bus/usb/devices/*/power/control >/dev/null 2>&1

# Find adapter
ADAPTER=$(find_adapter)

if [ -z "$ADAPTER" ]; then
    echo "No USB WiFi adapter found. Please check USB connection."
    exit 1
fi

echo "Found adapter: $ADAPTER"

# Configure for monitor mode
echo "Configuring $ADAPTER for monitor mode..."
sudo ip link set "$ADAPTER" down 2>/dev/null
sudo iw "$ADAPTER" set monitor control 2>/dev/null || sudo iw "$ADAPTER" set monitor none 2>/dev/null
sudo ip link set "$ADAPTER" up

# Check status
if ip link show "$ADAPTER" | grep -q "UP"; then
    echo "[PASS] Adapter $ADAPTER is ready for Kismet"
    
    # Add to Kismet if running
    if systemctl is-active kismet >/dev/null 2>&1; then
        echo "Adding adapter to Kismet..."
        curl -s -X POST http://localhost:2501/datasource/add_source.json \
             -d "json={\"source\":\"${ADAPTER}:type=linuxwifi\"}" || true
    fi
else
    echo "[FAIL] Failed to bring up adapter"
    exit 1
fi

echo "Done! Adapter $ADAPTER is configured for Kismet."