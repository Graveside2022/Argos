#!/bin/bash

# Generic WiFi Adapter Diagnostic Script
# Supports multiple Alfa adapter models

echo "=== WiFi Adapter Diagnostics (wlan0 is PROTECTED) ==="
echo "Date: $(date)"
echo ""

# 1. Verify wlan0 is safe
echo "1. Checking wlan0 (SSH connection) safety..."
if [ -d "/sys/class/net/wlan0" ]; then
    if [ -f "/sys/class/net/wlan0/operstate" ]; then
        STATE=$(cat /sys/class/net/wlan0/operstate)
        if [ "$STATE" = "up" ]; then
            echo "✓ wlan0 is UP and SAFE (will NOT be touched)"
        else
            echo "⚠️  WARNING: wlan0 appears down - be careful!"
        fi
    fi
else
    echo "ℹ️  wlan0 not present"
fi
echo ""

# 2. Check for Alfa adapters
echo "2. Checking for Alfa WiFi Adapters..."

# Run the Alfa detection script
if [ -f "/workspace/scripts/detect-alfa-adapter.sh" ]; then
    /workspace/scripts/detect-alfa-adapter.sh
    ALFA_DETECTED=$?
else
    echo "❌ Alfa detection script not found!"
    ALFA_DETECTED=1
fi

# If Alfa was found, the interface name is in ALFA_INTERFACE
if [ $ALFA_DETECTED -eq 0 ] && [ -n "$ALFA_INTERFACE" ]; then
    echo ""
    echo "3. Interface Status for $ALFA_INTERFACE:"
    if [ -d "/sys/class/net/$ALFA_INTERFACE" ]; then
        echo "✓ Interface $ALFA_INTERFACE exists"
        if [ -f "/sys/class/net/$ALFA_INTERFACE/operstate" ]; then
            STATE=$(cat /sys/class/net/$ALFA_INTERFACE/operstate)
            echo "   State: $STATE"
        fi
    fi
fi
echo ""

# 4. Check for monitor interface
echo "4. Monitor Interface Check:"
if ip link show | grep -q "kismon0"; then
    echo "⚠️  Found leftover monitor interface kismon0"
    echo "   This may cause issues - consider removing with:"
    echo "   sudo iw dev kismon0 del"
else
    echo "✓ No leftover monitor interfaces"
fi
echo ""

# 5. Recent USB errors
echo "5. Recent USB Errors (last 10):"
sudo dmesg | grep -E "(mt76.*error|USB disconnect.*device.*$DEVICE)" | tail -10
echo ""

# 6. USB Power Management
echo "6. USB Power Settings:"
if [ -f /sys/bus/usb/devices/2-2/power/control ]; then
    POWER=$(cat /sys/bus/usb/devices/2-2/power/control)
    echo "   Power control: $POWER"
    if [ "$POWER" = "auto" ]; then
        echo "   ⚠️  Auto-suspend is enabled (may cause disconnects)"
        echo "   Fix with: echo 'on' | sudo tee /sys/bus/usb/devices/2-2/power/control"
    else
        echo "   ✓ Auto-suspend is disabled"
    fi
fi
echo ""

# 7. Driver module status
echo "7. Driver Status:"
if lsmod | grep -q "mt76x2u"; then
    echo "✓ mt76x2u driver loaded"
    USAGE=$(lsmod | grep mt76x2u | awk '{print $3}')
    echo "   Usage count: $USAGE"
else
    echo "❌ mt76x2u driver NOT loaded!"
fi
echo ""

# 8. Kismet process check
echo "8. Kismet Status:"
if pgrep kismet > /dev/null; then
    echo "⚠️  Kismet is running (PID: $(pgrep kismet))"
    echo "   Consider stopping it before adapter reset"
else
    echo "✓ Kismet is not running"
fi
echo ""

# 9. Suggestions
echo "=== Recommended Actions ==="
echo "1. Stop Kismet: sudo systemctl stop kismet"
echo "2. Remove monitor interface if exists: sudo iw dev kismon0 del"
echo "3. Reset the adapter: sudo ifconfig $IFACE down && sleep 2 && sudo ifconfig $IFACE up"
echo "4. If still failing, try unplugging and replugging the USB adapter"
echo "5. Check USB port - try a different port if available"
echo ""
echo "⚠️  NEVER run commands that affect wlan0!"