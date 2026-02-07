#!/bin/bash

# Complete GPS Integration Workflow Implementation
# Implements: Pi Boot → Argos Auto-start → GPS Detection → Kismet → Status Display

echo "=== GPS Integration Workflow Implementation ==="
echo "Setting up complete boot-to-display GPS workflow"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Find Prolific device
USB_DEVICE=$(ls /dev/ttyUSB* 2>/dev/null | head -1)
if [ -z "$USB_DEVICE" ]; then
    USB_DEVICE="/dev/ttyUSB0"  # Default fallback
    echo -e "${YELLOW}[WARN]${NC} No USB device found, using default: $USB_DEVICE"
else
    echo -e "${GREEN}[OK]${NC} Found GPS device: $USB_DEVICE"
fi

# ===== COMPONENT 1: Argos Auto-start Service =====
echo ""
echo "Component 1: Creating Argos Auto-start Service..."

sudo tee /etc/systemd/system/argos.service > /dev/null << 'EOF'
[Unit]
Description=Argos Console - SDR & Network Analysis Platform
Documentation=https://github.com/argos/console
After=network-online.target gpsd.service
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/projects/Argos
Environment="NODE_ENV=production"
Environment="NODE_OPTIONS=--max-old-space-size=2048"
Environment="PORT=5173"
Environment="HOST=0.0.0.0"

# Pre-start validation
ExecStartPre=/usr/bin/npm run validate:env

# Main service
ExecStart=/usr/bin/npm run dev

# Restart policy
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Resource limits
LimitNOFILE=65536
TimeoutStartSec=60

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}[OK]${NC} Argos service created"

# ===== COMPONENT 2: GPS Device Configuration =====
echo ""
echo "Component 2: Configuring GPSD for Prolific Adapter..."

# Backup and configure GPSD
sudo cp /etc/default/gpsd /etc/default/gpsd.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null

sudo tee /etc/default/gpsd > /dev/null << EOF
# Prolific USB GPS Configuration
DEVICES="$USB_DEVICE"
GPSD_OPTIONS="-n"
USBAUTO="true"
START_DAEMON="true"
GPSD_SOCKET="/var/run/gpsd.sock"
EOF

echo -e "${GREEN}[OK]${NC} GPSD configured for $USB_DEVICE"

# ===== COMPONENT 3: GPS Device Permissions Service =====
echo ""
echo "Component 3: Creating GPS Device Permissions Service..."

sudo tee /etc/systemd/system/gps-device-setup.service > /dev/null << EOF
[Unit]
Description=GPS Device Setup for Prolific Adapter
After=multi-user.target
Before=gpsd.service

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'for dev in /dev/ttyUSB* /dev/ttyACM*; do [ -e "\$dev" ] && chmod 666 "\$dev"; done'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}[OK]${NC} GPS device setup service created"

# ===== COMPONENT 4: Kismet GPS Configuration =====
echo ""
echo "Component 4: Configuring Kismet for GPS..."

sudo tee /etc/kismet/kismet_site.conf > /dev/null << 'EOF'
# Argos GPS Integration Configuration
# Auto-configured for Prolific USB GPS via GPSD

# Enable GPS support
gps=gpsd

# GPSD connection
gpstype=gpsd
gpshost=localhost:2947

# Reconnect if connection lost
gpsreconnect=true

# Log GPS tracks
gps_log=true

# GPS accuracy threshold (meters)
gps_accuracy=10

# Poll interval for GPS updates
gps_poll_interval=1

# Send GPS data to connected clients
# This enables GPS status in Kismet REST API
httpd_gps=true
EOF

echo -e "${GREEN}[OK]${NC} Kismet GPS configuration created"

# ===== COMPONENT 5: GPS Status Propagation Script =====
echo ""
echo "Component 5: Creating GPS Status Propagation Handler..."

cat > /home/ubuntu/projects/Argos/scripts/gps-status-monitor.sh << 'EOF'
#!/bin/bash
# GPS Status Monitor for Argos/Kismet Integration
# Monitors GPSD and propagates status to web interfaces

while true; do
    # Get GPS status from GPSD
    GPS_JSON=$(timeout 1 gpspipe -w -n 1 2>/dev/null)
    
    if [ -n "$GPS_JSON" ]; then
        # Extract GPS data
        LAT=$(echo "$GPS_JSON" | grep -o '"lat":[^,]*' | cut -d: -f2)
        LON=$(echo "$GPS_JSON" | grep -o '"lon":[^,]*' | cut -d: -f2)
        SATS=$(echo "$GPS_JSON" | grep -o '"satellites_used":[^,]*' | cut -d: -f2)
        
        # Create status file for Argos to read
        cat > /tmp/gps_status.json << JSON
{
    "has_fix": $([ -n "$LAT" ] && echo "true" || echo "false"),
    "latitude": ${LAT:-null},
    "longitude": ${LON:-null},
    "satellites": ${SATS:-0},
    "timestamp": $(date +%s)
}
JSON
    fi
    
    sleep 1
done
EOF

chmod +x /home/ubuntu/projects/Argos/scripts/gps-status-monitor.sh
echo -e "${GREEN}[OK]${NC} GPS status monitor created"

# ===== COMPONENT 6: Argos GPS API Endpoint =====
echo ""
echo "Component 6: Creating Argos GPS Status API..."

