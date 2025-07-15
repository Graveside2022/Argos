#!/bin/bash

echo "=== GSM Evil Production Script ==="

# Strong frequencies detected in your area
FREQ=${1:-947.2}
GAIN=${2:-45}

# Kill any existing processes
echo "Cleaning up any existing processes..."
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null
sudo fuser -k 80/tcp 2>/dev/null
sleep 2

# Start grgsm_livemon_headless (redirect output to avoid flooding)
echo "Starting GSM monitor on ${FREQ} MHz with gain ${GAIN}..."
sudo grgsm_livemon_headless -f ${FREQ}M -g ${GAIN} >/dev/null 2>&1 &
GRGSM_PID=$!
echo "Monitor PID: $GRGSM_PID"
sleep 3

# Navigate to GSM Evil directory and start it
echo "Starting GSM Evil web interface..."
cd /usr/src/gsmevil2

# Start GSM Evil without Flask check (it's already installed in that environment)
sudo python3 GsmEvil.py >/dev/null 2>&1 &
GSMEVIL_PID=$!
echo "GSM Evil PID: $GSMEVIL_PID"

# Save PIDs for cleanup
echo $GRGSM_PID | sudo tee /tmp/grgsm.pid >/dev/null
echo $GSMEVIL_PID | sudo tee /tmp/gsmevil.pid >/dev/null

# Wait for services to start
sleep 3

# Verify services are running
if ps -p $GRGSM_PID >/dev/null 2>&1; then
    echo "✓ GSM monitor is running"
else
    echo "✗ GSM monitor failed to start"
    exit 1
fi

# Check if port 80 is listening (GSM Evil might take a moment)
for i in {1..5}; do
    if sudo lsof -i :80 | grep -q LISTEN; then
        echo "✓ GSM Evil web interface is running on port 80"
        break
    else
        if [ $i -eq 5 ]; then
            echo "✗ GSM Evil web interface failed to start"
            # Try to see what went wrong
            echo "Checking GSM Evil process..."
            ps aux | grep -i gsmevil | grep -v grep
            exit 1
        fi
        echo "Waiting for GSM Evil to start... ($i/5)"
        sleep 2
    fi
done

echo ""
echo "=== GSM Evil Started Successfully! ==="
echo "Frequency: ${FREQ} MHz"
echo "Web Interface: http://localhost:80"
echo ""
echo "Instructions:"
echo "1. Open http://100.79.154.94/gsm-evil in your browser"
echo "2. Click the gear icon"
echo "3. Select 'IMSI' to start capturing"
echo ""
echo "Alternative frequencies: 948.6, 949.0, 957.6 MHz"