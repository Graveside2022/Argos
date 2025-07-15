#!/bin/bash

# Kill existing
sudo pkill -f grgsm_livemon 2>/dev/null
sudo pkill -f GsmEvil 2>/dev/null
sudo fuser -k 80/tcp 2>/dev/null
sleep 2

# Start monitor
sudo grgsm_livemon_headless -f 947.2M -g 45 >/dev/null 2>&1 &
echo $! | sudo tee /tmp/grgsm.pid >/dev/null

sleep 3

# Start GSM Evil - using subshell to handle directory change
(cd /usr/src/gsmevil2 && sudo python3 GsmEvil.py >/dev/null 2>&1) &
echo $! | sudo tee /tmp/gsmevil.pid >/dev/null

echo "GSM Evil started"