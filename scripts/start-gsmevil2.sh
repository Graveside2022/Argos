#!/bin/bash

# GSMEvil2 Web Server Startup Script
# Starts the actual GSMEvil2 IMSI/SMS catcher web interface

GSMEVIL_DIR="/tmp/gsmevil2"
LOG_FILE="/tmp/gsmevil2.log"
PID_FILE="/tmp/gsmevil2.pid"
PORT=8080
VENV_DIR="/tmp/gsmevil2_venv"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}🔥 Starting GSMEvil2 IMSI/SMS Catcher 🔥${NC}"

# Check if GSMEvil2 is already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}GSMEvil2 already running with PID $PID${NC}"
        exit 1
    else
        rm "$PID_FILE"
    fi
fi

# Kill any existing GSMEvil2 or conflicting processes on port 8080
echo "Stopping any existing processes on port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
pkill -f "GsmEvil.py" 2>/dev/null || true
sleep 1

# Check if GSMEvil2 directory exists
if [ ! -d "$GSMEVIL_DIR" ]; then
    echo -e "${RED}GSMEvil2 not found at $GSMEVIL_DIR${NC}"
    echo "Cloning GSMEvil2..."
    git clone https://github.com/ninjhacks/gsmevil2.git "$GSMEVIL_DIR"
fi

# Ensure database directory exists
mkdir -p "$GSMEVIL_DIR/database"

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    pip install flask==2.2.2 flask-socketio==5.3.2 pyshark==0.5.3 werkzeug==2.2.2
else
    source "$VENV_DIR/bin/activate"
fi

# Start grgsm_livemon_headless if not already running
if ! pgrep -f "grgsm_livemon" > /dev/null; then
    echo "Starting grgsm_livemon_headless..."
    # Kill any stale processes first
    pkill -f "grgsm_livemon" 2>/dev/null || true
    sleep 1
    
    # Start with explicit UDP sink to localhost:4729
    # Note: --collector sets the destination IP, --collectorport sets the UDP port
    # Using frequency 948.6 MHz (channel 68) - strongest signal from kalibrate scan
    nohup grgsm_livemon_headless -f 948.6e6 -s 2e6 -g 40 --collector 127.0.0.1 --collectorport 4729 > /tmp/grgsm.log 2>&1 &
    GRGSM_PID=$!
    echo $GRGSM_PID > /tmp/grgsm.pid
    
    # Wait and verify it started
    sleep 3
    if ! ps -p $GRGSM_PID > /dev/null 2>&1; then
        echo -e "${RED}✗ Failed to start grgsm_livemon_headless${NC}"
        echo "Check /tmp/grgsm.log for errors"
        tail -10 /tmp/grgsm.log
    else
        echo -e "${GREEN}✓ grgsm_livemon_headless started (PID: $GRGSM_PID)${NC}"
    fi
fi

# Apply CPU fix patch if not already applied
if ! grep -q "CRITICAL FIX: Sleep when sniffer is off" "$GSMEVIL_DIR/GsmEvil.py"; then
    echo "Applying CPU usage fix to GSMEvil2..."
    python3 /home/ubuntu/projects/Argos/scripts/gsmevil2-patch.py
    cp "$GSMEVIL_DIR/GsmEvil_fixed.py" "$GSMEVIL_DIR/GsmEvil.py"
fi

# Start GSMEvil2
echo -e "${GREEN}Starting GSMEvil2 on port $PORT...${NC}"
# Must run from GSMEvil directory for relative paths to work
cd "$GSMEVIL_DIR" && nohup "$VENV_DIR/bin/python3" GsmEvil.py -p $PORT --host 0.0.0.0 > "$LOG_FILE" 2>&1 &
GSMEVIL_PID=$!
echo $GSMEVIL_PID > "$PID_FILE"

# Wait for startup
sleep 3

# Check if GSMEvil2 started successfully
if ps -p $GSMEVIL_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ GSMEvil2 started successfully!${NC}"
    echo -e "${GREEN}  PID: $GSMEVIL_PID${NC}"
    echo -e "${GREEN}  URL: http://0.0.0.0:$PORT (accessible from any interface)${NC}"
    echo -e "${GREEN}  Logs: $LOG_FILE${NC}"
    echo -e "${YELLOW}  Note: Make sure gr-gsm is capturing on the correct frequency${NC}"
else
    echo -e "${RED}✗ Failed to start GSMEvil2${NC}"
    echo "Check logs at: $LOG_FILE"
    tail -20 "$LOG_FILE"
    exit 1
fi