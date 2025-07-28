#!/bin/bash
echo "=== TESTING GSM EVIL SCAN API RESPONSE ==="

echo "1. Making API call to GSM Evil scan endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:5173/api/gsm-evil/scan)

echo "2. Raw API response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "3. Extracting power field from response:"
echo "$RESPONSE" | jq '.scanResults[0].power' 2>/dev/null || echo "Could not extract power field"

echo ""
echo "4. Extracting all fields from first result:"
echo "$RESPONSE" | jq '.scanResults[0]' 2>/dev/null || echo "Could not extract scan result"

echo ""
echo "5. Summary:"
POWER=$(echo "$RESPONSE" | jq -r '.scanResults[0].power' 2>/dev/null)
FRAMES=$(echo "$RESPONSE" | jq -r '.scanResults[0].frameCount' 2>/dev/null)
STRENGTH=$(echo "$RESPONSE" | jq -r '.scanResults[0].strength' 2>/dev/null)

echo "Power: $POWER"
echo "Frames: $FRAMES" 
echo "Strength: $STRENGTH"

if [ "$POWER" != "null" ] && [ "$POWER" != "-100" ]; then
    echo "✓ Power measurement working!"
else
    echo "✗ Power measurement not working"
fi