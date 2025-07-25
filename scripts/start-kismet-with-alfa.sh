#!/bin/bash

# Dynamic Kismet Startup Script for Alfa Adapters
# Automatically detects and configures any Alfa adapter

echo "=== Starting Kismet with Alfa Adapter ==="
echo ""

# Source the detection script to find Alfa adapter
DETECT_SCRIPT="/workspace/scripts/detect-alfa-adapter.sh"
if [ ! -f "$DETECT_SCRIPT" ]; then
    echo "❌ Alfa detection script not found!"
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
    sudo pkill kismet
    sleep 2
fi

# Prepare the interface for monitor mode
echo ""
echo "Preparing $ALFA_INTERFACE for monitor mode..."

# Bring interface down
sudo ip link set $ALFA_INTERFACE down 2>/dev/null || sudo ifconfig $ALFA_INTERFACE down 2>/dev/null

# Set monitor mode (try different methods)
if command -v iw &> /dev/null; then
    sudo iw dev $ALFA_INTERFACE set type monitor 2>/dev/null
elif command -v iwconfig &> /dev/null; then
    sudo iwconfig $ALFA_INTERFACE mode monitor 2>/dev/null
fi

# Bring interface up
sudo ip link set $ALFA_INTERFACE up 2>/dev/null || sudo ifconfig $ALFA_INTERFACE up 2>/dev/null

# Create Kismet config with dynamic interface
KISMET_CONF="/tmp/kismet-alfa-dynamic.conf"
cat > $KISMET_CONF << EOF
# Dynamic Kismet configuration for Alfa adapter
# Auto-generated by start-kismet-with-alfa.sh

# Use the detected Alfa interface
source=$ALFA_INTERFACE:type=linuxwifi

# Basic settings
gps=false
logging_enabled=true
log_prefix=/var/log/kismet/

# Don't auto-detect other interfaces
source_auto_probe=false

# Web UI settings
httpd_bind_address=0.0.0.0
httpd_port=2501
EOF

echo ""
echo "Starting Kismet with configuration:"
echo "   Interface: $ALFA_INTERFACE"
echo "   Config: $KISMET_CONF"
echo "   Web UI: http://localhost:2501"
echo ""

# Start Kismet
sudo kismet -c $KISMET_CONF

# Cleanup
rm -f $KISMET_CONF