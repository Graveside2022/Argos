#!/bin/bash

# GSM Evil Start Script - No Sudo Required
# This version works without passwordless sudo

FREQ="${1:-947.4}"
GAIN="${2:-45}"

echo "Starting GSM Evil with Auto-IMSI enabled (no sudo)..."

# Clean up any existing processes (try without sudo)
pkill -f grgsm_livemon 2>/dev/null || true
pkill -f GsmEvil 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true

# Start GRGSM monitor
# Detect SDR hardware: USRP B205 Mini or HackRF One
DEVICE_ARGS=""
SAMPLE_RATE=""
if uhd_find_devices 2>/dev/null | grep -q "B205"; then
    echo "Starting GRGSM monitor on ${FREQ} MHz with USRP B205 Mini..."
    DEVICE_ARGS='--args="type=b200"'
    SAMPLE_RATE="-s 2e6"
else
    echo "Starting GRGSM monitor on ${FREQ} MHz with HackRF One..."
fi
grgsm_livemon_headless ${DEVICE_ARGS} ${SAMPLE_RATE} -f ${FREQ}M -g ${GAIN} >/dev/null 2>&1 &
GRGSM_PID=$!
echo "GRGSM PID: $GRGSM_PID"

# Navigate to GSM Evil directory
cd /home/kali/gsmevil-user

# Create auto-IMSI version if needed
if [ ! -f GsmEvil_auto.py ]; then
    echo "Creating auto-IMSI version with CORS support..."
    cp GsmEvil.py GsmEvil_auto.py
    sed -i 's/imsi_sniffer = "off"/imsi_sniffer = "on"/' GsmEvil_auto.py
    sed -i 's/gsm_sniffer = "off"/gsm_sniffer = "on"/' GsmEvil_auto.py
    # Add CORS support for Socket.IO
    sed -i 's/socketio = SocketIO(app)/socketio = SocketIO(app, cors_allowed_origins="*")/' GsmEvil_auto.py
fi

# Start GSM Evil with IMSI sniffer auto-enabled on port 8080 (no sudo required)
echo "Starting GSM Evil with IMSI sniffer auto-enabled on port 8080..."
if [ -d venv ]; then
    source venv/bin/activate && python3 GsmEvil_auto.py --host 0.0.0.0 --port 8080 >/dev/null 2>&1 &
else
    python3 GsmEvil_auto.py --host 0.0.0.0 --port 8080 >/dev/null 2>&1 &
fi
GSMEVIL_PID=$!
echo "GSM Evil PID: $GSMEVIL_PID"

# Save PIDs (try to write to /tmp without sudo)
echo $GRGSM_PID > /tmp/grgsm.pid 2>/dev/null || true
echo $GSMEVIL_PID > /tmp/gsmevil.pid 2>/dev/null || true

# Wait a moment for services to start
sleep 3

# Check if services are running
if ps -p $GRGSM_PID > /dev/null 2>&1 && ps -p $GSMEVIL_PID > /dev/null 2>&1; then
    echo "✓ GSM Evil started with IMSI sniffer AUTO-ENABLED on port 8080!"
    echo "  Access from: http://$(hostname -I | awk '{print $1}'):8080"
    exit 0
else
    echo "✗ Failed to start GSM Evil services"
    # Clean up if failed
    kill $GRGSM_PID 2>/dev/null || true
    kill $GSMEVIL_PID 2>/dev/null || true
    exit 1
fi