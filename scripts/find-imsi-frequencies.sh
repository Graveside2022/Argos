#!/bin/bash

echo "Scanning for frequencies with IMSI potential..."
echo "Looking for CCCH (Control Channel) traffic..."
echo "================================================"

# Frequencies to test
frequencies=(947.2 948.6 949.0 950.0 951.0 952.0 953.0 954.0 955.0 956.0 957.6 958.0 959.0)

for freq in "${frequencies[@]}"; do
    echo -e "\nTesting $freq MHz..."
    
    # Start grgsm
    sudo grgsm_livemon_headless -f ${freq}M -g 35 >/dev/null 2>&1 &
    GRGSM_PID=$!
    
    # Let it stabilize
    sleep 3
    
    # Count packets
    TOTAL=$(sudo timeout 2 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l)
    
    # Count CCCH packets specifically
    CCCH=$(sudo timeout 3 tshark -i lo -f "port 4729" -Y "gsmtap.chan_type == 2" 2>/dev/null | wc -l)
    
    # Count paging requests
    PAGING=$(sudo timeout 3 tshark -i lo -f "port 4729" -Y "gsm_a.dtap.msg_rr_type == 0x21" 2>/dev/null | wc -l)
    
    # Kill grgsm
    sudo kill $GRGSM_PID 2>/dev/null
    sudo pkill -f "grgsm_livemon" 2>/dev/null
    
    if [ $CCCH -gt 0 ]; then
        echo "[PASS] $freq MHz: ACTIVE - Total: $TOTAL pkts, CCCH: $CCCH, Paging: $PAGING"
        echo "  ^ Good for IMSI capture!"
    elif [ $TOTAL -gt 0 ]; then
        echo "[FAIL] $freq MHz: Broadcast only - Total: $TOTAL pkts, No CCCH"
    else
        echo "[FAIL] $freq MHz: No activity detected"
    fi
    
    sleep 1
done

echo -e "\n================================================"
echo "Recommendation: Use frequencies marked with [PASS] for IMSI capture"