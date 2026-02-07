#!/bin/bash

# GSMEvil2 Start Script - Exact YouTube/README sequence

echo "=== Starting GSMEvil2 (YouTube method) ==="

# Kill any existing processes
pkill -f "grgsm_livemon" 2>/dev/null
pkill -f "GsmEvil.py" 2>/dev/null
sleep 1

# Step 1: Start grgsm_livemon (must be running and showing results)
echo "Starting grgsm_livemon..."
grgsm_livemon_headless -f 948.6M -g 40 --args="hackrf" --collector 127.0.0.1 --collectorport 4729 >/tmp/grgsm.log 2>&1 &
GRGSM_PID=$!
echo $GRGSM_PID > /tmp/grgsm.pid

# Wait for grgsm to start showing results
echo "Waiting for grgsm_livemon to initialize..."
sleep 3

# Verify grgsm is running
if ! ps -p $GRGSM_PID > /dev/null 2>&1; then
    echo "Error: grgsm_livemon failed to start"
    exit 1
fi

echo "[PASS] grgsm_livemon is running (PID: $GRGSM_PID)"

# Step 2: Change to GSMEvil2 directory
cd /usr/src/gsmevil2 || {
    echo "GSMEvil2 not found. Cloning..."
    cd /usr/src
    git clone https://github.com/ninjhacks/gsmevil2.git
    cd gsmevil2
}

# Step 3: Create/activate virtual environment (matching README)
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install Flask Flask-SocketIO pyshark
else
    source venv/bin/activate
fi

# Step 4: Run GsmEvil.py on port 80 (as shown in README)
echo "Starting GsmEvil.py on port 80..."
python3 GsmEvil.py -p 80 --host 0.0.0.0 >/tmp/gsmevil2.log 2>&1 &
GSMEVIL_PID=$!
echo $GSMEVIL_PID > /tmp/gsmevil2.pid

# Wait for web interface
sleep 2

# Verify both are running
if ps -p $GRGSM_PID > /dev/null 2>&1 && ps -p $GSMEVIL_PID > /dev/null 2>&1; then
    echo "=== GSMEvil2 Started Successfully ==="
    echo "1. grgsm_livemon is running and showing results"
    echo "2. Open Firefox and go to http://localhost:80"
    echo "3. Turn on IMSI and/or SMS catching"
else
    echo "Error: Failed to start GSMEvil2"
    exit 1
fi