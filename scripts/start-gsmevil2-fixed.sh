#!/bin/bash

# GSMEvil2 Start Script - Based on YouTube Tutorial
# This script starts gr-gsm_livemon and GSMEvil2 for IMSI catching

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GSMEVIL_DIR="/usr/src/gsmevil2"
VENV_DIR="/tmp/gsmevil2_venv"
PORT=8080
DEFAULT_FREQ=948.6  # Default frequency in MHz
LOG_DIR="/var/log/gsmevil2"
GRGSM_PID_FILE="/tmp/grgsm.pid"
GSMEVIL_PID_FILE="/tmp/gsmevil2.pid"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

echo -e "${YELLOW}=== GSMEvil2 Startup Script ===${NC}"

# Step 1: Check if already running
echo -e "${YELLOW}Checking for existing processes...${NC}"
if [ -f "$GRGSM_PID_FILE" ] && ps -p $(cat "$GRGSM_PID_FILE") > /dev/null 2>&1; then
    echo -e "${RED}gr-gsm_livemon is already running!${NC}"
    echo "Stop it first with: /home/ubuntu/projects/Argos/scripts/stop-gsmevil2.sh"
    exit 1
fi

if [ -f "$GSMEVIL_PID_FILE" ] && ps -p $(cat "$GSMEVIL_PID_FILE") > /dev/null 2>&1; then
    echo -e "${RED}GSMEvil2 is already running!${NC}"
    echo "Stop it first with: /home/ubuntu/projects/Argos/scripts/stop-gsmevil2.sh"
    exit 1
fi

# Step 2: Clean up any stale processes
echo -e "${YELLOW}Cleaning up stale processes...${NC}"
pkill -f "grgsm_livemon" 2>/dev/null
pkill -f "GsmEvil.py" 2>/dev/null
sleep 1

# Step 3: Check if GSMEvil2 directory exists
if [ ! -d "$GSMEVIL_DIR" ]; then
    echo -e "${YELLOW}GSMEvil2 not found. Cloning from repository...${NC}"
    cd /usr/src
    git clone https://github.com/ninjhacks/gsmevil2.git
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to clone GSMEvil2 repository${NC}"
        exit 1
    fi
fi

# Step 4: Set up virtual environment (like in YouTube tutorial)
echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    pip install --upgrade pip
    pip install Flask==2.3.2 Flask-SocketIO==5.3.4 pyshark werkzeug==2.3.6
else
    source "$VENV_DIR/bin/activate"
fi

# Step 5: Apply CPU fix patch if needed
if ! grep -q "CRITICAL FIX: Sleep when sniffer is off" "$GSMEVIL_DIR/GsmEvil.py"; then
    echo -e "${YELLOW}Applying CPU usage fix...${NC}"
    if [ -f "/home/ubuntu/projects/Argos/scripts/gsmevil2-patch.py" ]; then
        python3 /home/ubuntu/projects/Argos/scripts/gsmevil2-patch.py
        if [ -f "$GSMEVIL_DIR/GsmEvil_fixed.py" ]; then
            cp "$GSMEVIL_DIR/GsmEvil_fixed.py" "$GSMEVIL_DIR/GsmEvil.py"
        fi
    fi
fi

# Step 6: Start gr-gsm_livemon (YouTube tutorial step)
echo -e "${GREEN}Starting gr-gsm_livemon on frequency ${DEFAULT_FREQ} MHz...${NC}"
grgsm_livemon_headless -f ${DEFAULT_FREQ}M -g 40 --args="hackrf" --collector 127.0.0.1 --collectorport 4729 > "$LOG_DIR/grgsm.log" 2>&1 &
GRGSM_PID=$!
echo $GRGSM_PID > "$GRGSM_PID_FILE"

# Wait for gr-gsm to initialize
sleep 3

# Verify gr-gsm started
if ! ps -p $GRGSM_PID > /dev/null 2>&1; then
    echo -e "${RED}Failed to start gr-gsm_livemon${NC}"
    echo "Check logs at: $LOG_DIR/grgsm.log"
    tail -10 "$LOG_DIR/grgsm.log"
    exit 1
fi

echo -e "${GREEN}✓ gr-gsm_livemon started (PID: $GRGSM_PID)${NC}"

# Step 7: Start GSMEvil2 (following YouTube tutorial)
echo -e "${GREEN}Starting GSMEvil2 web interface...${NC}"
cd "$GSMEVIL_DIR"

# Start the Python process directly and get its PID
"$VENV_DIR/bin/python3" GsmEvil.py -p $PORT --host 0.0.0.0 > "$LOG_DIR/gsmevil2.log" 2>&1 &
GSMEVIL_PID=$!

# Wait a moment for the process to start
sleep 2

# Get the actual Python process PID (not the shell wrapper)
ACTUAL_PID=$(pgrep -f "python.*GsmEvil.py" | head -1)
if [ -n "$ACTUAL_PID" ]; then
    echo $ACTUAL_PID > "$GSMEVIL_PID_FILE"
    GSMEVIL_PID=$ACTUAL_PID
else
    echo $GSMEVIL_PID > "$GSMEVIL_PID_FILE"
fi

# Wait for GSMEvil2 to fully start
sleep 3

# Step 8: Verify everything is running
echo -e "${YELLOW}Verifying services...${NC}"

# Check gr-gsm
if ps -p $GRGSM_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ gr-gsm_livemon is running${NC}"
else
    echo -e "${RED}✗ gr-gsm_livemon failed to start${NC}"
fi

# Check GSMEvil2
if ps -p $GSMEVIL_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ GSMEvil2 is running${NC}"
    echo -e "${GREEN}✓ Web interface available at: http://$(hostname -I | awk '{print $1}'):${PORT}${NC}"
else
    echo -e "${RED}✗ GSMEvil2 failed to start${NC}"
    echo "Check logs at: $LOG_DIR/gsmevil2.log"
    tail -10 "$LOG_DIR/gsmevil2.log"
    exit 1
fi

echo -e "${GREEN}=== GSMEvil2 Started Successfully ===${NC}"
echo -e "${YELLOW}Instructions:${NC}"
echo -e "1. Open your browser and go to: http://$(hostname -I | awk '{print $1}'):${PORT}"
echo -e "2. Click on 'IMSI Catcher' to start capturing"
echo -e "3. Monitor gr-gsm output in: $LOG_DIR/grgsm.log"
echo -e "4. Monitor GSMEvil2 output in: $LOG_DIR/gsmevil2.log"
echo -e ""
echo -e "${YELLOW}To stop GSMEvil2, run:${NC} /home/ubuntu/projects/Argos/scripts/stop-gsmevil2.sh"