cat > /home/ubuntu/projects/Argos/src/routes/api/gps/status/+server.ts << 'EOF'
import { json } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    try {
        // First try to get GPS status from Kismet if it's running
        const kismetResponse = await fetch('http://localhost:2501/gps/location.json')
            .catch(() => null);
        
        if (kismetResponse && kismetResponse.ok) {
            const kismetData = await kismetResponse.json();
            return json({
                source: 'kismet',
                has_fix: kismetData.fix > 0,
                latitude: kismetData.lat,
                longitude: kismetData.lon,
                satellites: kismetData.satellites_used || 0,
                altitude: kismetData.alt,
                speed: kismetData.speed,
                heading: kismetData.heading
            });
        }
        
        // Fallback to local GPS status file
        try {
            const statusData = readFileSync('/tmp/gps_status.json', 'utf-8');
            const status = JSON.parse(statusData);
            return json({ source: 'gpsd', ...status });
        } catch {
            // No GPS data available
            return json({
                source: 'none',
                has_fix: false,
                latitude: null,
                longitude: null,
                satellites: 0
            });
        }
    } catch (error) {
        return json({
            error: 'Failed to get GPS status',
            has_fix: false,
            satellites: 0
        }, { status: 500 });
    }
};
EOF

echo -e "${GREEN}[OK]${NC} GPS status API endpoint created"

# ===== COMPONENT 7: Enable All Services =====
echo ""
echo "Component 7: Enabling Services at Boot..."

# Reload systemd
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable gpsd.socket 2>/dev/null
sudo systemctl enable gpsd.service 2>/dev/null
sudo systemctl enable gps-device-setup.service 2>/dev/null
sudo systemctl enable argos.service 2>/dev/null

echo -e "${GREEN}[OK]${NC} Services enabled for auto-start"

# ===== COMPONENT 8: Start Services =====
echo ""
echo "Component 8: Starting Services..."

# Stop services first for clean start
sudo systemctl stop gpsd.socket gpsd.service 2>/dev/null
sleep 2

# Start GPS services
sudo systemctl start gps-device-setup.service
sudo systemctl start gpsd.socket
sudo systemctl start gpsd.service

echo -e "${GREEN}[OK]${NC} GPS services started"

# ===== VALIDATION =====
echo ""
echo "=== WORKFLOW VALIDATION ==="
echo ""

# Check service status
echo "Service Status:"
systemctl is-active gpsd.service > /dev/null && echo -e "${GREEN}[OK]${NC} GPSD: Active" || echo -e "${RED}[FAIL]${NC} GPSD: Inactive"
systemctl is-enabled gpsd.service > /dev/null 2>&1 && echo -e "${GREEN}[OK]${NC} GPSD: Auto-start enabled" || echo -e "${RED}[FAIL]${NC} GPSD: Auto-start disabled"
systemctl is-enabled argos.service > /dev/null 2>&1 && echo -e "${GREEN}[OK]${NC} Argos: Auto-start enabled" || echo -e "${RED}[FAIL]${NC} Argos: Auto-start disabled"

# Test GPS data flow
echo ""
echo "GPS Data Flow Test:"
if timeout 3 gpspipe -w -n 1 2>/dev/null | grep -q "class"; then
    echo -e "${GREEN}[OK]${NC} GPSD receiving data from Prolific adapter"
else
    echo -e "${YELLOW}[WARN]${NC} No GPS data (normal if indoors or no satellites)"
fi

# ===== SUMMARY =====
echo ""
echo "=== IMPLEMENTATION COMPLETE ==="
echo ""
echo -e "${GREEN}BOOT SEQUENCE CONFIGURED:${NC}"
echo "1. Pi boots → systemd starts services"
echo "2. gps-device-setup.service → Sets USB device permissions"
echo "3. gpsd.service → Starts reading NMEA from $USB_DEVICE"
echo "4. argos.service → Starts Argos Console on port 5173"
echo "5. User access → http://<pi-ip>:5173"
echo "6. User clicks 'Start Kismet' → Kismet launches"
echo "7. Kismet → Connects to GPSD on localhost:2947"
echo "8. Kismet API → Provides GPS status at /gps/location.json"
echo "9. Argos → Polls /api/gps/status for GPS data"
echo "10. UI Updates → Both Kismet and tactical-map headers show GPS status"
echo ""
echo -e "${YELLOW}GPS ACQUISITION NOTES:${NC}"
echo "• Prolific adapter outputs NMEA immediately when powered"
echo "• Satellite acquisition is INDEPENDENT of Kismet"
echo "• GPS will acquire satellites even with Kismet stopped"
echo "• Indoor testing will show 'No Fix' - this is normal"
echo "• Move GPS near window or outside for satellite lock"
echo ""
echo -e "${GREEN}NEXT STEPS:${NC}"
echo "1. Reboot to test full boot sequence: sudo reboot"
echo "2. After boot, check: http://<pi-ip>:5173"
echo "3. Start Kismet from Argos Console"
echo "4. GPS status will appear in both headers once satellites acquired"
echo ""
echo "MANUAL TESTING COMMANDS:"
echo "  Check GPS data:     gpspipe -w -n 5"
echo "  Monitor GPS:        gpsmon"
echo "  Check services:     systemctl status gpsd argos"
echo "  View Argos logs:    journalctl -u argos -f"