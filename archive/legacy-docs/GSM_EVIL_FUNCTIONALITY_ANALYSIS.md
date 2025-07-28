# GSMEvil2 Functionality Analysis and Troubleshooting

## Current Status

1. **GSMEvil2 Web Server**: ✅ Running on port 8080
2. **Web Interface**: ✅ Accessible via browser
3. **grgsm_livemon**: ❌ Not running (data source missing)
4. **Functionality**: ❌ Cannot capture IMSI/SMS without grgsm_livemon

## Issues Found

### 1. Missing Data Source
- GSMEvil2 is running and the web interface is accessible
- However, it relies on `grgsm_livemon` to capture GSM data and send it to port 4729
- The grgsm_livemon process is not currently running
- Without grgsm_livemon, clicking the ON switches in the interface won't capture any data

### 2. Minor UI Bug (Fixed)
- Fixed typo in home.html: `herf="/sms"` → `href="/sms"`

### 3. How GSMEvil2 Works
The system has two components:
1. **grgsm_livemon**: Captures GSM signals using HackRF/RTL-SDR and outputs to UDP port 4729
2. **GSMEvil2**: Web interface that listens on port 4729 and displays captured IMSI/SMS data

## The Start Button Flow

When user clicks "Start GSM Evil" in your Svelte interface:
1. ✅ Svelte sends POST to `/api/gsm-evil/control` with `action: 'start'`
2. ✅ API endpoint executes `/home/ubuntu/projects/Argos/scripts/start-gsmevil2.sh`
3. ✅ Script starts GSMEvil2 web server on port 8080
4. ❌ Script tries to start grgsm_livemon but it's not staying running

When user toggles ON switches in GSMEvil2 interface:
1. ✅ JavaScript sends SocketIO event (`imsi_sniffer: 'on'` or `sms_sniffer: 'on'`)
2. ✅ GSMEvil2 Python backend receives event and sets internal flags
3. ✅ GSMEvil2 starts listening on loopback:4729 for UDP packets
4. ❌ No data arrives because grgsm_livemon is not running

## Root Cause

The main issue is that grgsm_livemon is failing to start or stay running. This could be due to:
1. HackRF/RTL-SDR device not connected or not accessible
2. gr-gsm not properly installed
3. Permission issues
4. Frequency/gain parameters incorrect for your area

## Solutions

### 1. Check HackRF Connection
```bash
# Check if HackRF is connected
hackrf_info

# Check if RTL-SDR is connected (alternative)
rtl_test -t
```

### 2. Test grgsm_livemon Manually
```bash
# Try running it manually to see errors
grgsm_livemon_headless -f 935.2e6 -s 2e6 -g 40

# Or with GUI to see spectrum
grgsm_livemon -f 935.2e6
```

### 3. Check gr-gsm Installation
```bash
# Test if gr-gsm is installed
python3 -c "import grgsm"

# Check for grgsm tools
which grgsm_livemon
which grgsm_scanner
```

### 4. Scan for Active GSM Frequencies
```bash
# Scan for active GSM cells in your area
grgsm_scanner -b GSM900
# or
grgsm_scanner -b GSM1800
```

### 5. Fix the Start Script
The start script should check if grgsm_livemon actually started successfully:

```bash
# After starting grgsm_livemon, verify it's running
sleep 3
if ! pgrep -f "grgsm_livemon" > /dev/null; then
    echo "ERROR: grgsm_livemon failed to start"
    # Check for common issues
    if ! command -v grgsm_livemon_headless &> /dev/null; then
        echo "grgsm_livemon_headless not found. Is gr-gsm installed?"
    fi
    if ! hackrf_info &> /dev/null; then
        echo "HackRF not detected. Please connect HackRF device."
    fi
fi
```

## Testing Individual Components

### Test GSMEvil2 Interface
1. Open http://localhost:8080 in browser
2. Click "IMSI Sniffer" button
3. Toggle the IMSI Sniffer switch to ON
4. Check browser console for errors (F12)

### Test Data Flow
```bash
# Send test UDP packet to GSMEvil2 (simulate grgsm_livemon)
echo -n "test" | nc -u localhost 4729
```

## Conclusion

The GSMEvil2 web interface is working correctly. The issue is that the data source (grgsm_livemon) is not running. You need to:
1. Ensure HackRF or RTL-SDR is connected
2. Verify gr-gsm is properly installed
3. Find the correct GSM frequency for your area
4. Fix any permission or device access issues

The "Start GSM Evil" button in your interface successfully starts the web server, but the actual GSM capture functionality depends on grgsm_livemon running successfully.