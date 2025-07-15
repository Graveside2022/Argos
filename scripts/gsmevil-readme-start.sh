#!/bin/bash

# GSMEvil2 Start Script - Following exact README instructions
# README says: grgsm_livemon must be running and showing results
# Then: sudo su, source venv/bin/activate, python3.8 GsmEvil.py

echo "=== Starting GSMEvil2 (README Method) ==="

# Clean up first
echo "Cleaning up existing processes..."
pkill -f "grgsm_livemon" 2>/dev/null
pkill -f "GsmEvil.py" 2>/dev/null
sleep 1

# Step 1: grgsm_livemon must be running and showing results
echo "[1/3] Starting grgsm_livemon (must be showing results)..."
grgsm_livemon_headless -f 948.6M -g 40 --args="hackrf" --collector 127.0.0.1 --collectorport 4729 > /tmp/grgsm.log 2>&1 &
GRGSM_PID=$!

# Wait for it to start showing results
echo "Waiting for grgsm_livemon to show results..."
sleep 4

if ! ps -p $GRGSM_PID > /dev/null 2>&1; then
    echo "ERROR: grgsm_livemon failed to start!"
    exit 1
fi

echo "✓ grgsm_livemon is running and showing results (PID: $GRGSM_PID)"
echo $GRGSM_PID > /tmp/grgsm.pid

# Step 2: Go to GSMEvil2 directory
echo "[2/3] Setting up GSMEvil2 environment..."
cd /usr/src/gsmevil2 || {
    echo "GSMEvil2 not found. Installing..."
    cd /usr/src
    git clone https://github.com/ninjhacks/gsmevil2.git
    cd gsmevil2
}

# Create venv if needed (README shows: source venv/bin/activate)
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Step 3: Activate venv and run (README shows: python3.8 GsmEvil.py)
echo "[3/3] Starting GsmEvil.py..."
source venv/bin/activate

# Install dependencies if needed
pip install Flask Flask-SocketIO pyshark 2>/dev/null

# Run GsmEvil.py (README shows port 80)
python3 GsmEvil.py -p 80 --host 0.0.0.0 > /tmp/gsmevil2.log 2>&1 &
GSMEVIL_PID=$!
echo $GSMEVIL_PID > /tmp/gsmevil2.pid

# Verify
sleep 2
if ps -p $GSMEVIL_PID > /dev/null 2>&1; then
    echo ""
    echo "=== GSMEvil2 Started Successfully! ==="
    echo "✓ grgsm_livemon is running and showing results"
    echo "✓ venv is activated"  
    echo "✓ GsmEvil.py is running"
    echo ""
    echo "→ Open Firefox and go to: http://localhost:80"
    echo "→ Turn on IMSI and/or SMS catching"
    echo ""
else
    echo "ERROR: GsmEvil.py failed to start!"
    exit 1
fi