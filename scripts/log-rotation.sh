#!/bin/bash
# Log rotation script for Argos services

LOG_DIR="/tmp"
MAX_SIZE="10M"  # Max size before rotation
KEEP_DAYS=7     # Days to keep old logs

# Function to rotate a log file
rotate_log() {
    local logfile="$1"
    if [ -f "$logfile" ]; then
        local size=$(du -h "$logfile" 2>/dev/null | cut -f1)
        # Check if file is larger than MAX_SIZE
        if [ $(du -b "$logfile" 2>/dev/null | cut -f1) -gt 10485760 ]; then
            echo "Rotating $logfile (size: $size)"
            mv "$logfile" "${logfile}.$(date +%Y%m%d_%H%M%S)"
            touch "$logfile"
        fi
    fi
}

# Rotate known log files (only hackrf-sweeper is actively used)
rotate_log "$LOG_DIR/hackrf-sweeper.log"

# Clean up old rotated logs
find "$LOG_DIR" -name "*.log.*" -mtime +$KEEP_DAYS -delete 2>/dev/null

echo "Log rotation completed"