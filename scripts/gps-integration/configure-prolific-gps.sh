#!/bin/bash

# Configure Prolific USB GPS Adapter for GPSD and Kismet
# This script sets up the complete GPS data flow chain

echo "=== Prolific USB GPS Configuration Script ==="
echo "Setting up: Prolific USB → GPSD → Kismet → Web Interfaces"
echo ""

# Step 1: Identify the Prolific USB device
echo "Step 1: Identifying Prolific USB device..."
PROLIFIC_DEVICE=$(ls /dev/ttyUSB* 2>/dev/null | head -1)
if [ -z "$PROLIFIC_DEVICE" ]; then
    # Try ACM devices as fallback
    PROLIFIC_DEVICE=$(ls /dev/ttyACM* 2>/dev/null | head -1)
fi

if [ -z "$PROLIFIC_DEVICE" ]; then
    echo "[ERROR] ERROR: No USB serial device found!"
    echo "Please ensure the Prolific GPS adapter is connected."
    lsusb | grep -i prolific
    exit 1
fi

echo "[PASS] Found device: $PROLIFIC_DEVICE"

# Step 2: Test if device is readable and outputting NMEA data
echo ""
echo "Step 2: Testing GPS device for NMEA data..."
echo "Attempting to read from $PROLIFIC_DEVICE (5 second test)..."

if sudo timeout 5 cat "$PROLIFIC_DEVICE" 2>/dev/null | head -5 | grep -q '$GP'; then
    echo "[PASS] GPS device is outputting NMEA data!"
    sudo timeout 2 cat "$PROLIFIC_DEVICE" 2>/dev/null | head -5
else
    echo "[WARN]  No NMEA data detected. GPS may need clear sky view or time to acquire satellites."
fi

# Step 3: Configure GPSD with the device
echo ""
echo "Step 3: Configuring GPSD..."

# Backup current config
sudo cp /etc/default/gpsd /etc/default/gpsd.backup.$(date +%Y%m%d_%H%M%S)

# Write new GPSD configuration
sudo tee /etc/default/gpsd > /dev/null << EOF
# Devices gpsd should collect to at boot time.
# They need to be read/writeable, either by user gpsd or the group dialout.
DEVICES="$PROLIFIC_DEVICE"

# Other options you want to pass to gpsd
# -n = Don't wait for client to connect, start reading GPS immediately
GPSD_OPTIONS="-n"

# Automatically hot add/remove USB GPS devices via gpsdctl
USBAUTO="true"

# Start daemon automatically
START_DAEMON="true"

# Socket for communication
GPSD_SOCKET="/var/run/gpsd.sock"
EOF

echo "[PASS] GPSD configured with device: $PROLIFIC_DEVICE"

# Step 4: Set permissions for GPS device
echo ""
echo "Step 4: Setting device permissions..."
sudo chmod 666 "$PROLIFIC_DEVICE" 2>/dev/null
sudo usermod -a -G dialout gpsd 2>/dev/null
sudo usermod -a -G dialout $USER 2>/dev/null
echo "[PASS] Permissions set"

# Step 5: Enable GPSD services at boot
echo ""
echo "Step 5: Enabling GPSD auto-start at boot..."
sudo systemctl enable gpsd.socket
sudo systemctl enable gpsd.service
echo "[PASS] GPSD will start automatically at boot"

# Step 6: Restart GPSD with new configuration
echo ""
echo "Step 6: Restarting GPSD service..."
sudo systemctl stop gpsd.socket gpsd.service
sleep 2
sudo systemctl start gpsd.socket gpsd.service
sleep 3
echo "[PASS] GPSD restarted"

# Step 7: Configure Kismet for GPS
echo ""
echo "Step 7: Configuring Kismet GPS integration..."

# Create Kismet site configuration
sudo tee /etc/kismet/kismet_site.conf > /dev/null << 'EOF'
# Argos GPS Configuration - Auto-configured for Prolific USB GPS
# This file is loaded after kismet.conf and overrides settings

# Enable GPS support
gps=gpsd

# Use gpsd for GPS data
gpstype=gpsd

# Connect to local gpsd
gpshost=localhost:2947

# Reconnect to gpsd if connection is lost
gpsreconnect=true

# Log GPS track
gps_log=true

# Set GPS accuracy requirements (in meters)
gps_accuracy=10

# Poll GPS every second for updates
gps_poll_interval=1
EOF

echo "[PASS] Kismet GPS configuration created"

# Step 8: Test GPS data flow
echo ""
echo "Step 8: Testing GPS data flow..."
echo "Waiting for GPS fix (10 seconds)..."

if timeout 10 gpspipe -w -n 5 2>/dev/null | grep -q '"lat"'; then
    echo "[PASS] GPS is providing location data!"
    echo ""
    echo "Current GPS Status:"
    timeout 2 gpspipe -w -n 1 2>/dev/null | python3 -m json.tool 2>/dev/null | grep -E '"lat"|"lon"|"satellites_used"' | head -6
else
    echo "[WARN]  No GPS fix yet. This is normal indoors or without clear sky view."
    echo "The GPS will continue trying to acquire satellites."
fi

# Step 9: Create systemd service for GPS device persistence
echo ""
echo "Step 9: Creating GPS device persistence service..."

sudo tee /etc/systemd/system/gps-device-setup.service > /dev/null << EOF
[Unit]
Description=GPS Device Setup for Prolific Adapter
After=multi-user.target
Before=gpsd.service

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'if [ -e $PROLIFIC_DEVICE ]; then chmod 666 $PROLIFIC_DEVICE; fi'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable gps-device-setup.service
echo "[PASS] GPS device setup service created and enabled"

# Step 10: Final status check
echo ""
echo "=== Configuration Complete ==="
echo ""
echo "STATUS CHECK:"
echo "-------------"

# Check GPSD
if systemctl is-active --quiet gpsd.service; then
    echo "[PASS] GPSD: Running"
else
    echo "[ERROR] GPSD: Not running"
fi

# Check if GPSD has the device
if timeout 2 gpsctl 2>&1 | grep -q "$PROLIFIC_DEVICE"; then
    echo "[PASS] GPSD: Has device $PROLIFIC_DEVICE"
else
    echo "[WARN]  GPSD: Device not yet recognized (may need time)"
fi

# Check Kismet config
if [ -f /etc/kismet/kismet_site.conf ]; then
    echo "[PASS] Kismet: GPS configured"
else
    echo "[ERROR] Kismet: GPS not configured"
fi

# Check boot persistence
if systemctl is-enabled --quiet gpsd.service; then
    echo "[PASS] Boot: GPSD will auto-start"
else
    echo "[ERROR] Boot: GPSD won't auto-start"
fi

echo ""
echo "DATA FLOW CHAIN:"
echo "Prolific USB ($PROLIFIC_DEVICE) → GPSD (port 2947) → Kismet → Web UIs"
echo ""
echo "NEXT STEPS:"
echo "1. Ensure GPS has clear sky view for satellite acquisition"
echo "2. Start Kismet - it will automatically connect to GPSD"
echo "3. GPS data will appear in both web interfaces once satellites are acquired"
echo ""
echo "TEST COMMANDS:"
echo "  Check GPS status:  gpsmon"
echo "  View raw NMEA:     sudo cat $PROLIFIC_DEVICE"
echo "  Test GPSD data:    gpspipe -w -n 5"
echo "  View in Kismet:    Start Kismet and check the GPS indicator"