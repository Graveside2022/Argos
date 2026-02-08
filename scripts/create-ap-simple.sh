#!/bin/bash
# Simple AP creation using create_ap tool which handles MT7921U better

# Read credentials from environment (fail if not set)
AP_PASSWORD="${AP_PASSWORD:?Error: AP_PASSWORD not set. Export AP_PASSWORD before running.}"

echo "=== Setting up Argos AP with create_ap ==="

# Install create_ap if not present
if ! command -v create_ap &> /dev/null; then
    echo "Installing create_ap..."
    sudo apt-get update
    sudo apt-get install -y git
    cd /tmp
    git clone https://github.com/oblique/create_ap
    cd create_ap
    sudo make install
    cd /
fi

# Stop existing services
echo "Stopping existing services..."
sudo systemctl stop hostapd 2>/dev/null
sudo systemctl stop dnsmasq 2>/dev/null
sudo systemctl disable hostapd 2>/dev/null
sudo killall create_ap 2>/dev/null

# Find the WiFi interface
IFACE=$(iw dev | grep -A1 "00:c0:ca:b6:84:ad" | grep Interface | awk '{print $2}')
if [ -z "$IFACE" ]; then
    echo "Creating interface..."
    PHY=$(iw phy | head -1 | awk '{print $2}')
    sudo iw $PHY interface add wlan_ap type managed
    IFACE="wlan_ap"
fi

# Start create_ap (it handles everything internally)
echo "Starting Argos AP..."
sudo create_ap -n \
    --freq-band 2.4 \
    --channel 6 \
    --no-virt \
    --daemon \
    --logfile /var/log/argos-ap.log \
    $IFACE eth0 Argos "$AP_PASSWORD"

sleep 3

# Check if running
if pgrep -f create_ap > /dev/null; then
    echo "[PASS] Argos AP is running!"
    echo "SSID: Argos"
    echo "Password: (set via AP_PASSWORD env var)"
    echo "Connect and SSH to: 192.168.12.1"
else
    echo "[FAIL] Failed to start AP"
    echo "Check logs: /var/log/argos-ap.log"
fi