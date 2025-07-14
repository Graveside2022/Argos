#!/bin/bash

echo "Configuring Kismet to use GPS automatically..."

# Backup original kismet.conf if not already backed up
if [ ! -f /etc/kismet/kismet.conf.original ]; then
    sudo cp /etc/kismet/kismet.conf /etc/kismet/kismet.conf.original
fi

# Create a local override config for GPS
sudo tee /etc/kismet/kismet_site.conf > /dev/null << 'EOF'
# Argos GPS Configuration for BU-353N5
# This file is loaded after kismet.conf and overrides settings

# Enable GPS support
gps=true

# Use gpsd for GPS data
gpstype=gpsd

# Connect to local gpsd
gpshost=localhost:2947

# Reconnect to gpsd if connection is lost
gpsreconnect=true

# Log GPS track
gps_log=true

# Set GPS accuracy requirements (in meters)
# Only log GPS data if accuracy is better than this
gps_accuracy=10

# Auto-add WiFi source on startup
# wlx00c0caadcedb with mt76x2u driver
source=wlx00c0caadcedb:type=linuxwifi

# Optional: Set hop rate for channel scanning (packets/sec)
# Lower values = more time per channel
# Higher values = faster scanning but might miss packets
#chanhop_rate=5/sec

# Optional: Lock to specific channels
# Example: only scan 2.4GHz channels 1,6,11
#source=wlx00c0caadcedb:type=linuxwifi,channels="1,6,11"

# Enable beaconing/active scanning (if legal in your area)
# dot11_active_scanning=true
EOF

echo "GPS configuration added to /etc/kismet/kismet_site.conf"
echo ""
echo "Testing configuration..."

# Check if Kismet can parse the config
if sudo kismet --check-config 2>&1 | grep -q "ERROR"; then
    echo "⚠️  Configuration error detected!"
    sudo kismet --check-config 2>&1 | grep "ERROR"
else
    echo "✓ Configuration is valid"
fi

echo ""
echo "GPS integration complete!"
echo "When Kismet starts, it will automatically:"
echo "  - Connect to gpsd for GPS data"
echo "  - Enable source wlx00c0caadcedb"
echo "  - Log GPS tracks with captured data"