#!/bin/bash

# Emergency RTL_433 Recovery Script
# This script creates a completely isolated RTL_433 process

echo "=== Emergency RTL_433 Recovery ==="

# Kill any existing RTL_433 processes
pkill -f rtl_433 2>/dev/null || true

# Kill any Python processes using RTL-SDR
pkill -f "python.*rtl" 2>/dev/null || true

# Wait for processes to die
sleep 3

# Check if RTL-SDR device is available
if ! lsusb | grep -q "RTL2838"; then
    echo "ERROR: RTL-SDR device not found"
    exit 1
fi

# Test RTL-SDR device
if ! rtl_test -t 2>/dev/null | grep -q "Found"; then
    echo "ERROR: RTL-SDR device not accessible"
    exit 1
fi

# Create isolated RTL_433 process
echo "Starting isolated RTL_433 on 868 MHz..."

# Use nohup + setsid for maximum isolation
nohup setsid rtl_433 \
    -f 868M \
    -F json \
    -M time:iso \
    -M protocol \
    -M level \
    -v \
    > /tmp/rtl433_emergency.log 2>&1 &

RTL_PID=$!
echo "RTL_433 started with PID: $RTL_PID"

# Wait and verify it's running
sleep 5

if ps -p $RTL_PID > /dev/null; then
    echo "✅ RTL_433 is running successfully"
    echo "✅ Monitoring 868 MHz"
    echo "✅ Output: tail -f /tmp/rtl433_emergency.log"
    echo "✅ PID: $RTL_PID"
else
    echo "❌ RTL_433 failed to start"
    exit 1
fi

echo "=== Emergency Recovery Complete ==="