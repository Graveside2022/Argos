#!/bin/bash

# Stop DroneID backend and reset Alfa card

echo "Stopping DroneID backend..."

# Kill the process
if [ -f /home/ubuntu/projects/Argos/droneid.pid ]; then
    PID=$(cat /home/ubuntu/projects/Argos/droneid.pid)
    if kill -0 $PID 2>/dev/null; then
        sudo kill $PID
        echo "Stopped DroneID backend (PID: $PID)"
    fi
    rm -f /home/ubuntu/projects/Argos/droneid.pid
else
    # Try to find and kill by process name
    sudo pkill -f "dronesniffer/main.py" || true
fi

# Reset Alfa card
ALFA_INTERFACE=$(ip link show | grep -E "wlx[a-f0-9]{12}" | cut -d: -f2 | tr -d ' ' | head -n1)
if [ -n "$ALFA_INTERFACE" ]; then
    echo "Resetting $ALFA_INTERFACE to managed mode..."
    sudo ip link set $ALFA_INTERFACE down 2>/dev/null || true
    sudo iw dev $ALFA_INTERFACE set type managed 2>/dev/null || true
    echo "✓ Alfa adapter reset"
fi

echo "DroneID backend stopped"