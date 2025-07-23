# GSMEvil2 Troubleshooting Guide

## Issue Fixed: Start Button Not Working

### Problem Summary
The GSMEvil2 start button in the Argos interface wasn't working due to:
1. **CPU Usage Bug**: The original GSMEvil2 code had an infinite loop that consumed 100% CPU when the sniffer was off
2. **Process Management**: The high CPU usage prevented proper process management and communication

### Solutions Applied

#### 1. Fixed the CPU Usage Bug
Created a patch script (`scripts/gsmevil2-patch.py`) that fixes the infinite loop issue by:
- Adding a sleep statement when the sniffer is off
- Fixing a comparison operator bug (== vs =)
- Adding proper error handling

#### 2. Updated the Startup Script
Modified `scripts/start-gsmevil2.sh` to:
- Automatically apply the CPU fix patch
- Properly handle directory changes
- Better process management

### How GSMEvil2 Works

1. **Main Interface**: GSMEvil2 runs on port 8080 and has its own web interface
2. **Controls**: Uses toggle switches (not buttons) to start/stop IMSI and SMS sniffers
3. **Backend**: Uses Flask with Socket.IO for real-time updates
4. **Data Capture**: Uses pyshark to capture GSMTAP packets from grgsm_livemon

### Verifying Everything Works

1. **Check if GSMEvil2 is running**:
   ```bash
   ps aux | grep -E "GsmEvil|grgsm" | grep -v grep
   ```

2. **Check CPU usage** (should be low when idle):
   ```bash
   top -b -n 1 | grep -E "GsmEvil|grgsm"
   ```

3. **Test the web interface**:
   ```bash
   curl -I http://localhost:8080
   ```

4. **Check API status**:
   ```bash
   curl -X POST http://localhost:5173/api/gsm-evil/control \
     -H "Content-Type: application/json" \
     -d '{"action": "status"}'
   ```

### Using GSMEvil2

1. **From Argos Interface**:
   - Click "Start GSM Evil" button in the Argos GSM Evil page
   - Wait for the iframe to load (shows GSMEvil2 logo)
   - Click either "IMSI Sniffer" or "SMS Sniffer" buttons

2. **In GSMEvil2 Interface**:
   - Use the toggle switches on the right side to enable/disable sniffers
   - IMSI Sniffer: Captures device identifiers
   - SMS Sniffer: Captures SMS messages (if unencrypted)

### Troubleshooting Tips

1. **If the interface doesn't load**:
   - Check if port 8080 is blocked by firewall
   - Ensure both GSMEvil2 and grgsm_livemon are running
   - Check logs: `tail -f /tmp/gsmevil2.log`

2. **If no data is captured**:
   - Verify HackRF is connected: `hackrf_info`
   - Check if grgsm_livemon is running
   - Ensure you're on the correct frequency for your area
   - Try different gain values (default is 40)

3. **If high CPU usage returns**:
   - Kill the process: `pkill -f GsmEvil`
   - Re-run the patch: `python3 scripts/gsmevil2-patch.py`
   - Restart using the script: `./scripts/start-gsmevil2.sh`

### Important Notes

- GSMEvil2 is for educational/research purposes only
- Only captures unencrypted GSM traffic (increasingly rare)
- Requires proper frequency for your local GSM network
- The toggle switches in GSMEvil2's interface control the actual sniffing
- The Argos interface provides a convenient wrapper and process management