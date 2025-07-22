#!/bin/bash

echo "=== GSM Evil Start Script ==="

# Strong frequencies detected in your area
FREQ=${1:-947.2}
GAIN=${2:-45}

# Kill any existing processes
echo "Cleaning up..."
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null
sudo fuser -k 80/tcp 2>/dev/null
sleep 2

# Start grgsm_livemon
echo "Starting GSM monitor on ${FREQ} MHz..."
sudo grgsm_livemon_headless -f ${FREQ}M -g ${GAIN} >/dev/null 2>&1 &
GRGSM_PID=$!
sleep 3

# Install Flask if needed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "Installing Flask..."
    sudo pip3 install flask >/dev/null 2>&1 || sudo apt-get install -y python3-flask >/dev/null 2>&1
fi

# Apply Socket.IO patch for iframe compatibility
echo "Applying Socket.IO patch..."
if [ -f /home/ubuntu/projects/Argos/scripts/patch-gsmevil-socketio.sh ]; then
    /home/ubuntu/projects/Argos/scripts/patch-gsmevil-socketio.sh
    sleep 1  # Give time for file writes to complete
    echo "Patch applied."
else
    echo "Warning: Patch script not found!"
fi

# Start GSM Evil using the wrapper script with CORS
echo "Starting GSM Evil web interface with CORS support..."
(/home/ubuntu/projects/Argos/scripts/gsm-evil-start-wrapper.sh >/dev/null 2>&1) &
GSMEVIL_PID=$!

# Save PIDs
echo $GRGSM_PID | sudo tee /tmp/grgsm.pid >/dev/null
echo $GSMEVIL_PID | sudo tee /tmp/gsmevil.pid >/dev/null

# Wait and check
sleep 5

# Check success
if sudo lsof -i :80 | grep -q LISTEN; then
    echo ""
    echo "✓ GSM Evil started successfully!"
    echo "  Frequency: ${FREQ} MHz"
    echo "  Open: http://100.79.154.94/gsm-evil"
    echo "  Click gear → Select IMSI"
else
    echo "✗ Failed to start GSM Evil"
    # Try the alternate method
    echo "Trying alternate start method..."
    /home/ubuntu/projects/Argos/scripts/gsm-evil-start-wrapper.sh &
fi