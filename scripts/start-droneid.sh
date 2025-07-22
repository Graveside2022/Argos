#!/bin/bash

# Start DroneID backend with Alfa card in monitor mode

echo "Starting DroneID backend..."

# Detect Alfa card (usually wlx... interface)
ALFA_INTERFACE=$(ip link show | grep -E "wlx[a-f0-9]{12}" | cut -d: -f2 | tr -d ' ' | head -n1)

if [ -z "$ALFA_INTERFACE" ]; then
    echo "Error: No Alfa WiFi adapter found (looking for wlx... interface)"
    echo "Available interfaces:"
    ip link show | grep -E "^[0-9]+:" | cut -d: -f2
    exit 1
fi

echo "Found Alfa adapter: $ALFA_INTERFACE"

# Put Alfa card in monitor mode
echo "Setting $ALFA_INTERFACE to monitor mode..."
sudo ip link set $ALFA_INTERFACE down
sudo iw dev $ALFA_INTERFACE set type monitor
sudo ip link set $ALFA_INTERFACE up

# Verify monitor mode
if iw dev $ALFA_INTERFACE info | grep -q "type monitor"; then
    echo "✓ $ALFA_INTERFACE is now in monitor mode"
else
    echo "Error: Failed to set monitor mode"
    exit 1
fi

# Start RemoteIDReceiver backend
cd /home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver
source venv/bin/activate

echo "Starting RemoteIDReceiver on port 80..."
echo "DroneID page will connect automatically at http://localhost:5173/droneid"
echo ""
echo "Press Ctrl+C to stop"

# Pass the interface to the backend (it will auto-detect if not specified)
# Run in background if called from API
if [ "$1" = "background" ]; then
    nohup sudo venv/bin/python3 ./backend/dronesniffer/main.py -p 80 > /home/ubuntu/projects/Argos/droneid.log 2>&1 &
    echo $! > /home/ubuntu/projects/Argos/droneid.pid
    echo "DroneID backend started in background (PID: $(cat /home/ubuntu/projects/Argos/droneid.pid))"
else
    sudo venv/bin/python3 ./backend/dronesniffer/main.py -p 80
fi