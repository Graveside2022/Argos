#!/bin/bash
# Debug script for USRP B205 Mini GSM scanning

echo "=== USRP B205 Mini GSM Debug Tool ==="
echo

# Check if USRP is detected
echo "1. Checking for USRP B205 Mini..."
if uhd_find_devices 2>/dev/null | grep -q "B205"; then
    echo "✓ USRP B205 Mini detected!"
    uhd_find_devices 2>&1 | grep -A5 "B205"
else
    echo "✗ No USRP B205 Mini found"
    exit 1
fi

echo
echo "2. Testing grgsm_livemon_headless with USRP..."

# Test frequencies
FREQS=("935.2" "944.0" "947.2" "949.0" "957.6")
GAINS=(40 45 50 55 60)

for gain in "${GAINS[@]}"; do
    echo
    echo "=== Testing with gain: $gain ==="
    
    for freq in "${FREQS[@]}"; do
        echo
        echo "Testing $freq MHz with gain $gain..."
        
        # Start grgsm_livemon_headless
        sudo grgsm_livemon_headless --args="type=b200" -f ${freq}M -g $gain >/dev/null 2>&1 &
        PID=$!
        
        # Wait for initialization
        sleep 4
        
        # Check if process is still running
        if ! ps -p $PID > /dev/null; then
            echo "✗ grgsm_livemon_headless failed to start"
            continue
        fi
        
        # Count packets for 5 seconds
        echo -n "Capturing frames for 5 seconds..."
        PACKETS=$(sudo timeout 5 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
        echo " Got $PACKETS frames"
        
        # Kill the process
        sudo kill $PID 2>/dev/null
        wait $PID 2>/dev/null
        
        # If we got good results, note it
        if [ $PACKETS -gt 50 ]; then
            echo "★ GOOD RESULT: $freq MHz with gain $gain = $PACKETS frames"
        fi
    done
done

echo
echo "3. Testing direct GSMTAP capture..."
echo "Starting grgsm_livemon_headless on 947.2 MHz with gain 50..."
sudo grgsm_livemon_headless --args="type=b200" -f 947.2M -g 50 &
PID=$!

sleep 4

echo "Monitoring GSMTAP packets (press Ctrl+C to stop):"
sudo tcpdump -i lo -nn -c 20 port 4729 2>/dev/null | head -20

sudo kill $PID 2>/dev/null
wait $PID 2>/dev/null

echo
echo "Debug complete!"