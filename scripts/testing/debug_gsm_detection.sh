#!/bin/bash
echo "=== DEBUGGING GSM FRAME DETECTION ==="

echo "1. Testing if grgsm_livemon_headless is running correctly:"
echo "Starting grgsm_livemon_headless with USRP args..."

# Start grgsm with USRP
sudo /home/ubuntu/projects/Argos/scripts/grgsm_livemon_wrapper --args="type=b200" -s 2e6 -f 946M -g 50 &
GSM_PID=$!
echo "GSM process PID: $GSM_PID"

sleep 3

echo "2. Checking if GSMTAP port is active:"
netstat -un | grep 4729

echo "3. Monitoring GSMTAP traffic for 5 seconds..."
sudo timeout 5 tcpdump -i lo -nn port 4729 -c 10 2>/dev/null | wc -l

echo "4. Checking if process is still running:"
ps aux | grep grgsm | grep -v grep

echo "5. Killing GSM process:"
sudo kill $GSM_PID 2>/dev/null

echo "6. Testing with different frequency (947.4 MHz - common GSM):"
sudo /home/ubuntu/projects/Argos/scripts/grgsm_livemon_wrapper --args="type=b200" -s 2e6 -f 947.4M -g 70 &
GSM_PID2=$!
sleep 3

echo "Checking for frames at 947.4 MHz:"
sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l

sudo kill $GSM_PID2 2>/dev/null

echo "=== DEBUG COMPLETE ==="