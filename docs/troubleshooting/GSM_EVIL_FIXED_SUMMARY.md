# GSMEvil2 Integration - Fixed and Working!

## Current Status: ✅ WORKING

### Components Running:
1. **grgsm_livemon_headless**: PID 1071678 - Capturing GSM signals via HackRF
2. **GsmEvil.py**: PID 1071811 - Web interface running on port 8080
3. **Argos Interface**: Successfully controls GSMEvil2 via API

## Issues Fixed:

### 1. Fixed grgsm_livemon_headless Parameters
**Problem**: The script was using incorrect command-line parameters for grgsm_livemon_headless
**Solution**: Changed from:
```bash
grgsm_livemon_headless -f 935.2e6 -s 2e6 -g 40 -o 127.0.0.1 -p 4729
```
To:
```bash
grgsm_livemon_headless -f 935.2e6 -s 2e6 -g 40 --collector localhost --collectorport 4729
```

### 2. Fixed UI Navigation Bug
**Problem**: SMS Sniffer button had typo `herf="/sms"` instead of `href="/sms"`
**Solution**: Fixed the typo in `/tmp/gsmevil2/templates/home.html`

### 3. Enhanced Process Management
**Problem**: No verification that grgsm_livemon actually started
**Solution**: Added PID tracking and verification in the start script

## How to Use GSMEvil2:

### From Argos Interface:
1. Navigate to http://localhost:5173/gsm-evil
2. Click "Start GSM Evil" button (top right)
3. Wait for the interface to load
4. Click "IMSI Sniffer" or "SMS Sniffer" in the GSMEvil2 interface
5. Toggle the switches to ON to start capturing

### What Happens Behind the Scenes:
1. **Start GSM Evil** button → Calls `/api/gsm-evil/control` with `action: 'start'`
2. API runs `/scripts/start-gsmevil2.sh` which:
   - Starts grgsm_livemon_headless (captures GSM signals)
   - Starts GsmEvil.py (web interface)
3. grgsm_livemon sends captured data to UDP port 4729
4. GsmEvil.py listens on port 4729 and displays data in web interface
5. Toggle switches in GSMEvil2 interface control what data is captured/displayed

## Troubleshooting Commands:

### Check Status:
```bash
# Check if processes are running
ps aux | grep -E "(GsmEvil|grgsm)" | grep -v grep

# Check API status
curl -X POST -H "Content-Type: application/json" -d '{"action": "status"}' http://localhost:5173/api/gsm-evil/control

# Check logs
tail -f /tmp/gsmevil2.log
tail -f /tmp/grgsm.log
```

### Manual Control:
```bash
# Start manually
bash /home/ubuntu/projects/Argos/scripts/start-gsmevil2.sh

# Stop manually
pkill -f "GsmEvil.py"
pkill -f "grgsm_livemon"

# Test GSM scanner
grgsm_scanner -b GSM900
```

## Important Notes:

1. **Frequency**: Currently set to 935.2 MHz. You may need to adjust based on your location
2. **Gain**: Set to 40 dB. Adjust if you get too much noise or weak signals
3. **Legal**: Only use for authorized security testing and research
4. **Performance**: grgsm_livemon uses ~30% CPU when running

## Next Steps:

1. Run the test script to find optimal frequency for your area:
   ```bash
   bash /home/ubuntu/projects/Argos/scripts/test-grgsm.sh
   ```

2. Update frequency in `/scripts/start-gsmevil2.sh` if needed

3. For better performance, consider using grgsm_livemon with specific ARFCN instead of frequency

## Files Created/Modified:
- `/home/ubuntu/projects/Argos/scripts/start-gsmevil2.sh` - Fixed parameters
- `/tmp/gsmevil2/templates/home.html` - Fixed navigation bug
- `/home/ubuntu/projects/Argos/scripts/test-grgsm.sh` - New diagnostic script
- `/home/ubuntu/projects/Argos/GSM_EVIL_FUNCTIONALITY_ANALYSIS.md` - Detailed analysis
- `/home/ubuntu/projects/Argos/GSM_EVIL_FIXED_SUMMARY.md` - This summary