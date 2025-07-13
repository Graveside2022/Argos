#!/bin/bash

echo "=== HackRF Memory Monitor ==="
echo "Press Ctrl+C to stop"
echo ""

# Function to get process info
get_process_info() {
    local pid=$1
    if [ -n "$pid" ]; then
        ps -p $pid -o pid,vsz,rss,comm --no-headers 2>/dev/null | awk '{printf "PID: %s, VSZ: %.1fMB, RSS: %.1fMB, CMD: %s\n", $1, $2/1024, $3/1024, $4}'
    fi
}

# Header
printf "%-20s %-15s %-15s %-30s %-30s\n" "TIME" "FREE MEM" "AVAILABLE" "NODE.JS" "HACKRF_SWEEP"

while true; do
    # Get current time
    TIME=$(date +"%Y-%m-%d %H:%M:%S")
    
    # Get memory info
    MEM_INFO=$(free -m | grep "^Mem:")
    FREE_MEM=$(echo $MEM_INFO | awk '{print $4"MB"}')
    AVAIL_MEM=$(echo $MEM_INFO | awk '{print $7"MB"}')
    
    # Get process info
    NODE_PID=$(pgrep -f "node.*vite" | head -1)
    HACKRF_PID=$(pgrep -x "hackrf_sweep")
    
    NODE_INFO="Not running"
    HACKRF_INFO="Not running"
    
    if [ -n "$NODE_PID" ]; then
        NODE_INFO=$(get_process_info $NODE_PID)
    fi
    
    if [ -n "$HACKRF_PID" ]; then
        HACKRF_INFO=$(get_process_info $HACKRF_PID)
    fi
    
    # Print current stats
    printf "%-20s %-15s %-15s %-30s %-30s\n" "$TIME" "$FREE_MEM" "$AVAIL_MEM" "$NODE_INFO" "$HACKRF_INFO"
    
    # Check for low memory warning
    AVAIL_NUM=$(echo $MEM_INFO | awk '{print $7}')
    if [ "$AVAIL_NUM" -lt "500" ]; then
        echo "*** WARNING: Low memory! Available: ${AVAIL_NUM}MB ***"
    fi
    
    sleep 5
done