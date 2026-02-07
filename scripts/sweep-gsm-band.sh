#!/bin/bash
# Comprehensive GSM band sweep 935-955 MHz

echo "=== GSM Band Sweep 935-955 MHz with USRP B205 Mini ==="
echo

# Check USRP
if ! uhd_find_devices 2>/dev/null | grep -q "B205"; then
    echo "Warning: No USRP B205 Mini detected!"
fi

echo "Starting comprehensive sweep..."
echo "This will test every 1 MHz from 935 to 955 MHz"
echo

RESULTS_FILE="/tmp/gsm_sweep_results.txt"
> $RESULTS_FILE

# Test different gain values to find optimal
GAINS=(30 40 50)
BEST_FREQ=""
BEST_GAIN=0
BEST_PACKETS=0

for GAIN in "${GAINS[@]}"; do
    echo
    echo "=== Testing with gain $GAIN ==="
    
    for FREQ in $(seq 935 1 955); do
        echo -n "Testing ${FREQ}.0 MHz with gain $GAIN: "
        
        # Start grgsm_livemon_headless
        sudo grgsm_livemon_headless -s 2e6 -f ${FREQ}.0M -g $GAIN >/dev/null 2>&1 &
        PID=$!
        
        # Wait for initialization
        sleep 2
        
        # Check if process is running
        if ! ps -p $PID > /dev/null 2>&1; then
            echo "Failed to start"
            continue
        fi
        
        # Capture packets
        PACKETS=$(sudo timeout 2 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
        
        # Kill process
        sudo kill $PID 2>/dev/null
        wait $PID 2>/dev/null
        
        echo "$PACKETS packets"
        
        # Log results
        echo "${FREQ}.0 MHz, Gain $GAIN: $PACKETS packets" >> $RESULTS_FILE
        
        # Track best result
        if [ $PACKETS -gt $BEST_PACKETS ]; then
            BEST_PACKETS=$PACKETS
            BEST_FREQ="${FREQ}.0"
            BEST_GAIN=$GAIN
        fi
        
        # If we found strong signal, test longer
        if [ $PACKETS -gt 10 ]; then
            echo "  * Active frequency! Testing longer..."
            sudo grgsm_livemon_headless -s 2e6 -f ${FREQ}.0M -g $GAIN >/dev/null 2>&1 &
            PID=$!
            sleep 2
            LONG_PACKETS=$(sudo timeout 5 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
            sudo kill $PID 2>/dev/null
            wait $PID 2>/dev/null
            echo "  Extended test: $LONG_PACKETS packets in 5 seconds"
        fi
    done
done

echo
echo "=== SWEEP COMPLETE ==="
echo

if [ $BEST_PACKETS -gt 0 ]; then
    echo "[PASS] GSM activity detected!"
    echo "  Best frequency: $BEST_FREQ MHz"
    echo "  Best gain: $BEST_GAIN"
    echo "  Packets captured: $BEST_PACKETS"
    echo
    echo "Active frequencies (>0 packets):"
    grep -v ": 0 packets" $RESULTS_FILE | sort -t: -k2 -nr | head -10
else
    echo "[FAIL] No GSM activity detected on any frequency"
    echo
    echo "Troubleshooting steps:"
    echo "1. Check antenna is connected to RX port"
    echo "2. Try different times of day (GSM traffic varies)"
    echo "3. Test with higher gains (60-70)"
    echo "4. Check if GSM is actually active in your area"
    echo "5. Try GSM1800 band: 1805-1880 MHz"
fi

echo
echo "Full results saved to: $RESULTS_FILE"