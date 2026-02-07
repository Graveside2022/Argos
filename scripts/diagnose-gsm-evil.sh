#!/bin/bash

echo "GSM Evil Diagnostic Tool"
echo "========================"
echo ""

# Check if grgsm_livemon is running
echo "1. Checking grgsm_livemon process..."
if pgrep -f grgsm_livemon > /dev/null; then
    echo "   [PASS] grgsm_livemon is running"
    FREQ=$(ps aux | grep -E "grgsm_livemon.*-f" | grep -v grep | sed -n 's/.*-f \([0-9.]*\).*/\1/p')
    echo "   Current frequency: $FREQ"
else
    echo "   [FAIL] grgsm_livemon is NOT running"
fi
echo ""

# Check GSMTAP interface
echo "2. Checking GSMTAP interface..."
GSMTAP_PACKETS=$(sudo timeout 2 tcpdump -i lo -c 10 port 4729 2>&1 | grep -c "127.0.0.1.4729")
if [ $GSMTAP_PACKETS -gt 0 ]; then
    echo "   [PASS] GSMTAP packets detected on localhost:4729"
    echo "   Packets in 2 seconds: $GSMTAP_PACKETS"
else
    echo "   [FAIL] No GSMTAP packets detected"
fi
echo ""

# Check for specific GSM message types
echo "3. Analyzing GSM message types (5-second sample)..."
echo "   Capturing packets..."

# Use tshark to capture and analyze
TEMP_FILE="/tmp/gsm_capture_$$.txt"
sudo timeout 5 tshark -i lo -f "port 4729" -Y "gsmtap" -T fields \
    -e frame.number \
    -e gsmtap.chan_type \
    -e gsm_a.dtap.msg_rr_type \
    -e gsm_a.imsi \
    -e gsm_a.tmsi \
    -e gsm_a.dtap.msg_mm_type \
    2>/dev/null > $TEMP_FILE

TOTAL_PACKETS=$(wc -l < $TEMP_FILE)
echo "   Total GSMTAP packets: $TOTAL_PACKETS"

# Count different message types
PAGING_COUNT=$(awk -F'\t' '$3 == "33" {count++} END {print count+0}' $TEMP_FILE)
SYSINFO_COUNT=$(awk -F'\t' '$3 ~ /^(25|26|27|28)$/ {count++} END {print count+0}' $TEMP_FILE)
IMSI_COUNT=$(awk -F'\t' '$4 != "" {count++} END {print count+0}' $TEMP_FILE)
TMSI_COUNT=$(awk -F'\t' '$5 != "" {count++} END {print count+0}' $TEMP_FILE)

echo "   Paging requests: $PAGING_COUNT"
echo "   System Info messages: $SYSINFO_COUNT"
echo "   Packets with IMSI: $IMSI_COUNT"
echo "   Packets with TMSI: $TMSI_COUNT"

# Show sample IMSIs if any
if [ $IMSI_COUNT -gt 0 ]; then
    echo ""
    echo "   Sample IMSIs found:"
    awk -F'\t' '$4 != "" {print "   - " $4}' $TEMP_FILE | head -5
fi

rm -f $TEMP_FILE
echo ""

# Check channel types distribution
echo "4. Channel type distribution..."
sudo timeout 3 tshark -i lo -f "port 4729" -T fields -e gsmtap.chan_type 2>/dev/null | \
    sort | uniq -c | sort -nr | head -10 | \
    awk '{
        chan_name = "Unknown"
        if ($2 == 1) chan_name = "CCCH (Control)"
        else if ($2 == 2) chan_name = "BCCH (Broadcast)"
        else if ($2 == 7) chan_name = "PDCH (Packet Data)"
        else if ($2 == 8) chan_name = "PTCCH"
        else if ($2 == 135) chan_name = "SDCCH8"
        else if ($2 == 136) chan_name = "CCCH+SDCCH4"
        printf "   Type %3d (%s): %d packets\n", $2, chan_name, $1
    }'
echo ""

# Check for Identity Requests
echo "5. Checking for Identity Requests/Responses..."
IDENTITY_REQ=$(sudo timeout 3 tshark -i lo -f "port 4729" -Y "gsm_a.dtap.msg_mm_type == 0x18" 2>/dev/null | wc -l)
IDENTITY_RESP=$(sudo timeout 3 tshark -i lo -f "port 4729" -Y "gsm_a.dtap.msg_mm_type == 0x19" 2>/dev/null | wc -l)
echo "   Identity Requests: $IDENTITY_REQ"
echo "   Identity Responses: $IDENTITY_RESP"
echo ""

# Recommendations
echo "6. Recommendations:"
echo "   Based on the analysis:"

if [ $TOTAL_PACKETS -eq 0 ]; then
    echo "   [FAIL] No GSM packets detected - check if grgsm_livemon is running"
    echo "   [FAIL] Try different frequencies or check your antenna"
elif [ $IMSI_COUNT -eq 0 ]; then
    echo "   [WARN] GSM traffic detected but no IMSIs captured"
    echo "   - This is normal if no phones are actively connecting"
    echo "   - Try during busy hours when phones are more active"
    echo "   - Consider trying different frequencies"
    echo "   - Identity Requests are needed to capture IMSIs"
    
    if [ $PAGING_COUNT -gt 0 ]; then
        echo "   [PASS] Paging requests detected - the channel is active"
    fi
else
    echo "   [PASS] System is working correctly - IMSIs are being captured"
fi

echo ""
echo "To capture IMSIs, phones must:"
echo "  1. Be in range of the monitored cell tower"
echo "  2. Perform network operations (calls, SMS, location updates)"
echo "  3. Respond to paging requests or perform initial registration"
echo ""
echo "Try these frequencies (strongest in your area):"
echo "  - 947.2 MHz"
echo "  - 948.6 MHz"
echo "  - 949.0 MHz"
echo "  - 957.6 MHz"