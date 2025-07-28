#!/bin/bash
echo "=== DEBUGGING SCANNER DISCONNECT ==="

echo "1. Testing direct grgsm_livemon_headless command (what worked):"
echo "Command: grgsm_livemon_headless --args='type=b200' -s 2e6 -f 947.4M -g 70"

# Start the exact same command that worked
timeout 10 grgsm_livemon_headless --args="type=b200" -s 2e6 -f 947.4M -g 70 &
GSM_PID=$!
echo "GSM PID: $GSM_PID"

sleep 5

echo "2. Count frames with direct command:"
FRAME_COUNT_DIRECT=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
echo "Direct method frame count: $FRAME_COUNT_DIRECT"

sudo kill $GSM_PID 2>/dev/null
sleep 2

echo ""
echo "3. Testing wrapper script (what the web scanner uses):"
echo "Checking if wrapper exists and is executable:"
ls -la /home/ubuntu/projects/Argos/scripts/grgsm_livemon_wrapper

if [ -x "/home/ubuntu/projects/Argos/scripts/grgsm_livemon_wrapper" ]; then
    echo "✓ Wrapper script is executable"
    
    echo "Testing wrapper command:"
    echo "sudo /home/ubuntu/projects/Argos/scripts/grgsm_livemon_wrapper --args='type=b200' -s 2e6 -f 947.4M -g 70"
    
    sudo /home/ubuntu/projects/Argos/scripts/grgsm_livemon_wrapper --args="type=b200" -s 2e6 -f 947.4M -g 70 &
    WRAPPER_PID=$!
    
    sleep 5
    
    FRAME_COUNT_WRAPPER=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
    echo "Wrapper method frame count: $FRAME_COUNT_WRAPPER"
    
    sudo kill $WRAPPER_PID 2>/dev/null
else
    echo "✗ Wrapper script not executable or missing"
fi

echo ""
echo "4. Summary:"
echo "Direct grgsm_livemon_headless: $FRAME_COUNT_DIRECT frames"
echo "Wrapper script: $FRAME_COUNT_WRAPPER frames"

if [ "$FRAME_COUNT_DIRECT" -gt 50 ] && [ "$FRAME_COUNT_WRAPPER" -lt 10 ]; then
    echo "⚠ PROBLEM: Wrapper script is not working properly"
    echo "The web scanner uses the wrapper, but direct command works fine"
    echo "Need to fix the wrapper script"
elif [ "$FRAME_COUNT_DIRECT" -lt 10 ]; then
    echo "⚠ PROBLEM: GSM signal may be intermittent"
    echo "Try different times or check antenna connection"
else
    echo "✓ Both methods working similarly"
fi