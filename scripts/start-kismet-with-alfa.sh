#!/bin/bash

# Dynamic Kismet Startup Script for Alfa Adapters
# Automatically detects and configures any Alfa adapter

echo "=== Starting Kismet with Alfa Adapter ==="
echo ""

# Source the detection script to find Alfa adapter
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DETECT_SCRIPT="$SCRIPT_DIR/detect-alfa-adapter.sh"
if [ ! -f "$DETECT_SCRIPT" ]; then
    echo "❌ Alfa detection script not found at: $DETECT_SCRIPT"
    exit 1
fi

# Run detection and capture output
echo "Detecting Alfa adapter..."
DETECT_OUTPUT=$($DETECT_SCRIPT)
DETECT_RESULT=$?

echo "$DETECT_OUTPUT"

if [ $DETECT_RESULT -ne 0 ]; then
    echo ""
    echo "❌ No Alfa adapter detected. Cannot start Kismet."
    echo "   Please connect an Alfa WiFi adapter and try again."
    exit 1
fi

# Extract interface name from detection output
ALFA_INTERFACE=$(echo "$DETECT_OUTPUT" | grep "Primary interface selected:" | cut -d' ' -f4)

if [ -z "$ALFA_INTERFACE" ]; then
    echo "❌ Could not determine Alfa interface name"
    exit 1
fi

echo ""
echo "✓ Will use interface: $ALFA_INTERFACE"

# Check if Kismet is already running
if pgrep -x "kismet" > /dev/null; then
    echo "⚠️  Kismet is already running. Stopping it first..."
    pkill kismet 2>/dev/null || echo "Note: Could not stop existing Kismet (may need sudo)"
    sleep 2
fi

# Note: Kismet will handle monitor mode internally
echo ""
echo "Note: Kismet will configure $ALFA_INTERFACE automatically"
echo "(Monitor mode will be set up by Kismet if needed)"

# Ensure Kismet GPS configuration exists (for gpsd integration)
# This handles both root and non-root execution
KISMET_CONF_DIR="/etc/kismet"
KISMET_SITE_CONF="$KISMET_CONF_DIR/kismet_site.conf"

if [ ! -f "$KISMET_SITE_CONF" ] || ! grep -q "gps=gpsd" "$KISMET_SITE_CONF" 2>/dev/null; then
    echo "Configuring Kismet GPS integration..."
    if [ -w "$KISMET_CONF_DIR" ] || [ "$(id -u)" = "0" ]; then
        echo "gps=gpsd:host=localhost,port=2947" >> "$KISMET_SITE_CONF"
        echo "✓ GPS configuration added to $KISMET_SITE_CONF"
    else
        echo "⚠️  Cannot write to $KISMET_SITE_CONF (need root)"
        echo "   GPS may show 'Unknown' - run with sudo or add config manually"
    fi
fi

# Prepare Kismet command arguments
KISMET_ARGS=""
KISMET_ARGS="$KISMET_ARGS -c $ALFA_INTERFACE:type=linuxwifi"
KISMET_ARGS="$KISMET_ARGS --no-line-wrap"
KISMET_ARGS="$KISMET_ARGS --no-ncurses"

echo ""
echo "Starting Kismet with configuration:"
echo "   Interface: $ALFA_INTERFACE"
echo "   Web UI: http://localhost:2501"
echo ""
echo "Command: kismet $KISMET_ARGS"
echo ""

# Start Kismet in background/daemon mode
echo "Starting Kismet in background..."
nohup kismet $KISMET_ARGS > /tmp/kismet.log 2>&1 &
KISMET_PID=$!

# Wait a moment for Kismet to start
sleep 2

# Check if Kismet started successfully
if kill -0 $KISMET_PID 2>/dev/null; then
    echo "✓ Kismet started successfully (PID: $KISMET_PID)"
    echo "   Logs: /tmp/kismet.log"
    exit 0
else
    echo "❌ Kismet failed to start"
    echo "   Check logs at /tmp/kismet.log"
    exit 1
fi