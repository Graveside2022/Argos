#!/bin/bash

echo "=== GPS Diagnostics for Argos ==="
echo "================================"
echo

# Check USB device
echo "1. USB Device Check:"
if lsusb | grep -q "067b:23a3"; then
    echo "   [PASS] GlobalSat BU-353N5 detected"
    lsusb | grep "067b:23a3"
else
    echo "   [FAIL] GPS device not found on USB"
    echo "   Available USB devices:"
    lsusb
fi
echo

# Check device nodes
echo "2. Device Nodes:"
if [ -e /dev/ttyUSB0 ]; then
    echo "   [PASS] /dev/ttyUSB0 exists"
    ls -la /dev/ttyUSB0
else
    echo "   [FAIL] /dev/ttyUSB0 not found"
fi

if [ -e /dev/gps0 ]; then
    echo "   [PASS] /dev/gps0 symlink exists"
    ls -la /dev/gps0
else
    echo "   [FAIL] /dev/gps0 symlink not found"
fi
echo

# Check gpsd service
echo "3. GPSD Service Status:"
if systemctl is-active --quiet gpsd; then
    echo "   [PASS] gpsd is running"
else
    echo "   [FAIL] gpsd is not running"
fi

if systemctl is-enabled --quiet gpsd; then
    echo "   [PASS] gpsd is enabled at boot"
else
    echo "   [FAIL] gpsd is not enabled at boot"
fi
echo

# Check gpsd configuration
echo "4. GPSD Configuration (/etc/default/gpsd):"
if [ -f /etc/default/gpsd ]; then
    grep -E "^DEVICES=|^GPSD_OPTIONS=|^USBAUTO=" /etc/default/gpsd | sed 's/^/   /'
else
    echo "   [FAIL] Configuration file not found"
fi
echo

# Test GPS data
echo "5. GPS Data Test:"
echo "   Checking for NMEA data (5 seconds)..."
if timeout 5 gpspipe -r -n 10 2>/dev/null | grep -q '$G'; then
    echo "   [PASS] Receiving NMEA data"
    echo "   Sample data:"
    timeout 2 gpspipe -r -n 5 2>/dev/null | sed 's/^/   /'
else
    echo "   [FAIL] No GPS data received"
    echo "   Possible issues:"
    echo "   - GPS needs clear sky view"
    echo "   - Device may need 30-60 seconds for initial fix"
    echo "   - Check antenna connection"
fi
echo

# Check GPS position
echo "6. GPS Position Check:"
if timeout 5 gpspipe -w -n 10 2>/dev/null | grep -q '"lat"'; then
    echo "   [PASS] GPS has position data"
    timeout 2 gpspipe -w -n 5 2>/dev/null | grep -E '"lat"|"lon"|"mode"' | head -3 | sed 's/^/   /'
else
    echo "   [FAIL] No position fix yet"
    echo "   GPS may still be acquiring satellites"
fi
echo

# Test Argos API
echo "7. Argos GPS API Test:"
if curl -s http://localhost:5173/api/gps/position 2>/dev/null | grep -q "lat"; then
    echo "   [PASS] Argos GPS API is responding"
    curl -s http://localhost:5173/api/gps/position 2>/dev/null | jq '.' | head -10 | sed 's/^/   /'
else
    echo "   [FAIL] Argos GPS API not responding"
    echo "   Make sure Argos is running"
fi
echo

echo "================================"
echo "Diagnostics complete!"