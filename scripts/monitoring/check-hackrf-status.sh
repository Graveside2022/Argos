#!/bin/bash

echo "=== HackRF Diagnostic Check ==="
echo "Date: $(date)"
echo ""

echo "1. Checking USB connection:"
lsusb | grep -i hackrf || echo "  WARNING: HackRF not detected on USB!"
echo ""

echo "2. Checking system memory:"
free -h
echo ""

echo "3. Checking for swap:"
swapon --show || echo "  WARNING: No swap configured!"
echo ""

echo "4. Recent system messages about HackRF:"
sudo dmesg | grep -i "hackrf\|usb" | tail -10
echo ""

echo "5. Checking for OOM kills:"
sudo dmesg | grep -i "killed process\|oom" | tail -5
echo ""

echo "6. Current HackRF processes:"
ps aux | grep -E "hackrf|sweep" | grep -v grep
echo ""

echo "7. Testing HackRF directly (5 second test):"
timeout 5 hackrf_sweep -f 2400:2400 -w 20000 2>&1 | head -20
EXIT_CODE=$?
echo "Exit code: $EXIT_CODE"
if [ $EXIT_CODE -eq 124 ]; then
    echo "  Success: HackRF sweep ran for 5 seconds without crashing"
elif [ $EXIT_CODE -eq 0 ]; then
    echo "  Success: HackRF sweep completed normally"
else
    echo "  ERROR: HackRF sweep failed with exit code $EXIT_CODE"
fi

echo ""
echo "=== Diagnostic complete ==="