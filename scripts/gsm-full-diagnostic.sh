#!/bin/bash

echo "=== COMPREHENSIVE GSM DIAGNOSTIC ==="
echo
echo "This will help identify why GSM scanning is only detecting 1 frame"
echo

# 1. Check which SDR device is available
echo "1. Checking available SDR devices..."
echo "   HackRF:"
hackrf_info 2>&1 | grep -E "(Serial|Found|Board)" || echo "   No HackRF detected"
echo
echo "   USRP:"
uhd_find_devices 2>&1 | grep -E "(type|product|serial)" || echo "   No USRP detected"
echo
echo "   RTL-SDR:"
rtl_test -t 2>&1 | head -5 || echo "   No RTL-SDR detected"
echo

# 2. Test with different tools
echo "2. Testing gr-gsm with detected device..."
echo

# Determine which device to use
DEVICE_ARGS=""
if uhd_find_devices 2>&1 | grep -q "B205"; then
    echo "   Using USRP B205 Mini"
    DEVICE_TYPE="USRP"
    # Note: grgsm_livemon_headless ignores these args but we'll try anyway
    DEVICE_ARGS="--args=type=b200"
elif hackrf_info 2>&1 | grep -q "Found"; then
    echo "   Using HackRF"
    DEVICE_TYPE="HackRF"
else
    echo "   Using default (RTL-SDR or auto-detect)"
    DEVICE_TYPE="Unknown"
fi

# 3. Test multiple frequencies with different parameters
echo "3. Testing GSM frequencies..."
echo

# GSM900 and GSM1800 frequencies for Germany/Europe
FREQS_900=(925.2 927.4 930.2 935.2 937.8 940.4 942.4 944.0 947.2 949.0 952.6 955.2 957.8)
FREQS_1800=(1810.2 1815.4 1820.6 1842.4 1847.6 1852.8 1857.4 1862.6 1867.8)

echo "Testing GSM900 band (925-960 MHz)..."
BEST_FREQ=""
BEST_COUNT=0

for freq in "${FREQS_900[@]}"; do
    echo -n "   $freq MHz: "
    
    # Start grgsm_livemon_headless
    sudo grgsm_livemon_headless $DEVICE_ARGS -f ${freq}M -g 50 >/dev/null 2>&1 &
    PID=$!
    
    # Wait for init
    sleep 2
    
    # Check if running
    if ! ps -p $PID > /dev/null 2>&1; then
        echo "Failed to start"
        continue
    fi
    
    # Count packets
    COUNT=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
    echo "$COUNT frames"
    
    if [ $COUNT -gt $BEST_COUNT ]; then
        BEST_COUNT=$COUNT
        BEST_FREQ=$freq
    fi
    
    # Kill process
    sudo kill $PID 2>/dev/null
    sudo kill -9 $PID 2>/dev/null
    wait $PID 2>/dev/null
done

echo
echo "Testing GSM1800 band (1805-1880 MHz)..."
for freq in "${FREQS_1800[@]}"; do
    echo -n "   $freq MHz: "
    
    # Start grgsm_livemon_headless
    sudo grgsm_livemon_headless $DEVICE_ARGS -f ${freq}M -g 50 >/dev/null 2>&1 &
    PID=$!
    
    # Wait for init
    sleep 2
    
    # Check if running
    if ! ps -p $PID > /dev/null 2>&1; then
        echo "Failed to start"
        continue
    fi
    
    # Count packets
    COUNT=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
    echo "$COUNT frames"
    
    if [ $COUNT -gt $BEST_COUNT ]; then
        BEST_COUNT=$COUNT
        BEST_FREQ=$freq
    fi
    
    # Kill process
    sudo kill $PID 2>/dev/null
    sudo kill -9 $PID 2>/dev/null
    wait $PID 2>/dev/null
done

echo
echo "4. Testing with different gain values on best frequency..."
if [ -n "$BEST_FREQ" ]; then
    echo "   Best frequency so far: $BEST_FREQ MHz with $BEST_COUNT frames"
    echo "   Testing gains: 20, 30, 40, 50, 60, 70"
    
    for gain in 20 30 40 50 60 70; do
        echo -n "   Gain $gain: "
        
        sudo grgsm_livemon_headless $DEVICE_ARGS -f ${BEST_FREQ}M -g $gain >/dev/null 2>&1 &
        PID=$!
        sleep 2
        
        if ! ps -p $PID > /dev/null 2>&1; then
            echo "Failed"
            continue
        fi
        
        COUNT=$(sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
        echo "$COUNT frames"
        
        sudo kill $PID 2>/dev/null
        sudo kill -9 $PID 2>/dev/null
        wait $PID 2>/dev/null
    done
else
    echo "   No active frequency found to test gains"
fi

echo
echo "5. Checking for GSM network presence..."
# Use kalibrate if available
if command -v kal &> /dev/null; then
    echo "   Using kalibrate to scan for GSM base stations..."
    echo "   GSM900:"
    sudo timeout 30 kal -s GSM900 -g 50 2>&1 | grep -E "(chan:|FCCH)" | head -10
    echo "   GSM1800:"
    sudo timeout 30 kal -s DCS -g 50 2>&1 | grep -E "(chan:|FCCH)" | head -10
elif [ -f /home/ubuntu/projects/Argos/tools/kalibrate-hackrf/src/kal ]; then
    echo "   Using kalibrate-hackrf..."
    sudo timeout 30 /home/ubuntu/projects/Argos/tools/kalibrate-hackrf/src/kal -s GSM900 -g 50 2>&1 | grep -E "(chan:|FCCH)" | head -10
else
    echo "   Kalibrate not available"
fi

echo
echo "=== DIAGNOSTIC SUMMARY ==="
echo "Device type: $DEVICE_TYPE"
echo "Best frequency: ${BEST_FREQ:-None found} MHz"
echo "Best frame count: $BEST_COUNT"
echo
echo "TROUBLESHOOTING:"
if [ $BEST_COUNT -le 1 ]; then
    echo "[FAIL] Very low or no GSM activity detected"
    echo
    echo "Possible causes:"
    echo "1. No GSM coverage in your area (networks may be shutting down GSM)"
    echo "2. Antenna not connected or wrong antenna port"
    echo "3. Gain too low or too high"
    echo "4. Wrong frequency band for your region"
    echo "5. SDR device issues"
    echo
    echo "Recommendations:"
    echo "- Check antenna connection (use RX2 port on USRP B205 Mini)"
    echo "- Try outdoor location with clear sky view"
    echo "- Test with a phone to confirm GSM network exists"
    echo "- Try 2G/GSM mode on phone and check signal"
    echo "- Consider that many carriers are shutting down 2G/GSM"
else
    echo "[PASS] GSM activity detected!"
    echo "- Best frequency: $BEST_FREQ MHz"
    echo "- Frame count: $BEST_COUNT"
    echo "- Try this frequency in the web UI"
fi