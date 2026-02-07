#!/bin/bash
# Quick diagnostic for USRP B205 Mini GSM issues

echo "=== USRP B205 Mini GSM Diagnostic ==="
echo

# 1. Check if USRP is detected
echo "1. Checking for USRP devices..."
uhd_find_devices 2>&1 | head -20
echo

# 2. Test grgsm_livemon_headless with verbose output
echo "2. Testing grgsm_livemon_headless with USRP (verbose)..."
echo "   Command: sudo grgsm_livemon_headless --args=type=b200 -f 947.2M -g 55"
sudo timeout 5 grgsm_livemon_headless --args=type=b200 -f 947.2M -g 55 2>&1 | head -15
echo

# 3. Check if GSMTAP interface is up
echo "3. Checking for GSMTAP packets..."
echo "   Starting grgsm_livemon_headless in background..."
sudo grgsm_livemon_headless --args=type=b200 -f 947.2M -g 55 >/dev/null 2>&1 &
PID=$!
sleep 3

# Check if process is running
if ps -p $PID > /dev/null; then
    echo "   [PASS] Process is running (PID: $PID)"
    
    # Try to capture packets
    echo "   Capturing packets for 5 seconds..."
    PACKETS=$(sudo timeout 5 tcpdump -i lo -nn port 4729 2>&1 | wc -l)
    echo "   Captured: $PACKETS packets"
    
    # Also try tshark if available
    if command -v tshark &> /dev/null; then
        echo "   Using tshark to verify..."
        sudo timeout 3 tshark -i lo -f "port 4729" -c 10 2>&1 | head -10
    fi
else
    echo "   [FAIL] Process failed to start"
    echo "   Checking error output..."
    sudo grgsm_livemon_headless --args=type=b200 -f 947.2M -g 55 2>&1 | head -20
fi

# Kill the background process
sudo kill $PID 2>/dev/null

# 4. Test without USRP args (let it auto-detect)
echo
echo "4. Testing without explicit USRP args..."
sudo timeout 5 grgsm_livemon_headless -f 947.2M -g 55 2>&1 | head -10

# 5. Check available frequencies in your area
echo
echo "5. Suggested GSM frequencies for Germany:"
echo "   GSM900 downlink: 925-960 MHz"
echo "   GSM1800 downlink: 1805-1880 MHz"
echo
echo "   Common frequencies to try:"
echo "   925.2, 927.4, 935.2, 937.8, 942.4, 947.2, 952.6, 957.8 MHz"
echo "   1842.4, 1847.4, 1852.4, 1857.4, 1862.4, 1867.4 MHz"

echo
echo "Diagnostic complete!"