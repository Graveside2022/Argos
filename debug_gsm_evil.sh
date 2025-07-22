#!/bin/bash
echo "=== DEBUGGING GSM EVIL IMSI CAPTURE ==="

echo "1. Check if GSM Evil processes are running:"
ps aux | grep -E "(grgsm_livemon|GsmEvil)" | grep -v grep

echo ""
echo "2. Check if ports are listening:"
sudo lsof -i :80 | grep LISTEN
sudo lsof -i :4729 | grep LISTEN

echo ""
echo "3. Check GSMTAP traffic (should show frames flowing):"
echo "Monitoring for 5 seconds..."
FRAME_COUNT=$(sudo timeout 5 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
echo "GSMTAP frames in 5 seconds: $FRAME_COUNT"

if [ "$FRAME_COUNT" -gt 10 ]; then
    echo "✓ Good frame flow - GSM decoding is working"
elif [ "$FRAME_COUNT" -gt 0 ]; then
    echo "⚠ Low frame count - weak signal or intermittent"
else
    echo "✗ No GSMTAP frames - grgsm_livemon may not be working"
fi

echo ""
echo "4. Check GSM Evil log files:"
if [ -f "/usr/src/gsmevil2/gsmevil.log" ]; then
    echo "Recent GSM Evil log entries:"
    tail -10 /usr/src/gsmevil2/gsmevil.log
else
    echo "No GSM Evil log file found"
fi

echo ""
echo "5. Check IMSI database:"
if [ -f "/usr/src/gsmevil2/database/imsi.db" ]; then
    echo "IMSI database exists, checking contents:"
    sudo sqlite3 /usr/src/gsmevil2/database/imsi.db "SELECT COUNT(*) FROM imsi;" 2>/dev/null || echo "Could not query database"
else
    echo "No IMSI database found yet"
fi

echo ""
echo "6. Test GSM Evil web interface:"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/ 2>/dev/null)
if [ "$RESPONSE" = "200" ]; then
    echo "✓ GSM Evil web interface responding"
else
    echo "✗ GSM Evil web interface not responding (HTTP $RESPONSE)"
fi

echo ""
echo "7. Manual IMSI check via API:"
curl -s http://localhost:80/api/imsi | head -3 2>/dev/null || echo "Could not access IMSI API"