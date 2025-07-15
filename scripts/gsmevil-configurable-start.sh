#!/bin/bash

# GSMEvil2 Start Script - Configurable Frequency Version
# Based on README method with frequency parameter support

# Default to 943 MHz (from successful YouTube tutorial)
FREQUENCY="${1:-943}"
GAIN="${2:-40}"

echo "=== Starting GSMEvil2 (Configurable Method) ==="
echo "Frequency: ${FREQUENCY} MHz"
echo "Gain: ${GAIN} dB"

# Clean up first
echo "Cleaning up existing processes..."
pkill -f "grgsm_livemon" 2>/dev/null
pkill -f "GsmEvil.py" 2>/dev/null
sleep 1

# Step 1: grgsm_livemon must be running and showing results
echo "[1/3] Starting grgsm_livemon at ${FREQUENCY}MHz..."
grgsm_livemon_headless -f ${FREQUENCY}M -g ${GAIN} --args="hackrf" --collector 127.0.0.1 --collectorport 4729 > /tmp/grgsm.log 2>&1 &
GRGSM_PID=$!

# Wait for it to start showing results
echo "Waiting for grgsm_livemon to show results..."
sleep 4

if ! ps -p $GRGSM_PID > /dev/null 2>&1; then
    echo "ERROR: grgsm_livemon failed to start!"
    exit 1
fi

echo "✓ grgsm_livemon is running at ${FREQUENCY}MHz (PID: $GRGSM_PID)"
echo $GRGSM_PID > /tmp/grgsm.pid

# Step 2: Go to GSMEvil2 directory
echo "[2/3] Setting up GSMEvil2 environment..."
cd /usr/src/gsmevil2 || {
    echo "GSMEvil2 not found. Installing..."
    cd /usr/src
    git clone https://github.com/ninjhacks/gsmevil2.git
    cd gsmevil2
}

# Create venv if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Step 3: Activate venv and run
echo "[3/3] Starting GsmEvil.py..."
source venv/bin/activate

# Install dependencies if needed
pip install Flask Flask-SocketIO pyshark 2>/dev/null

# Run GsmEvil.py
python3 GsmEvil.py -p 80 --host 0.0.0.0 > /tmp/gsmevil2.log 2>&1 &
GSMEVIL_PID=$!
echo $GSMEVIL_PID > /tmp/gsmevil2.pid

# Verify
sleep 2
if ps -p $GSMEVIL_PID > /dev/null 2>&1; then
    echo ""
    echo "=== GSMEvil2 Started Successfully! ==="
    echo "✓ grgsm_livemon is running at ${FREQUENCY}MHz"
    echo "✓ venv is activated"  
    echo "✓ GsmEvil.py is running"
    echo ""
    echo "→ Open Firefox and go to: http://localhost:80"
    echo "→ Turn on IMSI and/or SMS catching"
    echo ""
    echo "TIP: Common GSM900 downlink frequencies:"
    echo "  935-960 MHz (try 940, 943, 945, 950)"
    echo "  For GSM1800: 1805-1880 MHz"
    echo ""
else
    echo "ERROR: GsmEvil.py failed to start!"
    exit 1
fi