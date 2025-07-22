#!/bin/bash
# Quick test to verify USRP is actually receiving anything

echo "=== Verifying USRP B205 Mini Reception ==="
echo

# Test 1: Check device
echo "1. Device check:"
uhd_find_devices 2>&1 | grep -A5 "B205" || echo "No USRP found!"

# Test 2: Basic reception test with uhd_rx_cfile
echo
echo "2. Testing basic reception with UHD tools:"
echo "   Receiving 1 second of data at 947.2 MHz..."
timeout 2 uhd_rx_cfile -f 947.2e6 -r 2e6 -g 40 -N 2000000 /tmp/test.dat 2>&1 | grep -E "Setting|Actual|Error"

if [ -f /tmp/test.dat ]; then
    SIZE=$(ls -lh /tmp/test.dat | awk '{print $5}')
    echo "   ✓ Received data file: $SIZE"
    rm /tmp/test.dat
else
    echo "   ✗ No data received"
fi

# Test 3: gr-gsm with verbose output
echo
echo "3. Testing grgsm_livemon_headless with verbose output:"
echo "   Starting for 5 seconds..."

# Start with stderr redirected to see errors
sudo timeout 5 grgsm_livemon_headless -s 2e6 -f 947.2M -g 40 2>&1 | head -20 &
PID=$!

# Give it time to start
sleep 2

# Check GSMTAP
echo
echo "4. Checking for GSMTAP packets:"
PACKETS=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>&1 | tee /tmp/tcpdump.log | wc -l)
echo "   Captured $PACKETS packets"

if [ $PACKETS -eq 0 ]; then
    echo
    echo "   No GSMTAP packets detected. Checking tcpdump output:"
    cat /tmp/tcpdump.log | head -5
fi

# Clean up
sudo kill $PID 2>/dev/null
wait $PID 2>/dev/null
rm -f /tmp/tcpdump.log

# Test 4: Try with osmocom_fft if available
echo
echo "5. Visual spectrum check (if osmocom_fft is available):"
if command -v osmocom_fft &> /dev/null; then
    echo "   Run this command to see spectrum visually:"
    echo "   osmocom_fft -f 947.2M -s 2M --args=\"type=b200\""
else
    echo "   osmocom_fft not found - install with: sudo apt install gr-osmosdr"
fi

echo
echo "Done!"