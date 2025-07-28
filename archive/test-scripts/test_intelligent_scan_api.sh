#!/bin/bash
echo "=== TESTING INTELLIGENT SCAN API DIRECTLY ==="

echo "Making API call to intelligent-scan-stream endpoint..."
echo "This will show the actual server-side logs..."

# Make API call and capture response
curl -N -X POST http://localhost:5173/api/gsm-evil/intelligent-scan-stream 2>/dev/null | head -20

echo ""
echo "=== API TEST COMPLETE ==="