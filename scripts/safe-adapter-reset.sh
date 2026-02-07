#!/bin/bash

# SAFE adapter reset - ONLY touches USB adapter, protects wlan0
echo "=== SAFE MT76x2u Adapter Reset ==="
echo "[WARN]  This script will NOT touch wlan0 (your SSH connection)"
echo ""

# First, check what interfaces we have
echo "Current network interfaces:"
ip link show | grep -E "^[0-9]+: " | grep -v "lo:" | awk '{print $2}' | tr -d ':'

# SAFETY CHECK - make sure wlan0 is not affected
if ! ip link show wlan0 | grep -q "UP"; then
    echo "[ERROR] ERROR: wlan0 is not UP. Aborting for safety!"
    exit 1
fi

echo ""
echo "[PASS] wlan0 is safe and active"
echo ""

# Only work with the USB adapter
ADAPTER="wlx00c0caadcedb"

echo "1. Checking USB adapter status..."
if ! lsusb | grep -q "0e8d:7612"; then
    echo "[ERROR] MediaTek USB adapter not found!"
    exit 1
fi

echo "[PASS] USB adapter found"

# Stop Kismet only
echo ""
echo "2. Stopping Kismet service..."
sudo systemctl stop kismet 2>/dev/null

# Just try to reset the USB adapter interface
echo ""
echo "3. Resetting $ADAPTER interface..."
sudo ip link set $ADAPTER down 2>/dev/null
sleep 2

# Try to bring it back up
sudo ip link set $ADAPTER up 2>/dev/null
sleep 1

# Check status
echo ""
echo "4. Checking adapter status..."
if ip link show $ADAPTER 2>/dev/null | grep -q "state UP"; then
    echo "[PASS] Adapter is UP"
else
    echo "[WARN]  Adapter is still DOWN"
    
    # Try one more time with ifconfig
    sudo ifconfig $ADAPTER up 2>/dev/null
    sleep 1
fi

# Show current status
echo ""
echo "5. Current adapter info:"
iwconfig $ADAPTER 2>/dev/null | head -5 || echo "No wireless extensions"

# Check if web server is running
echo ""
echo "6. Checking web server on port 5173..."
if netstat -tln | grep -q ":5173"; then
    echo "[PASS] Web server is running on port 5173"
else
    echo "[ERROR] Web server is NOT running on port 5173"
    echo "   You may need to restart your development server:"
    echo "   cd /home/ubuntu/projects/Argos && npm run dev"
fi

echo ""
echo "=== Summary ==="
echo "- wlan0 (SSH): SAFE and untouched"
echo "- $ADAPTER: Reset attempted"
echo "- Kismet: Stopped (can be restarted)"
echo ""
echo "To start Kismet again, use the web interface or run:"
echo "sudo systemctl start kismet"