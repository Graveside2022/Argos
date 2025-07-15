#!/bin/bash

echo "=== GSM Evil Working Script ==="

# Use best frequency from scan
FREQ=${1:-947.2}
GAIN=${2:-45}

echo "1. Cleaning up..."
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null
sudo fuser -k 80/tcp 2>/dev/null
sleep 2

echo "2. Starting grgsm_livemon on ${FREQ} MHz..."
sudo grgsm_livemon_headless -f ${FREQ}M -g ${GAIN} &
GRGSM_PID=$!
echo "   grgsm PID: $GRGSM_PID"
sleep 3

echo "3. Starting GSM Evil web interface..."
cd /usr/src/gsmevil2
sudo python3 GsmEvil.py &
GSMEVIL_PID=$!
echo "   GSM Evil PID: $GSMEVIL_PID"

# Save PIDs
echo $GRGSM_PID | sudo tee /tmp/grgsm.pid
echo $GSMEVIL_PID | sudo tee /tmp/gsmevil.pid

echo ""
echo "=== SUCCESS! GSM Evil is running ==="
echo "Frequency: ${FREQ} MHz (strong signal detected)"
echo ""
echo "Now visit: http://100.79.154.94/gsm-evil"
echo "Click the gear icon and select 'IMSI'"
echo ""
echo "Other strong frequencies to try:"
echo "  $0 948.6  (your original)"
echo "  $0 949.0"
echo "  $0 957.6"