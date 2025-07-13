#!/bin/bash

echo "HackRF Crash Diagnostic Tool"
echo "============================"
echo ""

# Check if HackRF is connected
echo "1. Checking HackRF connection..."
if lsusb | grep -q "1d50:6089"; then
    echo "   ✓ HackRF One detected on USB"
    hackrf_info 2>&1 | grep -E "Serial|Firmware|Part ID" | sed 's/^/   /'
else
    echo "   ✗ No HackRF detected!"
    echo "   Please check USB connection"
fi
echo ""

# Check system resources
echo "2. System Resources:"
echo "   Memory:"
free -h | grep -E "Mem:|Swap:" | sed 's/^/      /'
echo ""

# Check for swap
if swapon --show | grep -q "/swapfile"; then
    echo "   ✓ Swap is enabled"
else
    echo "   ✗ No swap configured (run: sudo ./scripts/setup-swap.sh)"
fi
echo ""

# Check USB power
echo "3. USB Power Status:"
if [ -f /sys/devices/platform/soc/*.usb/buspower ]; then
    cat /sys/devices/platform/soc/*.usb/buspower 2>/dev/null | sed 's/^/   /'
else
    echo "   USB power info not available"
fi
echo ""

# Test hackrf_sweep with minimal parameters
echo "4. Testing hackrf_sweep with minimal load..."
echo "   Command: hackrf_sweep -f 2400:2400 -g 20 -l 32 -w 5000 -N 1"
echo "   (Single frequency, minimum bin width, one sweep only)"
echo ""

timeout 10 hackrf_sweep -f 2400:2400 -g 20 -l 32 -w 5000 -N 1 2>&1 | head -20
EXIT_CODE=$?

case $EXIT_CODE in
    0)
        echo "   ✓ Test completed successfully"
        ;;
    124)
        echo "   ✓ Test timed out (expected for continuous sweep)"
        ;;
    *)
        echo "   ✗ Test failed with exit code: $EXIT_CODE"
        ;;
esac
echo ""

# Check system logs for crashes
echo "5. Recent system errors (last 5 minutes):"
echo "   OOM Killer activity:"
journalctl --since "5 minutes ago" 2>/dev/null | grep -i "oom-killer\|killed process" | tail -3 | sed 's/^/      /'

echo ""
echo "   USB errors:"
journalctl --since "5 minutes ago" 2>/dev/null | grep -i "usb.*error\|xhci" | tail -3 | sed 's/^/      /'

echo ""
echo "   HackRF errors:"
journalctl --since "5 minutes ago" 2>/dev/null | grep -i "hackrf" | tail -3 | sed 's/^/      /'

echo ""
echo "6. Recommendations:"
echo "   - If memory is low, enable swap: sudo ./scripts/setup-swap.sh"
echo "   - If USB errors, try a different USB port or powered hub"
echo "   - If hackrf_sweep crashes with low bin width, it may be a driver issue"
echo "   - Monitor with: ./monitor-hackrf.sh while running the app"
echo ""