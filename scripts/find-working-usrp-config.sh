#!/bin/bash
# Find a working USRP configuration for GSM

echo "=== Finding Working USRP B205 Mini Configuration ==="
echo

# Test configurations
CONFIGS=(
    "--args=type=b200"
    "--args='type=b200'"
    "--args=\\\"type=b200\\\""
    "--args=addr=192.168.10.2"
    "--args=serial=XXXXXX"
    "--args=type=b200,master_clock_rate=16e6"
    "--args=type=b200,master_clock_rate=30.72e6"
    "--args=type=b200,num_recv_frames=512"
    ""  # No args - let it auto-detect
)

SAMPLE_RATES=(
    ""          # Default
    "-s 2e6"    # 2 MSPS
    "-s 4e6"    # 4 MSPS  
    "-s 1e6"    # 1 MSPS
)

GAINS=(30 40 50 60)

BEST_CONFIG=""
BEST_PACKETS=0

echo "Testing configurations..."
for CONFIG in "${CONFIGS[@]}"; do
    for RATE in "${SAMPLE_RATES[@]}"; do
        for GAIN in "${GAINS[@]}"; do
            echo -n "Testing: $CONFIG $RATE -g $GAIN ... "
            
            # Build command
            if [ -z "$CONFIG" ]; then
                CMD="sudo grgsm_livemon_headless $RATE -f 947.2M -g $GAIN"
            else
                CMD="sudo grgsm_livemon_headless $CONFIG $RATE -f 947.2M -g $GAIN"
            fi
            
            # Start process
            eval "$CMD >/dev/null 2>&1 &"
            PID=$!
            
            # Wait for init
            sleep 3
            
            # Check if running
            if ! ps -p $PID > /dev/null 2>&1; then
                echo "Failed to start"
                continue
            fi
            
            # Capture packets
            PACKETS=$(sudo timeout 2 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
            echo "$PACKETS packets"
            
            # Track best
            if [ $PACKETS -gt $BEST_PACKETS ]; then
                BEST_PACKETS=$PACKETS
                BEST_CONFIG="$CONFIG $RATE -g $GAIN"
            fi
            
            # Kill process
            sudo kill $PID 2>/dev/null
            wait $PID 2>/dev/null
            
            # If we found good config, test more thoroughly
            if [ $PACKETS -gt 10 ]; then
                echo "  * GOOD CONFIG FOUND! Testing longer..."
                eval "$CMD >/dev/null 2>&1 &"
                PID=$!
                sleep 3
                LONG_PACKETS=$(sudo timeout 5 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
                sudo kill $PID 2>/dev/null
                wait $PID 2>/dev/null
                echo "  Extended test: $LONG_PACKETS packets in 5 seconds"
            fi
        done
    done
done

echo
echo "=== RESULTS ==="
if [ $BEST_PACKETS -gt 0 ]; then
    echo "[PASS] Best configuration: $BEST_CONFIG"
    echo "  Captured $BEST_PACKETS packets"
    echo
    echo "Use this command:"
    echo "  sudo grgsm_livemon_headless $BEST_CONFIG -f [FREQ]M"
else
    echo "[FAIL] No working configuration found"
    echo
    echo "Troubleshooting:"
    echo "1. Check antenna is connected to RX port"
    echo "2. Verify USRP B205 Mini is detected: uhd_find_devices"
    echo "3. Try manual command: sudo grgsm_livemon_headless -f 947.2M -g 50"
    echo "4. Check if gr-gsm was built with UHD support"
fi