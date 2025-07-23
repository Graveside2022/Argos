#!/bin/bash
echo "=== FINAL SCAN TEST WITH EXACT WEB SCANNER COMMAND ==="

echo "1. Kill any existing GSM processes:"
sudo pkill -f grgsm_livemon
sleep 2

echo "2. Check USRP detection:"
if uhd_find_devices 2>/dev/null | grep -q "B205"; then
    echo "✓ USRP B205 Mini detected"
else
    echo "✗ USRP not detected"
    exit 1
fi

echo ""
echo "3. Run exact command that web scanner will use:"
COMMAND='sudo grgsm_livemon_headless --args="type=b200" -s 2e6 -f 947.4M -g 70'
echo "Command: $COMMAND"

# Start the exact command
eval "$COMMAND" > /tmp/web_gsm.log 2>&1 &
WEB_PID=$!
echo "Process PID: $WEB_PID"

# Wait for initialization
sleep 4

echo "4. Check process status:"
if ps -p $WEB_PID > /dev/null 2>&1; then
    echo "✓ Process running"
else
    echo "✗ Process died, checking log:"
    cat /tmp/web_gsm.log
    exit 1
fi

echo ""
echo "5. Count frames over 3 seconds (same as web scanner):"
FRAME_COUNT=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
echo "Frame count: $FRAME_COUNT"

echo ""
echo "6. Kill process:"
sudo kill $WEB_PID 2>/dev/null

echo ""
echo "7. Analysis:"
if [ "$FRAME_COUNT" -gt 20 ]; then
    echo "✓ EXCELLENT: $FRAME_COUNT frames detected - web scanner should work!"
elif [ "$FRAME_COUNT" -gt 5 ]; then
    echo "✓ GOOD: $FRAME_COUNT frames detected - reasonable signal"
elif [ "$FRAME_COUNT" -gt 0 ]; then
    echo "⚠ WEAK: $FRAME_COUNT frames detected - signal intermittent"
else
    echo "✗ NO SIGNAL: Check antenna connection or try different time"
fi

echo ""
echo "The web scanner should now show $FRAME_COUNT frames for 947.4 MHz"