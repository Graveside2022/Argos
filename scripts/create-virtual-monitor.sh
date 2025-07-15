#!/bin/bash

# Create virtual monitor interface for Kismet
# This works around USB adapter issues

MONITOR_IFACE="mon0"

echo "Creating virtual monitor interface..."

# Remove existing virtual interface if present
sudo iw dev $MONITOR_IFACE del 2>/dev/null

# Find a suitable physical interface (not wlan0)
PHY=""
for phy in /sys/class/ieee80211/phy*; do
    phy_name=$(basename $phy)
    # Check if this phy has wlan0
    if iw phy $phy_name info | grep -q "wlan0"; then
        continue  # Skip the phy with wlan0
    fi
    # Use this phy
    PHY=$phy_name
    break
done

if [ -z "$PHY" ]; then
    echo "No suitable WiFi adapter found for monitor mode"
    echo "Kismet will start without WiFi sources"
    exit 0
fi

echo "Using $PHY for monitor interface"

# Create monitor interface
if sudo iw phy $PHY interface add $MONITOR_IFACE type monitor; then
    sudo ip link set $MONITOR_IFACE up
    echo "✓ Created monitor interface: $MONITOR_IFACE"
    
    # Add to Kismet if running
    if systemctl is-active kismet >/dev/null 2>&1; then
        sleep 2
        curl -s -X POST http://localhost:2501/datasource/add_source.json \
             -d "json={\"source\":\"${MONITOR_IFACE}:type=linuxwifi\"}" || true
        echo "✓ Added $MONITOR_IFACE to Kismet"
    fi
else
    echo "Could not create monitor interface"
    exit 0
fi