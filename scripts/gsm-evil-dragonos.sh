#!/bin/bash

echo "Starting GSM Evil (DragonOS style)..."

# Clean up
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null
sudo pkill -f gsm_evil 2>/dev/null
sudo fuser -k 80/tcp 2>/dev/null
sleep 2

# Terminal 1: Start grgsm_livemon (headless version for script)
echo "Starting GRGSM monitor..."
sudo grgsm_livemon_headless -f 947.2M -g 45 >/dev/null 2>&1 &
GRGSM_PID=$!
sleep 3

# Terminal 2: Navigate and activate virtual environment
echo "Starting GSM Evil web server..."
cd /usr/src/gsmevil2
if [ -f "venv/bin/activate" ]; then
    # Method from video - activate venv and run
    sudo bash -c "source venv/bin/activate && python3.8 gsm_evil.py" >/dev/null 2>&1 &
elif [ -f "GsmEvil.py" ]; then
    # Direct run if no venv
    sudo python3 GsmEvil.py >/dev/null 2>&1 &
elif [ -f "gsm_evil.py" ]; then
    # Lowercase version
    sudo python3 gsm_evil.py >/dev/null 2>&1 &
else
    echo "Error: Cannot find GSM Evil script!"
    exit 1
fi
GSMEVIL_PID=$!

# Save PIDs
echo $GRGSM_PID > /tmp/grgsm.pid
echo $GSMEVIL_PID > /tmp/gsmevil.pid

sleep 3

echo "GSM Evil should be starting on http://localhost:80"
echo "Processes started: GRGSM=$GRGSM_PID, GSMEvil=$GSMEVIL_PID"