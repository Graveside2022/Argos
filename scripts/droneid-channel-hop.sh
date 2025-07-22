#!/bin/bash
# Channel hopping script for Remote ID detection
# Cycles through common Remote ID channels

INTERFACE="wlx00c0cab684ad"
# Remote ID commonly uses channels 1, 6, 11 (2.4 GHz) and can also use 5 GHz
CHANNELS=(1 6 11)
DWELL_TIME=10  # seconds per channel

echo "Starting channel hopping on $INTERFACE"
echo "Channels: ${CHANNELS[@]}"
echo "Dwell time: $DWELL_TIME seconds per channel"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Main channel hopping loop
while true; do
    for channel in "${CHANNELS[@]}"; do
        echo "[$(date)] Switching to channel $channel"
        
        # Change channel
        iw dev $INTERFACE set channel $channel 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "[$(date)] Successfully switched to channel $channel"
        else
            echo "[$(date)] Failed to switch to channel $channel, retrying..."
            # Try bringing interface down and up
            ip link set $INTERFACE down
            sleep 0.5
            iw dev $INTERFACE set channel $channel
            ip link set $INTERFACE up
        fi
        
        # Dwell on this channel
        sleep $DWELL_TIME
    done
done