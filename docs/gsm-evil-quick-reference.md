# GSM Evil Quick Reference Guide

## Starting GSM Evil

### Web Interface

1. Navigate to `http://100.112.117.73:5173/gsm-evil`
2. Click "Start GSM Evil" button
3. Wait for status to show "Running"

### Command Line

```bash
./scripts/gsm-evil-start-no-sudo.sh 947.4 45
```

## Stopping GSM Evil

### Web Interface

1. Click "Stop GSM Evil" button
2. Verify status shows "Stopped"

### Command Line

```bash
./scripts/gsm-evil-stop.sh
```

## Scanning for Frequencies

### Web Interface

1. Click "Start Scan" button
2. Wait for scan to complete (40-60 seconds)
3. Best frequency will be automatically selected

### Manual Scan

```bash
curl http://localhost:5173/api/gsm-evil/intelligent-scan-stream
```

## Viewing IMSI Data

### IMSI Capture Box

- Shows all historical IMSI records
- Updates every 2 seconds with new captures
- Displays up to 50 records

### Direct Database Query

```bash
python3 -c "
import sqlite3
conn = sqlite3.connect('/home/ubuntu/gsmevil-user/database/imsi.db')
cursor = conn.cursor()
cursor.execute('SELECT * FROM imsi_data ORDER BY id DESC LIMIT 10')
for row in cursor.fetchall():
    print(row)
"
```

## Health Check

```bash
curl http://localhost:5173/api/gsm-evil/health | python3 -m json.tool
```

## Troubleshooting

### If GSM Evil won't start:

```bash
# Check for conflicting processes
ps aux | grep -E "(grgsm|GsmEvil)"

# Kill all GSM processes
./scripts/gsm-evil-stop.sh

# Check USRP device
lsusb | grep 2500:0022
```

### If no IMSI data appears:

```bash
# Check database
ls -la /home/ubuntu/gsmevil-user/database/imsi.db

# Test API
curl http://localhost:5173/api/gsm-evil/imsi
```

### Emergency Stop

```bash
pkill -9 -f grgsm
pkill -9 -f GsmEvil
```

## Key Files

- **Start Script**: `scripts/gsm-evil-start-no-sudo.sh`
- **Stop Script**: `scripts/gsm-evil-stop.sh`
- **Database**: `/home/ubuntu/gsmevil-user/database/imsi.db`
- **GSM Evil Service**: Port 8080
- **GSMTAP**: Port 4729

## Default Settings

- **Frequency**: 947.4 MHz
- **Gain**: 45 dB
- **Port**: 8080
- **Refresh Rate**: 2 seconds
