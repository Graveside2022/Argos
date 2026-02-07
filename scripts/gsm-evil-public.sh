#!/bin/bash

echo "Starting GSM Evil (Public Access)..."

# Get frequency parameter (default to 947.2 if not provided)
FREQ=${1:-947.2}
GAIN=${2:-45}

# Clean up
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null
sudo fuser -k 80/tcp 2>/dev/null
sleep 2

# Start GRGSM monitor
echo "Starting GRGSM monitor on ${FREQ} MHz..."
sudo grgsm_livemon_headless -f ${FREQ}M -g ${GAIN} >/dev/null 2>&1 &
GRGSM_PID=$!
echo "GRGSM PID: $GRGSM_PID"
sleep 3

# Start GSM Evil with public access (bind to all interfaces)
echo "Starting GSM Evil web interface on all interfaces..."
cd /usr/src/gsmevil2
sudo bash -c 'source venv/bin/activate && python3 GsmEvil.py --host 0.0.0.0 --port 80' >/dev/null 2>&1 &
GSMEVIL_PID=$!
echo "GSM Evil PID: $GSMEVIL_PID"

# Save PIDs
echo $GRGSM_PID | sudo tee /tmp/grgsm.pid >/dev/null
echo $GSMEVIL_PID | sudo tee /tmp/gsmevil.pid >/dev/null

sleep 3

# Enable IMSI sniffer
echo "Enabling IMSI sniffer..."
sleep 5  # Wait for web interface to fully start
python3 /home/ubuntu/projects/Argos/scripts/enable-imsi-sniffer.py 2>/dev/null || echo "Note: Could not auto-enable IMSI sniffer"

echo "[PASS] GSM Evil started!"
echo "  Access from: http://100.79.154.94/gsm-evil"
echo "  Direct access: http://100.79.154.94:80"
echo "  IMSI sniffer: Auto-enabled"