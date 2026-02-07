#!/bin/bash

# Script to patch GSM Evil Socket.IO configuration for iframe compatibility

echo "Patching GSM Evil Socket.IO configuration..."

# Backup the original file
cp /usr/src/gsmevil2/templates/imsi.html /usr/src/gsmevil2/templates/imsi.html.bak

# Apply the Socket.IO fix
sed -i 's/var socket = io();/var socket = io(window.location.origin);/g' /usr/src/gsmevil2/templates/imsi.html

# Verify the patch was applied (check for either old or new format)
if grep -q "io(window.location.origin" /usr/src/gsmevil2/templates/imsi.html; then
    echo "[PASS] Socket.IO patch already applied"
else
    echo "[FAIL] Failed to apply Socket.IO patch"
    exit 1
fi

# Also add CORS support to the server (required for iframe to work)
# Kill any running GSM Evil processes first
sudo pkill -f "GsmEvil_auto.py" 2>/dev/null || true
sleep 1

# Apply CORS to both original and auto versions
sed -i 's/socketio = SocketIO(app)/socketio = SocketIO(app, cors_allowed_origins="*")/g' /usr/src/gsmevil2/GsmEvil.py
sed -i 's/socketio = SocketIO(app, cors_allowed_origins="\\*")/socketio = SocketIO(app, cors_allowed_origins="*")/g' /usr/src/gsmevil2/GsmEvil.py

if [ -f /usr/src/gsmevil2/GsmEvil_auto.py ]; then
    sed -i 's/socketio = SocketIO(app)/socketio = SocketIO(app, cors_allowed_origins="*")/g' /usr/src/gsmevil2/GsmEvil_auto.py
    sed -i 's/socketio = SocketIO(app, cors_allowed_origins="\\*")/socketio = SocketIO(app, cors_allowed_origins="*")/g' /usr/src/gsmevil2/GsmEvil_auto.py
fi

echo "[PASS] CORS support added to GSM Evil server"

echo "Patch complete! GSM Evil should now work properly in iframes."