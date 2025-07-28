#!/bin/bash
# Simple analysis of 950.0 MHz GSM traffic

echo "Analyzing 950.0 MHz for GSM traffic type..."
echo "=========================================="

# Kill existing processes
sudo pkill -9 grgsm 2>/dev/null
sleep 1

# Try to start grgsm_livemon in background
echo "Starting grgsm_livemon_headless..."
sudo grgsm_livemon_headless -f 950M -g 40 > /tmp/grgsm_950.log 2>&1 &
GRGSM_PID=$!
sleep 8

# Check if it's running
if ! ps -p $GRGSM_PID > /dev/null; then
    echo "ERROR: grgsm_livemon_headless failed to start"
    echo "Log contents:"
    cat /tmp/grgsm_950.log
    exit 1
fi

echo "Capturing GSM data for 15 seconds..."

# Capture and analyze in real-time
sudo timeout 15 tshark -i lo -f "port 4729" -T fields \
    -e frame.time \
    -e gsmtap.chan_type \
    -e gsmtap.type \
    -e gsm_a.dtap.msg_rr_type \
    -e gsm_a.imsi 2>/dev/null | \
while read -r line; do
    if [[ ! -z "$line" ]]; then
        # Parse the fields
        IFS=$'\t' read -r timestamp chan_type gsm_type msg_type imsi <<< "$line"
        
        # Report findings
        if [[ "$chan_type" == *"BCCH"* ]]; then
            echo "[BCCH] Broadcast channel at $timestamp"
        elif [[ "$chan_type" == *"CCCH"* ]]; then
            echo "[CCCH] Common control channel at $timestamp - CAN CARRY IMSI"
        elif [[ "$chan_type" == *"SDCCH"* ]]; then
            echo "[SDCCH] Dedicated control channel at $timestamp"
        fi
        
        if [[ ! -z "$imsi" ]]; then
            echo "[*** IMSI FOUND ***] $imsi"
        fi
        
        if [[ "$msg_type" == "0x21" ]]; then
            echo "[PAGING TYPE 1] Detected - may contain IMSI"
        elif [[ "$msg_type" == "0x22" ]]; then
            echo "[PAGING TYPE 2] Detected"
        fi
    fi
done

# Kill grgsm
sudo kill -9 $GRGSM_PID 2>/dev/null

echo ""
echo "Analysis complete."
echo ""
echo "RECOMMENDATIONS:"
echo "1. If mostly BCCH traffic: This is a broadcast-only channel, try nearby frequencies"
echo "2. If CCCH but no IMSI: Network may be using TMSI, or no active paging"
echo "3. If no traffic at all: Check SDR connection and gain settings"