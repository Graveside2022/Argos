#!/bin/bash
# Argos Dev Server Keepalive Script

SERVICE_NAME="argos-dev.service"
LOG_FILE="/home/pi/projects/Argos/keepalive.log"

# Check if service is active
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "[$(date)] $SERVICE_NAME is not running. Attempting to restart..." >> "$LOG_FILE"
    sudo systemctl start "$SERVICE_NAME"
    sleep 5
    
    # Verify it started
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        echo "[$(date)] Successfully restarted $SERVICE_NAME" >> "$LOG_FILE"
    else
        echo "[$(date)] Failed to restart $SERVICE_NAME" >> "$LOG_FILE"
    fi
else
    echo "[$(date)] $SERVICE_NAME is running normally" >> "$LOG_FILE"
fi

# Keep log file size under control (max 1MB)
if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE") -gt 1048576 ]; then
    tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp"
    mv "$LOG_FILE.tmp" "$LOG_FILE"
fi