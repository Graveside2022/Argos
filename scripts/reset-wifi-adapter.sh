#!/bin/bash

# Reset mt76x2u WiFi adapter script
echo "Resetting mt76x2u WiFi adapter..."

# Stop Kismet first to release the adapter
echo "Stopping Kismet service..."
sudo systemctl stop kismet

# Find the USB device
VENDOR_ID="0e8d"
PRODUCT_ID="7612"

# Get the USB bus and device path
USB_INFO=$(lsusb | grep "$VENDOR_ID:$PRODUCT_ID")
if [ -z "$USB_INFO" ]; then
    echo "❌ MediaTek adapter not found!"
    exit 1
fi

BUS=$(echo "$USB_INFO" | awk '{print $2}')
DEVICE=$(echo "$USB_INFO" | awk '{print $4}' | tr -d ':')

echo "Found adapter on Bus $BUS Device $DEVICE"

# Try to bring down the interface gracefully
echo "Bringing down interface..."
sudo ifconfig wlx00c0caadcedb down 2>/dev/null
sudo ip link set wlx00c0caadcedb down 2>/dev/null

# Unload and reload the driver
echo "Reloading mt76x2u driver..."
sudo modprobe -r mt76x2u
sleep 2
sudo modprobe mt76x2u

# Wait for interface to appear
echo "Waiting for interface to reappear..."
for i in {1..10}; do
    if ip link show | grep -q "wlx00c0caadcedb"; then
        echo "✓ Interface detected"
        break
    fi
    sleep 1
done

# Bring up the interface
echo "Bringing up interface..."
sudo ifconfig wlx00c0caadcedb up

# Check status
if ip link show wlx00c0caadcedb | grep -q "UP"; then
    echo "✓ Adapter reset successfully"
    iwconfig wlx00c0caadcedb 2>/dev/null | head -5
else
    echo "⚠️  Adapter is still down, checking kernel logs..."
    sudo dmesg | grep -E "(mt76|wlx00c0caadcedb)" | tail -10
fi

echo ""
echo "You can now restart Kismet"