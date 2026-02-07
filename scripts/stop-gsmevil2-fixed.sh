#!/bin/bash

# GSMEvil2 Stop Script - Comprehensive Process Cleanup
# This script stops both gr-gsm_livemon and GSMEvil2

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PID files
GRGSM_PID_FILE="/tmp/grgsm.pid"
GSMEVIL_PID_FILE="/tmp/gsmevil2.pid"

echo -e "${YELLOW}=== Stopping GSMEvil2 Services ===${NC}"

# Function to kill process by PID file
kill_by_pid_file() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        PID=$(cat "$pid_file")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping $service_name (PID: $PID)...${NC}"
            kill $PID 2>/dev/null
            sleep 1
            
            # Force kill if still running
            if ps -p $PID > /dev/null 2>&1; then
                echo -e "${YELLOW}Force killing $service_name...${NC}"
                kill -9 $PID 2>/dev/null
            fi
            
            if ! ps -p $PID > /dev/null 2>&1; then
                echo -e "${GREEN}[PASS] $service_name stopped${NC}"
            else
                echo -e "${RED}[FAIL] Failed to stop $service_name${NC}"
            fi
        else
            echo -e "${YELLOW}$service_name PID file exists but process not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}No PID file found for $service_name${NC}"
    fi
}

# Step 1: Stop GSMEvil2 Python process
echo -e "${YELLOW}Stopping GSMEvil2...${NC}"

# Try PID file first
kill_by_pid_file "$GSMEVIL_PID_FILE" "GSMEvil2"

# Kill all GSMEvil processes by name
GSMEVIL_PIDS=$(pgrep -f "python.*GsmEvil.py")
if [ -n "$GSMEVIL_PIDS" ]; then
    echo -e "${YELLOW}Found additional GSMEvil2 processes, killing...${NC}"
    for PID in $GSMEVIL_PIDS; do
        kill $PID 2>/dev/null
        echo -e "${GREEN}[PASS] Killed GSMEvil2 process $PID${NC}"
    done
    sleep 1
    # Force kill any remaining
    pkill -9 -f "python.*GsmEvil.py" 2>/dev/null
fi

# Step 2: Stop gr-gsm_livemon
echo -e "${YELLOW}Stopping gr-gsm_livemon...${NC}"

# Try PID file first
kill_by_pid_file "$GRGSM_PID_FILE" "gr-gsm_livemon"

# Kill all grgsm processes by name
GRGSM_PIDS=$(pgrep -f "grgsm_livemon")
if [ -n "$GRGSM_PIDS" ]; then
    echo -e "${YELLOW}Found additional gr-gsm processes, killing...${NC}"
    for PID in $GRGSM_PIDS; do
        kill $PID 2>/dev/null
        echo -e "${GREEN}[PASS] Killed gr-gsm process $PID${NC}"
    done
    sleep 1
    # Force kill any remaining
    pkill -9 -f "grgsm_livemon" 2>/dev/null
fi

# Step 3: Clean up port 8080
echo -e "${YELLOW}Cleaning up port 8080...${NC}"
PORT_PID=$(lsof -ti:8080)
if [ -n "$PORT_PID" ]; then
    echo -e "${YELLOW}Killing process using port 8080 (PID: $PORT_PID)...${NC}"
    kill $PORT_PID 2>/dev/null
    sleep 1
    if lsof -ti:8080 > /dev/null 2>&1; then
        kill -9 $PORT_PID 2>/dev/null
    fi
    echo -e "${GREEN}[PASS] Port 8080 cleared${NC}"
else
    echo -e "${GREEN}[PASS] Port 8080 is already free${NC}"
fi

# Step 4: Clean up any remaining processes
echo -e "${YELLOW}Final cleanup...${NC}"

# Kill any remaining Python processes related to GSMEvil
pkill -f "GsmEvil" 2>/dev/null
pkill -f "gsmevil" 2>/dev/null

# Kill any remaining gr-gsm processes
pkill -f "gr.*gsm" 2>/dev/null
pkill -f "grgsm" 2>/dev/null

# Step 5: Remove PID files
rm -f "$GRGSM_PID_FILE" "$GSMEVIL_PID_FILE"

# Step 6: Verify everything is stopped
echo -e "${YELLOW}Verifying all processes are stopped...${NC}"

ALL_CLEAR=true

# Check for GSMEvil processes
if pgrep -f "GsmEvil.py" > /dev/null; then
    echo -e "${RED}[FAIL] GSMEvil2 processes still running!${NC}"
    pgrep -af "GsmEvil.py"
    ALL_CLEAR=false
else
    echo -e "${GREEN}[PASS] No GSMEvil2 processes found${NC}"
fi

# Check for gr-gsm processes
if pgrep -f "grgsm_livemon" > /dev/null; then
    echo -e "${RED}[FAIL] gr-gsm processes still running!${NC}"
    pgrep -af "grgsm_livemon"
    ALL_CLEAR=false
else
    echo -e "${GREEN}[PASS] No gr-gsm processes found${NC}"
fi

# Check port 8080
if lsof -ti:8080 > /dev/null 2>&1; then
    echo -e "${RED}[FAIL] Port 8080 is still in use!${NC}"
    lsof -i:8080
    ALL_CLEAR=false
else
    echo -e "${GREEN}[PASS] Port 8080 is free${NC}"
fi

if [ "$ALL_CLEAR" = true ]; then
    echo -e "${GREEN}=== All GSMEvil2 services stopped successfully ===${NC}"
else
    echo -e "${RED}=== Some services may still be running ===${NC}"
    echo -e "${YELLOW}Try running the nuclear option:${NC}"
    echo "/home/ubuntu/projects/Argos/scripts/nuclear-stop-gsmevil.sh"
fi