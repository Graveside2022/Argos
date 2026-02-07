#!/bin/bash

# GSM Evil Web Server Startup Script
# This script starts a web server on port 8080 to display GSM monitoring data

PROJECT_ROOT="/home/ubuntu/projects/Argos"
LOG_FILE="/tmp/gsm-evil-server.log"
PID_FILE="/tmp/gsm-evil-server.pid"
PORT=8080

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}[CRITICAL] GSM Evil Web Server [CRITICAL]${NC}"

# Check if server is already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}GSM Evil server already running with PID $PID${NC}"
        exit 1
    else
        rm "$PID_FILE"
    fi
fi

# Check if port is already in use
if lsof -i:$PORT > /dev/null 2>&1; then
    echo -e "${RED}Port $PORT is already in use!${NC}"
    echo "Checking what's using it..."
    lsof -i:$PORT
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed!${NC}"
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install required npm packages if not present
cd /tmp
if [ ! -d "node_modules" ]; then
    echo "Installing required npm packages..."
    npm init -y > /dev/null 2>&1
    npm install express ws cors > /dev/null 2>&1
fi

# Check if the simplified server script exists
if [ ! -f "/tmp/gsm-evil-simple.js" ]; then
    echo -e "${RED}GSM Evil server script not found!${NC}"
    echo "Please ensure /tmp/gsm-evil-simple.js exists"
    exit 1
fi

# Start the server
echo -e "${GREEN}Starting GSM Evil web server on port $PORT...${NC}"
nohup node /tmp/gsm-evil-simple.js > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$PID_FILE"

# Wait a moment for server to start
sleep 2

# Check if server started successfully
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo -e "${GREEN}[PASS] GSM Evil server started successfully!${NC}"
    echo -e "${GREEN}  PID: $SERVER_PID${NC}"
    echo -e "${GREEN}  URL: http://localhost:$PORT${NC}"
    echo -e "${GREEN}  Logs: $LOG_FILE${NC}"
else
    echo -e "${RED}[FAIL] Failed to start GSM Evil server${NC}"
    echo "Check logs at: $LOG_FILE"
    exit 1
fi