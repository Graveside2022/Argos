#!/bin/bash

echo "=== Restarting HackRF Services ==="
echo "Date: $(date)"

# Kill any existing hackrf_sweep processes
echo "1. Killing existing hackrf_sweep processes..."
sudo pkill -9 hackrf_sweep

# Give it a moment to clean up
sleep 2

# Clear system logs if they're too large
echo "2. Checking system logs..."
SYSLOG_SIZE=$(du -m /var/log/syslog 2>/dev/null | cut -f1)
if [ "$SYSLOG_SIZE" -gt "100" ]; then
    echo "   Rotating large syslog (${SYSLOG_SIZE}MB)..."
    sudo logrotate -f /etc/logrotate.d/rsyslog
fi

# Restart the argos-dev service
echo "3. Restarting argos-dev service..."
sudo systemctl restart argos-dev.service

# Wait for service to start
sleep 5

# Check service status
echo "4. Checking service status..."
sudo systemctl status argos-dev.service --no-pager | head -15

echo ""
echo "=== Restart complete ==="
echo "Service URL: http://100.68.185.86:5173"