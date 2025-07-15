#!/bin/bash

# Simple GSMEvil2 Stop Script

echo "Stopping GSMEvil2..."

# Kill by PID files if they exist
if [ -f "/tmp/gsmevil2.pid" ]; then
    kill $(cat /tmp/gsmevil2.pid) 2>/dev/null
    rm -f /tmp/gsmevil2.pid
fi

if [ -f "/tmp/grgsm.pid" ]; then
    kill $(cat /tmp/grgsm.pid) 2>/dev/null
    rm -f /tmp/grgsm.pid
fi

# Kill by process name as backup
pkill -f "GsmEvil.py" 2>/dev/null
pkill -f "grgsm_livemon" 2>/dev/null

# Clear port 8080
fuser -k 8080/tcp 2>/dev/null

echo "GSMEvil2 stopped!"