#!/bin/bash

# GSMEvil2 Stop Script
# Robustly stops all GSM Evil related processes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}🛑 Stopping GSMEvil2 and related processes...${NC}"

# Function to kill process by PID file
kill_by_pidfile() {
    local pidfile=$1
    local name=$2
    
    if [ -f "$pidfile" ]; then
        PID=$(cat "$pidfile")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping $name (PID: $PID)...${NC}"
            kill -TERM $PID 2>/dev/null
            sleep 1
            # Force kill if still running
            if ps -p $PID > /dev/null 2>&1; then
                kill -9 $PID 2>/dev/null
            fi
        fi
        rm -f "$pidfile"
    fi
}

# 1. Stop GSMEvil2 using PID file
kill_by_pidfile "/tmp/gsmevil2.pid" "GSMEvil2"

# 2. Stop grgsm_livemon using PID file
kill_by_pidfile "/tmp/grgsm.pid" "grgsm_livemon"

# 3. Kill any remaining GSMEvil2 processes
echo "Looking for remaining GSMEvil2 processes..."
for pid in $(pgrep -f "GsmEvil.py"); do
    echo -e "${YELLOW}Killing GSMEvil2 process: $pid${NC}"
    kill -9 $pid 2>/dev/null
done

# 4. Kill any grgsm processes (with and without sudo)
echo "Looking for remaining grgsm processes..."
# Try without sudo first
pkill -f "grgsm_livemon" 2>/dev/null || true
# Try with sudo if available
sudo pkill -f "grgsm_livemon" 2>/dev/null || true

# 5. Kill processes on port 8080
echo "Clearing port 8080..."
for pid in $(lsof -ti:8080 2>/dev/null); do
    echo -e "${YELLOW}Killing process on port 8080: $pid${NC}"
    kill -9 $pid 2>/dev/null
done

# 6. Kill any python processes in the GSMEvil directory
GSMEVIL_DIR="/tmp/gsmevil2"
if [ -d "$GSMEVIL_DIR" ]; then
    for pid in $(lsof +D "$GSMEVIL_DIR" 2>/dev/null | grep python | awk '{print $2}' | uniq); do
        echo -e "${YELLOW}Killing python process in GSMEvil directory: $pid${NC}"
        kill -9 $pid 2>/dev/null
    done
fi

# 7. Clean up any stale processes by command line pattern
# Look for processes with specific command patterns
for pattern in "grgsm_livemon_headless" "collectorport 4729" "GsmEvil.py" "gsmevil2"; do
    pids=$(ps aux | grep -i "$pattern" | grep -v grep | grep -v stop-gsmevil2.sh | awk '{print $2}')
    for pid in $pids; do
        echo -e "${YELLOW}Killing process matching '$pattern': $pid${NC}"
        kill -9 $pid 2>/dev/null || true
    done
done

# 8. Clean up log files and PID files
echo "Cleaning up files..."
rm -f /tmp/gsmevil2.pid /tmp/grgsm.pid /tmp/gsm-evil-server.pid

# 9. Final verification
sleep 1
REMAINING_GSMEVIL=$(pgrep -f "GsmEvil.py" | wc -l)
REMAINING_GRGSM=$(pgrep -f "grgsm_livemon" | wc -l)
PORT_CHECK=$(lsof -ti:8080 2>/dev/null | wc -l)

if [ $REMAINING_GSMEVIL -eq 0 ] && [ $REMAINING_GRGSM -eq 0 ] && [ $PORT_CHECK -eq 0 ]; then
    echo -e "${GREEN}✓ All GSMEvil2 processes stopped successfully!${NC}"
    exit 0
else
    echo -e "${RED}⚠ Warning: Some processes may still be running${NC}"
    [ $REMAINING_GSMEVIL -gt 0 ] && echo -e "${RED}  - $REMAINING_GSMEVIL GSMEvil2 processes still running${NC}"
    [ $REMAINING_GRGSM -gt 0 ] && echo -e "${RED}  - $REMAINING_GRGSM grgsm processes still running${NC}"
    [ $PORT_CHECK -gt 0 ] && echo -e "${RED}  - Port 8080 still in use${NC}"
    exit 1
fi