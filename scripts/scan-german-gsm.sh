#!/bin/bash
# Scan for GSM frequencies commonly used in Germany

echo "=== Scanning German GSM Frequencies with USRP B205 Mini ==="
echo

# Check for USRP
if ! uhd_find_devices 2>/dev/null | grep -q "B205"; then
    echo "Warning: No USRP B205 Mini detected. Trying anyway..."
fi

# German operators typically use these frequencies
# T-Mobile Germany: 935.2-944.8 MHz (GSM900)
# Vodafone Germany: 945.0-954.6 MHz (GSM900)  
# O2 Germany: 954.8-959.8 MHz (GSM900)

FREQUENCIES=(
    # T-Mobile band
    "935.2" "936.0" "937.8" "939.6" "941.4" "943.2"
    # Vodafone band  
    "945.0" "946.8" "948.6" "950.4" "952.2" "954.0"
    # O2 band
    "954.8" "956.6" "958.4" "959.8"
    # Some GSM1800 frequencies
    "1842.4" "1844.2" "1857.4" "1859.2"
)

echo "Testing ${#FREQUENCIES[@]} frequencies..."
echo "This will take about $(( ${#FREQUENCIES[@]} * 5 / 60 )) minutes"
echo

ACTIVE_FREQS=()

for FREQ in "${FREQUENCIES[@]}"; do
    echo -n "Testing ${FREQ} MHz: "
    
    # Start grgsm_livemon_headless
    sudo grgsm_livemon_headless --args=type=b200 -f ${FREQ}M -g 60 >/dev/null 2>&1 &
    PID=$!
    
    # Wait for initialization
    sleep 3
    
    # Check if process is running
    if ! ps -p $PID > /dev/null 2>&1; then
        echo "Failed to start"
        continue
    fi
    
    # Capture packets
    PACKETS=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
    
    # Kill process
    sudo kill $PID 2>/dev/null
    wait $PID 2>/dev/null
    
    if [ $PACKETS -gt 10 ]; then
        echo "$PACKETS packets * ACTIVE GSM"
        ACTIVE_FREQS+=("$FREQ MHz: $PACKETS packets")
    elif [ $PACKETS -gt 0 ]; then
        echo "$PACKETS packets (weak)"
    else
        echo "No GSM activity"
    fi
    
    # Small delay between frequencies
    sleep 1
done

echo
echo "=== Summary ==="
if [ ${#ACTIVE_FREQS[@]} -gt 0 ]; then
    echo "Active GSM frequencies found:"
    for FREQ in "${ACTIVE_FREQS[@]}"; do
        echo "  - $FREQ"
    done
else
    echo "No active GSM frequencies found."
    echo
    echo "Possible reasons:"
    echo "1. No GSM coverage in your area (mostly LTE/5G now)"
    echo "2. USRP gain needs adjustment (try 40-70)"
    echo "3. Wrong frequency band for your location"
    echo "4. gr-gsm not properly configured for USRP"
fi

echo
echo "To test a specific frequency manually:"
echo "sudo grgsm_livemon_headless --args=type=b200 -f 947.2M -g 60"
echo "Then in another terminal: sudo tcpdump -i lo -nn port 4729"