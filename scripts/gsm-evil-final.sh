#!/bin/bash

echo "=== GSM Evil Final Production Script ==="

# Strong frequencies detected in your area
FREQ=${1:-947.2}
GAIN=${2:-45}

# Kill any existing processes
echo "Cleaning up any existing processes..."
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null
sudo fuser -k 80/tcp 2>/dev/null
sleep 2

# Start grgsm_livemon_headless
echo "Starting GSM monitor on ${FREQ} MHz with gain ${GAIN}..."
sudo grgsm_livemon_headless -f ${FREQ}M -g ${GAIN} >/dev/null 2>&1 &
GRGSM_PID=$!
echo "Monitor PID: $GRGSM_PID"
sleep 3

# Fix Flask dependency and start GSM Evil
echo "Starting GSM Evil web interface..."
cd /usr/src/gsmevil2

# Check if Flask is installed, install if needed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "Installing Flask dependency..."
    sudo pip3 install flask 2>/dev/null || sudo python3 -m pip install flask 2>/dev/null
fi

# Start GSM Evil
sudo python3 GsmEvil.py >/dev/null 2>&1 &
GSMEVIL_PID=$!
echo "GSM Evil PID: $GSMEVIL_PID"

# Save PIDs for cleanup
echo $GRGSM_PID | sudo tee /tmp/grgsm.pid >/dev/null
echo $GSMEVIL_PID | sudo tee /tmp/gsmevil.pid >/dev/null

# Wait a moment for services to start
sleep 2

# Check if services are running
if ps -p $GRGSM_PID > /dev/null && ps -p $GSMEVIL_PID > /dev/null; then
    echo ""
    echo "✓ GSM Evil started successfully!"
    echo "  Frequency: ${FREQ} MHz"
    echo "  Web Interface: http://localhost:80"
    echo ""
    echo "To capture IMSI:"
    echo "  1. Open http://100.79.154.94/gsm-evil in your browser"
    echo "  2. Click the gear icon"
    echo "  3. Select 'IMSI'"
    echo ""
    echo "Alternative frequencies if no traffic:"
    echo "  948.6 MHz (original), 949.0 MHz, 957.6 MHz"
else
    echo "Error: Failed to start GSM Evil services"
    exit 1
fi