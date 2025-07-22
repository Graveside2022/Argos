#!/bin/bash
echo "=== FULL INTELLIGENT SCAN TEST ==="

echo "Starting intelligent scan API test..."
echo "This will capture the full scan process including power measurement..."

# Start the API call in background and capture output
timeout 30 curl -N -X POST http://localhost:5173/api/gsm-evil/intelligent-scan-stream 2>/dev/null > /tmp/scan_output.txt &
CURL_PID=$!

echo "Waiting for scan to complete (30 seconds max)..."
sleep 30

echo ""
echo "=== SCAN OUTPUT ==="
cat /tmp/scan_output.txt

echo ""
echo "=== LOOKING FOR POWER MEASUREMENTS ==="
grep -i "power\|dBm" /tmp/scan_output.txt || echo "No power measurements found"

echo ""
echo "=== LOOKING FOR ERRORS ==="
grep -i "error\|failed" /tmp/scan_output.txt || echo "No errors found"

echo ""
echo "=== TEST COMPLETE ==="
rm -f /tmp/scan_output.txt