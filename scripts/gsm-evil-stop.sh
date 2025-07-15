#!/bin/bash

echo "Stopping GSM Evil..."

# Kill processes
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null

# Clear port 80
sudo fuser -k 80/tcp 2>/dev/null

# Clean up PID files
sudo rm -f /tmp/grgsm.pid /tmp/gsmevil.pid 2>/dev/null

echo "GSM Evil stopped."