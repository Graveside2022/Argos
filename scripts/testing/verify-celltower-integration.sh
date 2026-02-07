#!/bin/bash

echo "====================================="
echo "Verifying Cell Tower Integration"
echo "====================================="

# Check if database exists
DB_PATH="/home/ubuntu/projects/Argos/data/celltowers/towers.db"
if [ -f "$DB_PATH" ]; then
    echo "[PASS] Database exists at: $DB_PATH"
    
    # Get database stats
    echo ""
    echo "Database Statistics:"
    TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM towers;")
    echo "  Total towers: $TOTAL"
    
    ATT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM towers WHERE mcc = 310 AND net = 410;")
    echo "  AT&T towers (310-410): $ATT_COUNT"
    
    # Test a specific query
    echo ""
    echo "Sample tower lookup (first AT&T tower):"
    sqlite3 "$DB_PATH" -header -column "SELECT mcc, net, area, cell, lat, lon FROM towers WHERE mcc = 310 AND net = 410 LIMIT 1;"
    
else
    echo "[FAIL] Database not found at: $DB_PATH"
fi

# Test the API endpoints
echo ""
echo "====================================="
echo "Testing API Endpoints"
echo "====================================="

# Test tower location endpoint
echo ""
echo "1. Testing tower-location endpoint with sample data:"
curl -s -X POST http://localhost:5173/api/gsm-evil/tower-location \
  -H "Content-Type: application/json" \
  -d '{"mcc":"310","mnc":"410","lac":"26381","ci":"62371855"}' | jq .

# Test IMSI endpoint
echo ""
echo "2. Testing IMSI endpoint:"
curl -s http://localhost:5173/api/gsm-evil/imsi | jq '.success, .total, (.imsis[0] | if . then {imsi, mcc, mnc, lac, ci, lat, lon} else empty end)'

# Test scan endpoint
echo ""
echo "3. Testing scan endpoint (this may take a few seconds):"
curl -s -X POST http://localhost:5173/api/gsm-evil/scan | jq '.success, .strongestFrequency, .totalFound, (.scanResults | length)'

echo ""
echo "====================================="
echo "Verification Complete"
echo "====================================="