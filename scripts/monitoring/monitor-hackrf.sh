#!/bin/bash

echo "Monitoring HackRF processes and system resources..."
echo "Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo "=== $(date) ==="
    echo ""
    
    # Check for hackrf_sweep processes
    echo "HackRF processes:"
    ps aux | grep -E "hackrf_sweep|PID" | grep -v grep
    echo ""
    
    # Memory usage
    echo "Memory usage:"
    free -h | grep -E "Mem:|Swap:"
    echo ""
    
    # Check USB devices
    echo "USB devices (HackRF):"
    lsusb | grep -i "hackrf\|1d50:6089" || echo "No HackRF detected on USB"
    echo ""
    
    # Check for OOM killer activity in the last 10 minutes
    echo "Recent OOM killer activity:"
    journalctl -u dev-server --since "10 minutes ago" 2>/dev/null | grep -i "oom\|killed" | tail -5
    
    # Check system load
    echo ""
    echo "System load:"
    uptime
    
    sleep 5
done