# GPS Integration Troubleshooting Guide

## Problem 1: GPS 503 Service Unavailable Errors (RESOLVED)

**Date Fixed**: 2025-08-07  
**Location**: Mainz-Kastel, Germany (50.01°N, 8.28°E)  
**Status**: ✅ RESOLVED

### Problem Description

The tactical-map-simple page was showing repeated 503 Service Unavailable errors from the GPS position API endpoint (`/api/gps/position`) when GPS had no fix available.

### Root Cause

The GPS API endpoint was incorrectly returning HTTP 503 status when GPS receiver was working but had no position fix. This is inappropriate because:

- 503 indicates service temporarily unavailable
- No GPS fix is a normal operational state, not a service failure
- Frontend polling treated 503 as errors, cluttering console

### Resolution

Updated `/src/routes/api/gps/position/+server.ts`:

- Changed status from 503 to 200 OK when no GPS fix available
- Added consistent data structure for both success and no-fix responses
- Enhanced frontend handling to show satellite count and fix status

## Problem 2: GPS Not Showing on Tactical Map

**Date Fixed**: 2025-07-31  
**Location**: Mainz-Kastel, Germany (50.01°N, 8.28°E)  
**Status**: ✅ RESOLVED

## Problem Description

The tactical-map-simple page was not displaying GPS coordinates despite:

- GPSd daemon running
- GPS hardware connected via /dev/ttyUSB0
- Satellites locked and visible
- No obvious errors in application logs

## Root Cause Analysis

### Primary Issue: Linux File Permissions

- GPS device `/dev/ttyUSB0` owned by `root:dialout` with 660 permissions
- Ubuntu user not in `dialout` group, preventing access to GPS hardware
- GPSd could see device but couldn't read from it

### Secondary Issue: GPSd Client Activation

- GPSd uses lazy-loading - won't read from GPS device until client connects
- API was using wrong connection method and port
- Multiple GPSd instances on different ports causing confusion

## Resolution Steps

### 1. Fix Linux Permissions

```bash
# Add ubuntu user to dialout group
sudo usermod -a -G dialout ubuntu

# Verify group membership
groups ubuntu
# Should show: ubuntu adm dialout cdrom sudo dip plugdev...
```

### 2. Start GPSd with Correct Permissions

```bash
# Kill existing gpsd instances
sudo pkill gpsd

# Start gpsd with dialout group permissions
sg dialout -c "gpsd -D 5 -N -S 2950 /dev/ttyUSB0" &

# Verify it's running with correct group ID (20 = dialout)
ps aux | grep gpsd
```

### 3. Fix API Connection Method

**File**: `src/routes/api/gps/position/+server.ts`

**Before (broken)**:

```javascript
const result = await execAsync('timeout 5 gpspipe -w -n 10 -p 2948 | grep -m 1 TPV');
```

**After (working)**:

```javascript
const result = await execAsync(
	'echo "?WATCH={\\"enable\\":true,\\"json\\":true}" | timeout 5 nc localhost 2950 | grep -m 1 TPV'
);
```

**Key Changes**:

- Updated port from 2948 to 2950
- Changed from `gpspipe` to direct TCP connection via `nc`
- Direct TCP method triggers GPSd to start reading GPS device

## Testing & Verification

### Test GPS API Endpoint

```bash
curl -s http://localhost:5173/api/gps/position | jq .
```

**Expected Success Response**:

```json
{
	"success": true,
	"data": {
		"latitude": 50.010451667,
		"longitude": 8.285231667,
		"altitude": 101.6,
		"speed": 0.334,
		"heading": 100.04,
		"accuracy": 10.899,
		"satellites": 4,
		"fix": 3,
		"time": "2025-07-31T17:14:37.000Z"
	}
}
```

### Test GPSd Direct Connection

```bash
echo '?WATCH={"enable":true,"json":true}' | nc localhost 2950
```

**Expected Output**: Stream of JSON messages including TPV (position) and SKY (satellite) data.

### Verify GPS Device Access

```bash
# Check device permissions
ls -la /dev/ttyUSB0
# Result: crw-rw---- 1 root dialout 188, 0 Jul 31 15:35 /dev/ttyUSB0

# Test direct device access (should work after adding to dialout group)
sg dialout -c "timeout 3 cat /dev/ttyUSB0"
```

## Technical Details

### Hardware Configuration

- **Device**: Prolific USB-Serial Controller (067b:23a3)
- **Serial Port**: /dev/ttyUSB0
- **Baud Rate**: Auto-detected (4800/9600/38400)
- **GPS Protocol**: NMEA 0183

### GPSd Configuration

- **Port**: 2950 (custom instance)
- **Debug Level**: -D 5 (moderate logging)
- **Options**: -N (foreground), -S (port)
- **Group**: dialout (gid=20)

### API Integration

- **Endpoint**: `/api/gps/position`
- **Method**: Direct TCP connection to GPSd
- **Protocol**: GPSd JSON protocol
- **Fallback**: Multiple port attempts (2950→2948→default)

## Common Issues & Solutions

### Issue: "Permission denied" on /dev/ttyUSB0

**Solution**: Add user to dialout group and restart session

```bash
sudo usermod -a -G dialout $USER
# Logout/login or use: newgrp dialout
```

### Issue: GPSd shows device but no data

**Solution**: Connect a client to trigger GPS reading

```bash
echo '?WATCH={"enable":true,"json":true}' | nc localhost 2950
```

### Issue: Multiple GPSd instances conflict

**Solution**: Kill all instances and start one with specific port

```bash
sudo pkill gpsd
sg dialout -c "gpsd -D 5 -N -S 2950 /dev/ttyUSB0" &
```

### Issue: API returns "GPS service not available"

**Solution**: Check port configuration and ensure GPSd is active

```bash
netstat -tulpn | grep 2950  # Verify GPSd listening
```

## Prevention

1. **User Setup**: Always add users to `dialout` group during system setup
2. **Service Management**: Use SystemD service for GPSd with proper user/group
3. **Port Management**: Document and standardize GPSd port configuration
4. **API Robustness**: Implement multiple fallback connection methods

## Monitoring

### Health Check Script

```bash
#!/bin/bash
# Check GPS service health
if curl -s http://localhost:5173/api/gps/position | jq -e '.success' > /dev/null; then
    echo "GPS: OK"
else
    echo "GPS: FAILED - Check GPSd service"
fi
```

### Log Monitoring

```bash
# Watch GPSd logs for debugging
sg dialout -c "gpsd -D 9 -N -S 2950 /dev/ttyUSB0" 2>&1 | grep -E "(TPV|SKY|ERROR)"
```

## Related Documentation

- [Architecture.md GPS Integration Section](./architecture.md#gps-integration)
- [NMEA 0183 Protocol Reference](https://www.nmea.org/content/STANDARDS/NMEA_0183_Standard)
- [GPSd Documentation](https://gpsd.gitlab.io/gpsd/)
- [Linux Serial Port Permissions](https://wiki.archlinux.org/title/Udev#Accessing_firmware_programmers_and_USB_virtual_comm_devices)
