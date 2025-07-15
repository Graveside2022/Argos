#!/bin/bash

# Simple GSMEvil2 Start Script - Based on YouTube Tutorial

echo "=== Starting GSMEvil2 ==="

# Kill any existing processes
pkill -f "grgsm_livemon" 2>/dev/null
pkill -f "GsmEvil.py" 2>/dev/null
sleep 1

# Clone GSMEvil2 if needed
if [ ! -d "/usr/src/gsmevil2" ]; then
    cd /usr/src
    git clone https://github.com/ninjhacks/gsmevil2.git
fi

# Create virtual environment if needed
if [ ! -d "/tmp/gsmevil2_venv" ]; then
    python3 -m venv /tmp/gsmevil2_venv
    /tmp/gsmevil2_venv/bin/pip install Flask Flask-SocketIO pyshark
fi

# Start gr-gsm_livemon
echo "Starting gr-gsm_livemon..."
grgsm_livemon_headless -f 948.6M -g 40 --args="hackrf" --collector 127.0.0.1 --collectorport 4729 >/tmp/grgsm.log 2>&1 &
echo $! > /tmp/grgsm.pid

sleep 2

# Start GSMEvil2
echo "Starting GSMEvil2..."
cd /usr/src/gsmevil2
/tmp/gsmevil2_venv/bin/python3 GsmEvil.py -p 8080 --host 0.0.0.0 >/tmp/gsmevil2.log 2>&1 &
GSMEVIL_PID=$!
echo $GSMEVIL_PID > /tmp/gsmevil2.pid

# Wait and verify
sleep 2

# Check if both processes are running
if ps -p $(cat /tmp/grgsm.pid 2>/dev/null) >/dev/null 2>&1 && ps -p $GSMEVIL_PID >/dev/null 2>&1; then
    echo "GSMEvil2 started successfully!"
    echo "gr-gsm PID: $(cat /tmp/grgsm.pid)"
    echo "GSMEvil2 PID: $GSMEVIL_PID"
    echo "Web interface: http://localhost:8080"
else
    echo "Error: Failed to start GSMEvil2"
    exit 1
fi