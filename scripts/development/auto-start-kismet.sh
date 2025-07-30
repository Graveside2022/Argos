#!/bin/bash

# Auto-start Kismet service
# Generic startup script - no interface configuration
# User configures sources via Kismet web interface

echo "Auto-starting Kismet..."

# Check if Kismet is already running
if pgrep -f "kismet" > /dev/null; then
    echo "✅ Kismet is already running"
    echo "   Web interface: http://localhost:2501"
    exit 0
fi

# Start Kismet directly (no sudo needed)
kismet --no-ncurses --daemonize --silent

# Wait for Kismet to initialize
sleep 3

# Verify Kismet is running
if pgrep -f "kismet" > /dev/null; then
    echo "✅ Kismet started successfully"
    echo "   Web interface: http://localhost:2501"
    echo "   Configure data sources via web interface"
else
    echo "❌ Failed to start Kismet"
    exit 1
fi