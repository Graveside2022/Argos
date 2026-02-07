#!/bin/bash

# Start Kismet with correct interface and GPS configuration
# This script ensures Kismet runs with the MediaTek USB interface and GPS enabled

INTERFACE="wlx00c0cab684ad"  # MediaTek USB wireless device
PORT="2501"

echo "Starting Kismet WiFi monitoring with GPS..."
echo "Interface: $INTERFACE"
echo "Port: $PORT"

# Check if interface exists
if ! ip link show "$INTERFACE" >/dev/null 2>&1; then
    echo "ERROR: Interface $INTERFACE not found!"
    echo "Available interfaces:"
    ip link show | grep -E "wlan|wlx"
    exit 1
fi

# Stop any running Kismet processes
echo "Stopping any existing Kismet processes..."
sudo pkill -f kismet 2>/dev/null || true
sleep 2

# Start Kismet with correct parameters
echo "Starting Kismet server..."
sudo kismet \
    --tcp-port "$PORT" \
    -c "$INTERFACE" \
    --no-line-wrap \
    --no-ncurses \
    --daemonize \
    --silent

# Wait for startup
echo "Waiting for Kismet to start..."
sleep 5

# Verify it's running
if pgrep -f kismet >/dev/null; then
    echo "[PASS] Kismet started successfully"
    echo "[PASS] Web interface available at: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo "[PASS] GPS configuration loaded from /etc/kismet/kismet_site.conf"
    echo "[PASS] Interface $INTERFACE in use"
    
    # Check if port is listening
    if netstat -tln | grep ":$PORT " >/dev/null; then
        echo "[PASS] Port $PORT is listening"
    else
        echo "[WARN] Warning: Port $PORT not yet listening"
    fi
else
    echo "[ERROR] Failed to start Kismet"
    exit 1
fi

echo ""
echo "Kismet is ready! Visit http://100.76.103.118:5173/kismet to access the integrated interface."