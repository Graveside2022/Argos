#!/bin/bash

echo "Starting GSM Evil (Fixed Version)..."

# Clean up
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null
sudo fuser -k 80/tcp 2>/dev/null
sleep 2

# Start GRGSM monitor
echo "Starting GRGSM monitor on 947.2 MHz..."
sudo grgsm_livemon_headless -f 947.2M -g 45 >/dev/null 2>&1 &
GRGSM_PID=$!
echo "GRGSM PID: $GRGSM_PID"
sleep 3

# Start GSM Evil using helper script
echo "Starting GSM Evil web interface..."
sudo /home/ubuntu/projects/Argos/run-gsmevil.sh >/dev/null 2>&1 &
GSMEVIL_PID=$!
echo "GSM Evil PID: $GSMEVIL_PID"

# Save PIDs
echo $GRGSM_PID | sudo tee /tmp/grgsm.pid >/dev/null
echo $GSMEVIL_PID | sudo tee /tmp/gsmevil.pid >/dev/null

sleep 3

# Verify
if ps -p $GRGSM_PID >/dev/null && ps -p $GSMEVIL_PID >/dev/null; then
    echo "[PASS] GSM Evil started successfully!"
    echo "  Web interface: http://localhost:80"
else
    echo "[FAIL] Failed to start GSM Evil"
fi