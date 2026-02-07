#!/bin/bash

# SAFE adapter fix - NEVER touches wlan0
echo "=== Safely fixing WiFi adapter (wlan0 protected) ==="

# 1. Stop Kismet first
echo "1. Stopping Kismet..."
sudo systemctl stop kismet
sleep 2

# 2. Clean up any leftover monitor interfaces
echo "2. Cleaning up monitor interfaces..."
sudo iw dev kismon0 del 2>/dev/null || echo "   No monitor interface to remove"

# 3. Try to reset the adapter
echo "3. Resetting adapter interface..."
sudo ip link set wlx00c0caadcedb down 2>/dev/null
sleep 2

# 4. Disable USB autosuspend for this device specifically
echo "4. Ensuring USB power is stable..."
echo 'on' | sudo tee /sys/bus/usb/devices/2-2/power/control > /dev/null

# 5. Try to bring it back up
echo "5. Bringing adapter back up..."
sudo ip link set wlx00c0caadcedb up 2>/dev/null

# 6. Check result
sleep 2
if ip link show wlx00c0caadcedb 2>/dev/null | grep -q "state UP"; then
    echo "[PASS] Adapter is UP!"
else
    echo "[WARN]  Adapter still having issues"
    echo ""
    echo "=== Manual USB Reset Required ==="
    echo "The adapter needs a physical reset:"
    echo "1. Unplug the USB WiFi adapter"
    echo "2. Wait 5 seconds"
    echo "3. Plug it back in (try a different USB port if possible)"
    echo "4. Run: ip link show | grep wlx"
    echo "5. Once it appears, restart Kismet from the web interface"
fi

echo ""
echo "[PASS] wlan0 remains untouched and safe for SSH"