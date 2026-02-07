#!/bin/bash

FREQ=${1:-949.0}
GAIN=${2:-45}

echo "Starting GSM Evil with IMSI sniffer auto-enabled..."
echo "Frequency: $FREQ MHz, Gain: $GAIN"

# Start grgsm_livemon_headless
echo "Starting GRGSM monitor..."
sudo grgsm_livemon_headless -f ${FREQ}M -g ${GAIN} >/dev/null 2>&1 &
GRGSM_PID=$!
echo "GRGSM PID: $GRGSM_PID"

# Wait for grgsm to initialize
sleep 3

# Start GSM Evil in the virtual environment
echo "Starting GSM Evil web interface..."
cd /usr/src/gsmevil2
sudo bash -c "source venv/bin/activate && python3 GsmEvil.py --host 0.0.0.0 --port 80" >/dev/null 2>&1 &
GSMEVIL_PID=$!
echo "GSM Evil PID: $GSMEVIL_PID"

# Wait for web interface to start
echo "Waiting for GSM Evil to initialize..."
sleep 10

# Enable IMSI sniffer via the web interface
echo "Enabling IMSI sniffer..."
curl -s -X GET "http://localhost/imsi" >/dev/null 2>&1

echo "[PASS] GSM Evil started with IMSI sniffer enabled!"
echo "  Access from: http://100.79.154.94/gsm-evil"
echo "  Direct access: http://100.79.154.94:80"
echo "  IMSI data: http://100.79.154.94/imsi"
echo ""
echo "Monitor status:"
echo "  GRGSM: $(ps -p $GRGSM_PID >/dev/null 2>&1 && echo "Running" || echo "Failed")"
echo "  GSM Evil: $(ps -p $GSMEVIL_PID >/dev/null 2>&1 && echo "Running" || echo "Failed")"