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
