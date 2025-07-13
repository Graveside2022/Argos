#!/bin/bash
# Disable excessive logging in hackrf sweeper service

SWEEPER_FILE="/home/pi/projects/hackrfsweep/hackrfsweep_v1/src/sweeperService.js"
SWEEPER_BACKUP="/home/pi/projects/hackrfsweep/hackrfsweep_v1/src/sweeperService.js.backup"

if [ -f "$SWEEPER_FILE" ]; then
    # Create backup if it doesn't exist
    if [ ! -f "$SWEEPER_BACKUP" ]; then
        cp "$SWEEPER_FILE" "$SWEEPER_BACKUP"
        echo "Created backup at $SWEEPER_BACKUP"
    fi
    
    # Comment out all console.log statements
    sed -i 's/^\s*console\.log/\/\/ console.log/g' "$SWEEPER_FILE"
    
    COUNT=$(grep -c "^[^/]*console\.log" "$SWEEPER_FILE")
    echo "Disabled console.log statements in hackrf sweeper (remaining: $COUNT)"
else
    echo "Sweeper service file not found"
fi

# Also update the start script to not log everything
START_SCRIPT="/home/pi/projects/hackrfsweep/hackrfsweep_v1/start-server.sh"
if [ -f "$START_SCRIPT" ]; then
    # Change logging to only errors
    sed -i 's/npm start > "$LOG_FILE" 2>&1/LOG_LEVEL=error npm start > "$LOG_FILE" 2>\&1/g' "$START_SCRIPT"
    echo "Updated start script to only log errors"
fi