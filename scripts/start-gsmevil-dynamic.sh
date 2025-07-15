#!/bin/bash

# GSM Evil Dynamic Start Script
# Cycles through active frequencies or uses specified frequency

echo "=== GSM Evil Dynamic Starter ==="

# Default frequencies based on scan results (strongest signals found)
FREQ_LIST=(947.2 948.0 948.6 949.0 956.8 957.6 958.4)
DEFAULT_FREQ=${1:-${FREQ_LIST[0]}}
GAIN=${2:-40}

# Check if user provided frequency
if [ $# -ge 1 ]; then
    echo "Using user-specified frequency: ${DEFAULT_FREQ} MHz"
else
    echo "Available strong frequencies detected:"
    for i in "${!FREQ_LIST[@]}"; do
        echo "  $i: ${FREQ_LIST[$i]} MHz"
    done
    echo ""
    echo "Using default frequency: ${DEFAULT_FREQ} MHz"
    echo "To use a different frequency: $0 <frequency> [gain]"
    echo "Example: $0 957.6 45"
fi

# Kill any existing GSM Evil processes
echo "Stopping any existing GSM Evil processes..."
pkill -f grgsm_livemon
pkill -f gsm_evil
pkill -f gsmevil
sleep 2

# Start grgsm_livemon_headless in background
echo "Starting grgsm_livemon_headless on ${DEFAULT_FREQ} MHz with gain ${GAIN}..."
grgsm_livemon_headless -f ${DEFAULT_FREQ}M -g ${GAIN} &
GRGSM_PID=$!
echo "grgsm_livemon PID: $GRGSM_PID"

# Wait for grgsm to initialize
sleep 5

# Navigate to GSM Evil directory
cd /usr/src/gsm-evil-2 || {
    echo "Error: GSM Evil directory not found!"
    kill $GRGSM_PID 2>/dev/null
    exit 1
}

# Activate virtual environment and start GSM Evil
echo "Starting GSM Evil web interface..."
source venv/bin/activate
python3.8 gsm_evil.py &
GSMEVIL_PID=$!
echo "GSM Evil PID: $GSMEVIL_PID"

# Save PIDs for easy stopping
echo $GRGSM_PID > /tmp/grgsm.pid
echo $GSMEVIL_PID > /tmp/gsmevil.pid

echo ""
echo "=== GSM Evil Started Successfully ==="
echo "Frequency: ${DEFAULT_FREQ} MHz, Gain: ${GAIN} dB"
echo "Web interface: http://localhost:80"
echo "Select 'IMSI' in the web interface to start capturing"
echo ""
echo "To stop: scripts/gsmevil-simple-stop.sh"
echo ""
echo "If you don't see traffic, try these frequencies:"
for freq in "${FREQ_LIST[@]}"; do
    echo "  $0 $freq"
done