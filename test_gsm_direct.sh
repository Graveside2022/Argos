#!/bin/bash
echo "=== TESTING GSM DETECTION DIRECTLY ==="

echo "1. Testing standard grgsm_livemon_headless with USRP args:"
echo "Command: grgsm_livemon_headless --args='type=b200' -s 2e6 -f 946M -g 50"

# Test if the standard tool works with USRP
timeout 8 grgsm_livemon_headless --args="type=b200" -s 2e6 -f 946M -g 50 &
GSM_PID=$!
echo "Started GSM process: $GSM_PID"

sleep 5

echo "2. Checking for GSMTAP frames:"
FRAME_COUNT=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
echo "Frame count: $FRAME_COUNT"

echo "3. Checking process status:"
if ps -p $GSM_PID > /dev/null; then
    echo "✓ GSM process still running"
else
    echo "✗ GSM process stopped"
fi

sudo kill $GSM_PID 2>/dev/null

echo ""
echo "4. Testing with higher gain and different frequency:"
echo "Command: grgsm_livemon_headless --args='type=b200' -s 2e6 -f 947.4M -g 70"

timeout 8 grgsm_livemon_headless --args="type=b200" -s 2e6 -f 947.4M -g 70 &
GSM_PID2=$!

sleep 5

FRAME_COUNT2=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
echo "Frame count at 947.4 MHz: $FRAME_COUNT2"

sudo kill $GSM_PID2 2>/dev/null

echo ""
echo "5. Summary:"
echo "946.0 MHz frames: $FRAME_COUNT"
echo "947.4 MHz frames: $FRAME_COUNT2"

if [ "$FRAME_COUNT" -gt 5 ] || [ "$FRAME_COUNT2" -gt 5 ]; then
    echo "✓ GSM frames detected - system working!"
else
    echo "⚠ No GSM frames - possible issues:"
    echo "  - No GSM towers in this frequency range"
    echo "  - Need different frequencies (900/1800 MHz bands)"
    echo "  - grgsm_livemon_headless doesn't support USRP properly"
fi