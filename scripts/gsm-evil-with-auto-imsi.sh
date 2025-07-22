#!/bin/bash

echo "Starting GSM Evil with Auto-IMSI enabled..."

# Get frequency parameter (default to 947.2 if not provided)
FREQ=${1:-947.2}
GAIN=${2:-45}

# Clean up
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null
sudo fuser -k 80/tcp 2>/dev/null
sleep 2

# Start GRGSM monitor with USRP B205 Mini support
echo "Starting GRGSM monitor on ${FREQ} MHz with USRP B205 Mini..."
sudo grgsm_livemon_headless --args="type=b200" -s 2e6 -f ${FREQ}M -g ${GAIN} >/dev/null 2>&1 &
GRGSM_PID=$!
echo "GRGSM PID: $GRGSM_PID"
sleep 3

# Create a modified version of GsmEvil.py with IMSI sniffer auto-enabled and CORS support
echo "Creating auto-IMSI version with CORS support..."
cd /usr/src/gsmevil2
sudo cp GsmEvil.py GsmEvil_auto.py
sudo sed -i 's/imsi_sniffer = "off"/imsi_sniffer = "on"/' GsmEvil_auto.py
sudo sed -i 's/gsm_sniffer = "off"/gsm_sniffer = "on"/' GsmEvil_auto.py
# Add CORS support for iframe compatibility
sudo sed -i 's/socketio = SocketIO(app)/socketio = SocketIO(app, cors_allowed_origins="*")/' GsmEvil_auto.py

# Start GSM Evil with auto-IMSI enabled
echo "Starting GSM Evil with IMSI sniffer auto-enabled..."
sudo bash -c 'source venv/bin/activate && python3 GsmEvil_auto.py --host 0.0.0.0 --port 80' >/dev/null 2>&1 &
GSMEVIL_PID=$!
echo "GSM Evil PID: $GSMEVIL_PID"

# Save PIDs
echo $GRGSM_PID | sudo tee /tmp/grgsm.pid >/dev/null
echo $GSMEVIL_PID | sudo tee /tmp/gsmevil.pid >/dev/null

sleep 3

echo "✓ GSM Evil started with IMSI sniffer AUTO-ENABLED!"
echo "  Access from: http://100.79.154.94/gsm-evil"
echo "  Direct access: http://100.79.154.94:80"
echo "  IMSI sniffer: ENABLED by default"
echo ""
echo "Checking database..."
if [ -f "/usr/src/gsmevil2/database/imsi.db" ]; then
    echo "  ✓ IMSI database exists"
else
    echo "  ⚠ IMSI database will be created when first IMSI is captured"
fi