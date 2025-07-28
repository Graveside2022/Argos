# GSMEvil2 - No IMSI/SMS Data Troubleshooting Guide

## Problem: Not Seeing Any IMSI/SMS Data in GSMEvil2

This guide addresses the common issue where GSMEvil2 runs but doesn't capture any IMSI or SMS data.

## Root Causes

1. **Wrong Frequency**: Using a frequency without active GSM traffic
2. **Signal Chain Break**: grgsm_livemon → UDP → pyshark → GSMEvil2
3. **Encrypted Traffic**: Modern GSM networks use encryption
4. **No GSM Activity**: No devices actively connecting to the base station

## Complete Setup Workflow (Based on YouTube Video)

### Step 1: Find Active GSM Frequencies

```bash
# Use our frequency scanner script
./scripts/gsm-frequency-scanner.sh

# Or manually with kalibrate-hackrf
/home/ubuntu/projects/Argos/tools/kalibrate-hackrf/src/kal -s GSM900 -g 40
```

**Important**: The default frequency (935.2 MHz) might not have any traffic in your area!

### Step 2: Verify the Signal Chain

1. **Check HackRF Connection**:
   ```bash
   hackrf_info
   ```

2. **Start grgsm_livemon_headless with Active Frequency**:
   ```bash
   # Use frequency from Step 1 (e.g., 948.6 MHz)
   grgsm_livemon_headless -f 948.6e6 -s 2e6 -g 40
   ```

3. **Verify with Wireshark** (most reliable test):
   ```bash
   sudo wireshark -k -f udp -Y gsmtap -i lo
   ```
   
   You should see GSMTAP packets if everything is working.

### Step 3: Start GSMEvil2 Properly

```bash
# Use our updated script that includes the correct frequency
./scripts/start-gsmevil2.sh
```

## Quick Diagnostic Commands

### 1. Check All Components
```bash
# Check if all processes are running
ps aux | grep -E "grgsm|GsmEvil" | grep -v grep

# Check UDP port
netstat -uln | grep 4729

# Test packet flow
sudo tcpdump -i lo -n "udp port 4729" -c 10
```

### 2. Test Different Frequencies
```bash
# GSM900 band (Europe/Asia/Africa)
grgsm_livemon_headless -f 948.6e6 -s 2e6 -g 40

# DCS1800 band (Europe/Asia)
grgsm_livemon_headless -f 1842.6e6 -s 2e6 -g 40

# GSM850 band (Americas)
grgsm_livemon_headless -f 890.2e6 -s 2e6 -g 40
```

### 3. Gain Adjustment
Try different gain values if signal is weak:
```bash
# Lower gain (if signal is too strong)
grgsm_livemon_headless -f 948.6e6 -s 2e6 -g 20

# Higher gain (if signal is weak)
grgsm_livemon_headless -f 948.6e6 -s 2e6 -g 50
```

## Why You Might Not See Data

### 1. **Encryption is Enabled**
Modern GSM networks use A5/1 or A5/3 encryption. You'll only see:
- System Information messages
- Paging requests (without IMSI)
- Channel assignments

### 2. **No Active Devices**
IMSI catchers work by capturing:
- Location Update requests (when phones connect)
- SMS delivery attempts
- Call setup messages

If no phones are actively connecting, you won't see IMSIs.

### 3. **Wrong Band/Frequency**
Different regions use different bands:
- **Europe/Asia/Africa**: GSM900 (935-960 MHz), DCS1800 (1805-1880 MHz)
- **Americas**: GSM850 (869-894 MHz), PCS1900 (1930-1990 MHz)

### 4. **4G/5G Networks**
Most modern phones prefer 4G/5G. GSM is only used for:
- Voice calls (if VoLTE is not available)
- SMS (if not using IMS)
- Fallback when 4G/5G is unavailable

## Working Test Setup

If you want to verify your setup is working:

1. **Use Wireshark First**:
   ```bash
   # This is the most reliable way to see if you're receiving any GSM data
   sudo wireshark -k -f udp -Y gsmtap -i lo
   ```

2. **Look for System Information**:
   Even encrypted networks broadcast unencrypted System Information (SI) messages.

3. **Force a Phone to GSM**:
   - Set phone to 2G/GSM only mode
   - Make a call or send an SMS
   - You should see increased activity

## Complete Working Example

```bash
# 1. Find active frequencies
./scripts/gsm-frequency-scanner.sh

# 2. Start monitoring (example with 948.6 MHz)
grgsm_livemon_headless -f 948.6e6 -s 2e6 -g 40 &

# 3. Verify with tshark
sudo timeout 10 tshark -i lo -f 'udp port 4729' -Y gsmtap

# 4. If you see packets, start GSMEvil2
./scripts/start-gsmevil2.sh

# 5. Open browser to http://localhost:8080
# 6. Enable IMSI or SMS sniffer
```

## Legal Notice

GSM monitoring may be illegal in your jurisdiction. This guide is for educational purposes only. Always comply with local laws and regulations.

## Additional Resources

- [gr-gsm Documentation](https://github.com/ptrkrysik/gr-gsm)
- [GSM Security Research](https://www.gsm-security.net/)
- [RTL-SDR GSM Sniffing](https://www.rtl-sdr.com/rtl-sdr-tutorial-analyzing-gsm-with-airprobe-and-wireshark/)