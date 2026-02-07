#!/bin/bash

# GSM Frequency Scanner and Monitor
# Based on the YouTube video workflow

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== GSM Frequency Scanner and Monitor ===${NC}"
echo "This script helps you find and monitor active GSM frequencies"
echo

# Function to scan a band
scan_band() {
    local band=$1
    echo -e "${YELLOW}Scanning $band band...${NC}"
    /home/ubuntu/projects/Argos/tools/kalibrate-hackrf/src/kal -s $band -g 40 2>/dev/null | grep -E "chan:.*MHz.*power:" | sort -k5 -nr || true
}

# Function to get frequency from channel
get_frequency() {
    local band=$1
    local channel=$2
    
    case $band in
        GSM900)
            # Uplink: 890-915 MHz, Downlink: 935-960 MHz
            # Channel 0-124, spacing 200 kHz
            freq=$(echo "935 + $channel * 0.2" | bc)
            ;;
        DCS1800)
            # Uplink: 1710-1785 MHz, Downlink: 1805-1880 MHz
            # Channel 512-885, spacing 200 kHz
            freq=$(echo "1805.2 + ($channel - 512) * 0.2" | bc)
            ;;
        GSM850)
            # Uplink: 824-849 MHz, Downlink: 869-894 MHz
            # Channel 128-251, spacing 200 kHz
            freq=$(echo "869.2 + ($channel - 128) * 0.2" | bc)
            ;;
        PCS1900)
            # Uplink: 1850-1910 MHz, Downlink: 1930-1990 MHz
            # Channel 512-810, spacing 200 kHz
            freq=$(echo "1930.2 + ($channel - 512) * 0.2" | bc)
            ;;
    esac
    
    echo "${freq}e6"
}

# Main menu
while true; do
    echo
    echo "Select GSM band to scan:"
    echo "1) GSM900 (935-960 MHz) - Most common in Europe/Asia/Africa"
    echo "2) DCS1800 (1805-1880 MHz) - Common in Europe/Asia"
    echo "3) GSM850 (869-894 MHz) - Common in Americas"
    echo "4) PCS1900 (1930-1990 MHz) - Common in Americas"
    echo "5) Scan all bands"
    echo "6) Manual frequency entry"
    echo "7) Exit"
    
    read -p "Enter choice [1-7]: " choice
    
    case $choice in
        1)
            BAND="GSM900"
            RESULTS=$(scan_band $BAND)
            ;;
        2)
            BAND="DCS1800"
            RESULTS=$(scan_band $BAND)
            ;;
        3)
            BAND="GSM850"
            RESULTS=$(scan_band $BAND)
            ;;
        4)
            BAND="PCS1900"
            RESULTS=$(scan_band $BAND)
            ;;
        5)
            echo -e "${BLUE}Scanning all bands (this will take a few minutes)...${NC}"
            echo -e "\n${YELLOW}GSM900:${NC}"
            scan_band GSM900
            echo -e "\n${YELLOW}DCS1800:${NC}"
            scan_band DCS1800
            echo -e "\n${YELLOW}GSM850:${NC}"
            scan_band GSM850
            echo -e "\n${YELLOW}PCS1900:${NC}"
            scan_band PCS1900
            continue
            ;;
        6)
            read -p "Enter frequency in MHz (e.g., 948.6): " MANUAL_FREQ
            FREQ="${MANUAL_FREQ}e6"
            break
            ;;
        7)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            continue
            ;;
    esac
    
    if [ ! -z "$RESULTS" ]; then
        echo -e "\n${GREEN}Found channels:${NC}"
        echo "$RESULTS"
        echo
        
        # Get strongest channel
        STRONGEST=$(echo "$RESULTS" | head -1)
        CHANNEL=$(echo "$STRONGEST" | grep -oP 'chan:\s*\K\d+')
        FREQ_MHZ=$(echo "$STRONGEST" | grep -oP '\d+\.\d+MHz' | sed 's/MHz//')
        
        echo -e "${GREEN}Strongest signal:${NC}"
        echo "Channel: $CHANNEL, Frequency: $FREQ_MHZ MHz"
        echo
        
        read -p "Use this frequency? [Y/n]: " use_freq
        if [ "$use_freq" != "n" ] && [ "$use_freq" != "N" ]; then
            FREQ="${FREQ_MHZ}e6"
            break
        else
            read -p "Enter channel number to use: " custom_channel
            FREQ=$(get_frequency $BAND $custom_channel)
            break
        fi
    else
        echo -e "${RED}No channels found in $BAND band${NC}"
    fi
done

# Now start monitoring
echo
echo -e "${BLUE}Starting GSM monitoring on frequency $FREQ${NC}"
echo

# Kill existing processes
pkill -f grgsm_livemon 2>/dev/null || true
pkill -f GsmEvil 2>/dev/null || true
sleep 2

# Start grgsm_livemon_headless
echo "Starting grgsm_livemon_headless..."
echo "Command: grgsm_livemon_headless -f $FREQ -s 2e6 -g 40"
grgsm_livemon_headless -f $FREQ -s 2e6 -g 40 > /tmp/grgsm_monitor.log 2>&1 &
GRGSM_PID=$!

sleep 3
if ps -p $GRGSM_PID > /dev/null; then
    echo -e "${GREEN}[PASS] grgsm_livemon_headless started (PID: $GRGSM_PID)${NC}"
else
    echo -e "${RED}[FAIL] Failed to start grgsm_livemon_headless${NC}"
    cat /tmp/grgsm_monitor.log
    exit 1
fi

# Monitor with Wireshark
echo
echo -e "${YELLOW}To monitor GSM traffic:${NC}"
echo "1. With Wireshark (recommended):"
echo "   sudo wireshark -k -f udp -Y gsmtap -i lo"
echo
echo "2. With tshark (command line):"
echo "   sudo tshark -i lo -f 'udp port 4729' -Y gsmtap"
echo
echo "3. With GSMEvil2 (web interface):"
echo "   Run: /home/ubuntu/projects/Argos/scripts/start-gsmevil2.sh"
echo "   Open: http://localhost:8080"
echo
echo "To stop monitoring: kill $GRGSM_PID"
echo
echo -e "${RED}Important:${NC} Ensure you comply with local laws regarding radio monitoring."