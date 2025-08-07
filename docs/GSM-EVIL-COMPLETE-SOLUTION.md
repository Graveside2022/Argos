# GSM Evil Complete Solution Documentation

## Overview

This document provides comprehensive documentation of the GSM Evil integration fixes implemented on August 7, 2025. These fixes resolved critical issues with starting/stopping GSM Evil, permission handling, database access, and IMSI data display.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Start/Stop Mechanism](#startstop-mechanism)
3. [Scan Functionality](#scan-functionality)
4. [IMSI Data Pipeline](#imsi-data-pipeline)
5. [Permission Handling](#permission-handling)
6. [Database Integration](#database-integration)
7. [Troubleshooting](#troubleshooting)

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                   Argos Web Interface                    │
│                    (Port 5173)                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐        ┌─────────────────────┐    │
│  │  GSM Evil Page   │        │  IMSI Capture Box   │    │
│  │    (iframe)      │        │  (LocalIMSIDisplay) │    │
│  └────────┬─────────┘        └──────────┬──────────┘    │
│           │                              │               │
│           ▼                              ▼               │
│  ┌──────────────────────────────────────────────────┐   │
│  │           API Endpoints (/api/gsm-evil/*)        │   │
│  └──────────┬───────────────────────┬───────────────┘   │
│             │                       │                    │
└─────────────┼───────────────────────┼────────────────────┘
              │                       │
              ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │   GSM Evil Web   │    │  IMSI Database   │
    │   (Port 8080)    │    │ (SQLite)         │
    └──────────────────┘    └──────────────────┘
              │
              ▼
    ┌──────────────────┐
    │  GRGSM Monitor   │
    │  (USRP B205)     │
    └──────────────────┘
```

### Key Components

1. **Argos Web Interface** - Main application at port 5173
2. **GSM Evil Service** - Python application at port 8080
3. **GRGSM Monitor** - GNU Radio GSM signal processor
4. **USRP B205 Mini** - Software Defined Radio hardware
5. **IMSI Database** - SQLite database at `/home/ubuntu/gsmevil-user/database/imsi.db`

## Start/Stop Mechanism

### Start Process

#### Script: `/home/ubuntu/projects/Argos/scripts/gsm-evil-start-no-sudo.sh`

This script was created to handle GSM Evil startup without requiring passwordless sudo:

```bash
#!/bin/bash

# GSM Evil Start Script - No Sudo Required
FREQ="${1:-947.4}"
GAIN="${2:-45}"

# Key steps:
1. Kill any existing GSM Evil processes
2. Start GRGSM monitor with USRP B205
3. Navigate to GSM Evil directory
4. Create auto-IMSI version if needed
5. Start GSM Evil on port 8080 (no root required)
6. Save PIDs for later cleanup
```

**Key Features:**

- Runs on port 8080 instead of 80 (no root required)
- Automatically enables IMSI sniffer
- Adds CORS support for Socket.IO
- Handles virtual environment if present

#### API Endpoint: `/api/gsm-evil/control/+server.ts`

```typescript
// Start action
if (action === 'start') {
	// Execute start script without sudo
	const { stdout, stderr } = await execAsync(`./scripts/gsm-evil-start-no-sudo.sh ${freq} 45`, {
		timeout: 15000
	});

	// Verify processes started
	// Check for GsmEvil.py or GsmEvil_auto.py process
	// Check if port 8080 is listening
}
```

### Stop Process

#### Script: `/home/ubuntu/projects/Argos/scripts/gsm-evil-stop.sh`

The bulletproof stop script implements an 8-phase termination process:

```bash
# PHASE 1: Stop GRGSM Livemon processes
# PHASE 2: Stop GSM Evil Python processes
# PHASE 3: Port Cleanup (80, 8080, 4729, 2775)
# PHASE 4: USRP Device Release
# PHASE 5: PID File Cleanup
# PHASE 6: Process Verification
# PHASE 7: Force Kill if needed
# PHASE 8: Final Status Report
```

**Key Features:**

- Multi-method process discovery (pgrep + ps aux)
- Graceful termination with SIGTERM, then SIGKILL
- Port cleanup using lsof and fuser
- USRP device reset
- Works with or without sudo

## Scan Functionality

### Intelligent Scan Process

The scan functionality searches for active GSM frequencies using the USRP B205 Mini.

#### API Endpoint: `/api/gsm-evil/intelligent-scan-stream/+server.ts`

```typescript
// Scan process:
1. Create Server-Sent Events stream
2. Scan frequencies 945.0-949.0 MHz in 0.1 MHz steps
3. For each frequency:
   - Measure RF power using USRP
   - Run GRGSM scanner for 5 seconds
   - Check for IMSI captures
4. Report active frequencies with signal strength
5. Return best frequency for operation
```

#### Power Measurement Script: `scripts/usrp_power_measure_real.py`

```python
# Measures actual RF power at specified frequency
# Uses USRP B205 Mini with UHD Python API
# Returns power in dBm
```

### How the Scan Button Works

1. **User clicks "Start Scan"** in the web interface
2. **Frontend calls** `/api/gsm-evil/intelligent-scan-stream`
3. **Backend initiates SSE stream** for real-time updates
4. **For each frequency:**
    - Measures RF power level
    - Attempts IMSI capture
    - Reports results to frontend
5. **Frontend displays** progress and results
6. **Best frequency** automatically selected

## IMSI Data Pipeline

### Data Flow

```
USRP B205 Mini → GRGSM Monitor → GSMTAP (UDP 4729) → GSM Evil → SQLite Database
                                                          ↓
Web Interface ← API Endpoint ← SQLite Database ←─────────┘
```

### Database Location

Primary: `/home/ubuntu/gsmevil-user/database/imsi.db`

### IMSI Capture Box

The IMSI Capture Box (`LocalIMSIDisplay.svelte`) displays both historical and live IMSI data:

1. **Initial Load**: Fetches all historical IMSIs from database
2. **Live Updates**: Polls `/api/gsm-evil/imsi` every 2 seconds
3. **Display**: Shows up to 50 records with country identification

#### API Endpoint: `/api/gsm-evil/imsi/+server.ts`

```typescript
// Searches multiple database locations:
const dbPaths = [
	'/home/ubuntu/gsmevil-user/database/imsi.db',
	'/usr/src/gsmevil2/database/imsi.db',
	'/home/ubuntu/projects/gsmevil2/database/imsi.db'
];

// Returns all IMSI records with:
// - ID, IMSI, TMSI, MCC, MNC, LAC, CI, timestamp
// - Optional tower location if available
```

### GSM Evil Iframe

Displays the original GSM Evil web interface at `http://localhost:8080/imsi/`

## Permission Handling

### Problem Solved

Original issue: Scripts required `sudo` but passwordless sudo wasn't configured.

### Solution

1. **Port Change**: Use port 8080 instead of 80 (no root required)
2. **Process Management**: User-level process control
3. **Fallback Logic**: Scripts work with or without sudo

```bash
# Example from stop script:
if sudo -n true 2>/dev/null; then
    sudo kill $signal $pid 2>/dev/null
else
    kill $signal $pid 2>/dev/null
fi
```

## Database Integration

### Finding the Database

The system searches multiple locations for the IMSI database:

```javascript
// Priority order:
1 / home / ubuntu / gsmevil - user / database / imsi.db(current);
2 / usr / src / gsmevil2 / database / imsi.db(system);
3 / home / ubuntu / projects / gsmevil2 / database / imsi.db(dev);
```

### Database Schema

```sql
CREATE TABLE imsi_data(
    id INTEGER PRIMARY KEY,
    imsi TEXT,
    tmsi TEXT,
    mcc INTEGER,
    mnc INTEGER,
    lac INTEGER,
    ci INTEGER,
    date_time timestamp
);
```

## Health Monitoring

### API Endpoint: `/api/gsm-evil/health/+server.ts`

Provides comprehensive system status:

```json
{
  "grgsm": {
    "running": true/false,
    "pid": 12345,
    "runtime": 300,
    "status": "running/stopped"
  },
  "gsmevil": {
    "running": true/false,
    "pid": 12346,
    "webInterface": true/false,
    "port8080": true/false
  },
  "dataFlow": {
    "gsmtapActive": true/false,
    "port4729Active": true/false,
    "databaseAccessible": true/false,
    "recentData": true/false
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. GSM Evil Won't Start

**Symptom**: "Failed to start GSM Evil" error

**Solutions**:

- Check USRP is connected: `lsusb | grep 2500:0022`
- Verify no other process using USRP: `ps aux | grep grgsm`
- Check port 8080 is free: `lsof -i:8080`

#### 2. No IMSI Data Displayed

**Symptom**: IMSI Capture Box shows "No records"

**Solutions**:

- Verify database exists: `ls -la /home/ubuntu/gsmevil-user/database/imsi.db`
- Check API endpoint: `curl http://localhost:5173/api/gsm-evil/imsi`
- Verify GSM Evil is running: `ps aux | grep GsmEvil`

#### 3. Stop Button Doesn't Work

**Symptom**: Processes remain after clicking stop

**Solutions**:

- Run stop script manually: `./scripts/gsm-evil-stop.sh`
- Force kill if needed: `pkill -9 -f grgsm; pkill -9 -f GsmEvil`

#### 4. Scan Takes Too Long

**Symptom**: Scan hangs or times out

**Solutions**:

- Check USRP connection
- Reduce frequency range
- Increase timeout values

### Debug Commands

```bash
# Check GSM Evil status
curl http://localhost:5173/api/gsm-evil/health

# View IMSI database
python3 -c "import sqlite3; conn = sqlite3.connect('/home/ubuntu/gsmevil-user/database/imsi.db'); cursor = conn.cursor(); cursor.execute('SELECT COUNT(*) FROM imsi_data'); print(f'Total IMSIs: {cursor.fetchone()[0]}')"

# Monitor processes
watch -n 1 'ps aux | grep -E "(grgsm|GsmEvil)" | grep -v grep'

# Check ports
netstat -tulpn | grep -E "(8080|4729|80)"

# View logs
tail -f /home/ubuntu/projects/Argos/gsmevil2.log
```

## Configuration Files

### Key Scripts

- **Start Script**: `/scripts/gsm-evil-start-no-sudo.sh`
- **Stop Script**: `/scripts/gsm-evil-stop.sh`
- **Control API**: `/src/routes/api/gsm-evil/control/+server.ts`
- **IMSI API**: `/src/routes/api/gsm-evil/imsi/+server.ts`
- **Health API**: `/src/routes/api/gsm-evil/health/+server.ts`

### Environment Variables

```bash
# USRP Configuration
UHD_IMAGES_DIR=/usr/share/uhd/images

# Default frequency and gain
DEFAULT_FREQ=947.4
DEFAULT_GAIN=45
```

## Security Considerations

1. **Port Security**: Using port 8080 avoids root requirement
2. **Process Isolation**: User-level process management
3. **Database Access**: Read-only access from web interface
4. **CORS Policy**: Configured for local access only
5. **Input Validation**: Frequency and gain parameters validated

## Performance Optimizations

1. **Database Queries**: Limited to 1000 records
2. **Polling Interval**: 2-second refresh for IMSI data
3. **Process Cleanup**: Comprehensive termination prevents resource leaks
4. **Memory Management**: Node.js configured with 2GB heap size

## Future Improvements

1. **WebSocket Integration**: Replace polling with real-time updates
2. **Database Archival**: Auto-archive old IMSI records
3. **Multi-Device Support**: Handle multiple USRP devices
4. **Frequency Hopping**: Automatic frequency switching
5. **Alert System**: Notify on specific IMSI detection

---

_Last Updated: August 7, 2025_
_Author: Claude (Anthropic)_
_Version: 1.0.0_
