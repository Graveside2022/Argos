#!/bin/bash
echo "=== TESTING EXACT COMMAND THAT DETECTED 106 FRAMES ==="

echo "The command that worked was:"
echo "grgsm_livemon_headless --args='type=b200' -s 2e6 -f 947.4M -g 70"
echo ""

echo "Let's test this exact command again:"
timeout 10 grgsm_livemon_headless --args="type=b200" -s 2e6 -f 947.4M -g 70 > /tmp/gsm_output.log 2>&1 &
GSM_PID=$!

echo "GSM process started: $GSM_PID"
sleep 6

echo "Checking output log:"
head -20 /tmp/gsm_output.log

echo ""
echo "Counting GSMTAP frames:"
FRAME_COUNT=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
echo "Frame count: $FRAME_COUNT"

echo "Checking if process is still running:"
if ps -p $GSM_PID > /dev/null 2>&1; then
    echo "✓ Process still running"
    sudo kill $GSM_PID
else
    echo "✗ Process died, checking why..."
    echo "Last lines of output:"
    tail -10 /tmp/gsm_output.log
fi

echo ""
echo "Let's also try a simpler test to see what's wrong:"
echo "Testing USRP device detection:"
uhd_find_devices | grep -A5 -B5 "B205"