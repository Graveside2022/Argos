#!/bin/bash

echo "=== GSM Evil Complete Fix and Start Script ==="

# Default to strongest frequencies found in scan
FREQ=${1:-947.2}
GAIN=${2:-45}

echo "1. Stopping all GSM Evil related processes..."
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f gsm_evil 2>/dev/null
sudo pkill -f gsmevil 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null
sleep 2

echo "2. Clearing port 80..."
sudo fuser -k 80/tcp 2>/dev/null
sleep 1

echo "3. Starting grgsm_livemon_headless on ${FREQ} MHz..."
sudo grgsm_livemon_headless -f ${FREQ}M -g ${GAIN} &
GRGSM_PID=$!
echo "   PID: $GRGSM_PID"

echo "4. Waiting for grgsm initialization..."
sleep 5

echo "5. Starting GSM Evil..."
cd /usr/src/gsm-evil-2
sudo su -c "source venv/bin/activate && python3.8 gsm_evil.py" &
GSMEVIL_PID=$!
echo "   PID: $GSMEVIL_PID"

# Save PIDs
echo $GRGSM_PID | sudo tee /tmp/grgsm.pid
echo $GSMEVIL_PID | sudo tee /tmp/gsmevil.pid

sleep 3

echo ""
echo "=== GSM Evil Started! ==="
echo "Frequency: ${FREQ} MHz"
echo "Gain: ${GAIN} dB"
echo ""
echo "Now go to: http://100.79.154.94/gsm-evil"
echo "Click the gear icon and select 'IMSI'"
echo ""
echo "Strong frequencies in your area:"
echo "  947.2 MHz"
echo "  948.0 MHz"
echo "  948.6 MHz (your original)"
echo "  949.0 MHz"
echo "  956.8 MHz"
echo "  957.6 MHz"
echo ""
echo "If no traffic, try: $0 <different_freq> <gain>"
echo "Example: $0 957.6 50"