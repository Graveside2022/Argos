#!/bin/bash

# Start GSM Evil with IMSI sniffer enabled

echo "Starting GSM Evil with IMSI sniffer enabled..."

# Kill any existing instances
sudo pkill -f "grgsm_livemon" 2>/dev/null
sudo pkill -f "GsmEvil.py" 2>/dev/null
sleep 2

# Start grgsm_livemon_headless on 949.0 MHz
echo "Starting grgsm_livemon_headless on 949.0 MHz..."
sudo grgsm_livemon_headless -f 949.0M -g 45 &
GRGSM_PID=$!

sleep 3

# Start GSM Evil
echo "Starting GSM Evil..."
cd /usr/src/gsmevil2
sudo bash -c "source venv/bin/activate && python3 GsmEvil.py --host 0.0.0.0 --port 80" &
GSMEVIL_PID=$!

# Wait for GSM Evil to start
echo "Waiting for GSM Evil to start..."
sleep 5

# Enable IMSI sniffer via Python script
cat > /tmp/enable_imsi.py << 'EOF'
import socketio
import time

sio = socketio.Client()

@sio.event
def connect():
    print("Connected, enabling IMSI sniffer...")
    sio.emit('imsi_sniffer', 'on')
    time.sleep(1)
    sio.disconnect()

@sio.on('sniffers')
def on_sniffers(data):
    print(f"Sniffer status: {data}")

try:
    sio.connect('http://localhost')
    time.sleep(2)
except Exception as e:
    print(f"Error: {e}")
EOF

python3 /tmp/enable_imsi.py
rm -f /tmp/enable_imsi.py

echo ""
echo "GSM Evil started with:"
echo "  - Frequency: 949.0 MHz"
echo "  - IMSI sniffer: ENABLED"
echo "  - Web interface: http://localhost/"
echo "  - IMSI page: http://localhost/imsi/"
echo ""
echo "Process PIDs:"
echo "  - grgsm_livemon: $GRGSM_PID"
echo "  - GsmEvil: $GSMEVIL_PID"
echo ""
echo "To monitor live IMSIs: python3 monitor_imsi_live.py"
echo "To stop: sudo pkill -f grgsm_livemon && sudo pkill -f GsmEvil"