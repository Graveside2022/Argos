#!/bin/bash

echo "=== GSM Scan Debug ==="
echo

# Check which device we're using
if uhd_find_devices 2>&1 | grep -q "B205"; then
    echo "✓ USRP B205 Mini detected"
    DEVICE="USRP"
    ARGS='--args="type=b200"'
else
    echo "Using default device (HackRF/RTL-SDR)"
    DEVICE="Other"
    ARGS=""
fi

echo
echo "Testing frequency 947.2 MHz with gain 50..."
echo "Command: sudo grgsm_livemon_headless $ARGS -f 947.2M -g 50"
echo

# Start grgsm_livemon_headless and capture its output
echo "Starting grgsm_livemon_headless..."
sudo grgsm_livemon_headless $ARGS -f 947.2M -g 50 2>&1 | head -20 &
PID=$!

# Give it time to start
sleep 5

# Check if it's still running
if ps -p $PID > /dev/null; then
    echo "✓ Process is running (PID: $PID)"
else
    echo "✗ Process died - checking error output:"
    sudo grgsm_livemon_headless $ARGS -f 947.2M -g 50 2>&1 | head -50
    exit 1
fi

# Count packets
echo
echo "Counting GSMTAP packets for 10 seconds..."
PACKETS=$(sudo timeout 10 tcpdump -i lo -nn port 4729 2>&1 | tee /tmp/gsm_packets.log | wc -l)
echo "Captured $PACKETS packets"

# Show some packet details
echo
echo "First few packets (if any):"
head -10 /tmp/gsm_packets.log

# Kill the process
sudo kill $PID 2>/dev/null
wait $PID 2>/dev/null

echo
echo "=== Summary ==="
echo "Device: $DEVICE"
echo "Packets captured: $PACKETS"

if [ $PACKETS -le 1 ]; then
    echo
    echo "PROBLEM: Only $PACKETS packets detected"
    echo
    echo "The issue is that grgsm_livemon_headless is hardcoded to use RTL-SDR"
    echo "even when you pass --args=\"type=b200\""
    echo
    echo "Check the source code:"
    echo "  Line 58-60 in /usr/local/bin/grgsm_livemon_headless:"
    echo "  self.rtlsdr_source_0 = osmosdr.source(...)"
    echo
    echo "This ALWAYS creates an RTL-SDR source, ignoring USRP args!"
fi