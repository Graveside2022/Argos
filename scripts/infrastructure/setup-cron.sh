#!/bin/bash
# Setup cron job for automatic log rotation

CRON_CMD="0 */6 * * * /home/pi/projects/Argos/scripts/log-rotation.sh >/dev/null 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "log-rotation.sh"; then
    echo "Log rotation cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "Added log rotation cron job (runs every 6 hours)"
fi