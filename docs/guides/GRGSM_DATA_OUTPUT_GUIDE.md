# GRGSM_LIVEMON Data Output Guide

## Overview

`grgsm_livemon_headless` is a GNU Radio-based GSM monitoring tool that captures GSM signals and outputs the decoded data in GSMTAP format over UDP.

## How grgsm_livemon Outputs Data

### 1. **Output Format: GSMTAP over UDP**
- Protocol: GSMTAP (GSM Tap) encapsulated in UDP packets
- Default port: 4729 (standard GSMTAP port)
- Interface: localhost (127.0.0.1)
- Data format: Binary GSMTAP packets containing GSM frames

### 2. **Starting grgsm_livemon with Data Output**
```bash
grgsm_livemon_headless -f 947.2M -g 40 --collector 127.0.0.1 --collectorport 4729
```

Parameters:
- `-f 947.2M`: Frequency to monitor (in MHz)
- `-g 40`: Gain setting for the SDR
- `--collector 127.0.0.1`: IP address to send GSMTAP packets to
- `--collectorport 4729`: UDP port for GSMTAP data

### 3. **Data Stream Characteristics**
- Continuous stream of UDP packets while monitoring
- Each packet contains one GSM frame
- Packet rate depends on GSM traffic (typically 50-500 packets/second)
- No built-in file output - data is streamed via network only

### 4. **GSMTAP Packet Contents**
Each GSMTAP packet contains:
- **Header Information:**
  - Version (typically 2)
  - Header length
  - Type (1 for GSM)
  - Timeslot (0-7)
  - ARFCN (Absolute Radio Frequency Channel Number)
  - Signal strength (RSSI in dBm)
  - SNR (Signal-to-Noise Ratio)
  - Frame number
  - Channel type
  - Antenna number
  - Sub-slot

- **Payload:**
  - Raw GSM frame data
  - Can contain various GSM message types (CCCH, BCCH, SDCCH, etc.)

### 5. **Methods to Capture the Data**

#### Method 1: Using Wireshark
```bash
sudo wireshark -k -f "udp port 4729" -Y gsmtap -i lo
```

#### Method 2: Using tcpdump
```bash
sudo tcpdump -i lo -w capture.pcap udp port 4729
```

#### Method 3: Using PyShark (Python)
```python
import pyshark

capture = pyshark.LiveCapture(
    interface='lo',
    bpf_filter='udp port 4729',
    display_filter='gsmtap'
)

for packet in capture.sniff_continuously():
    if hasattr(packet, 'gsmtap'):
        rssi = int(packet.gsmtap.signal_dbm)
        arfcn = int(packet.gsmtap.arfcn)
        print(f"RSSI: {rssi} dBm, ARFCN: {arfcn}")
```

#### Method 4: Using netcat
```bash
# Simple UDP listener (binary output)
nc -u -l 4729
```

### 6. **Data Processing Applications**

Common applications that can process GSMTAP data:
- **Wireshark**: Full protocol analysis and decoding
- **tshark**: Command-line packet analysis
- **GSMEvil2**: IMSI catcher and SMS sniffer
- **Custom Python scripts**: Using pyshark or scapy
- **gr-gsm tools**: Various GNU Radio GSM tools

### 7. **Important Notes**

1. **No Direct File Output**: grgsm_livemon doesn't write to files directly - it only streams over UDP
2. **Real-time Stream**: Data is streamed in real-time as signals are received
3. **Local Only by Default**: By default, data is only sent to localhost for security
4. **Standard Format**: GSMTAP is a standard format recognized by many tools
5. **Continuous Stream**: The tool outputs data continuously until stopped

### 8. **Example: Real-time RSSI Monitoring**

See the included scripts:
- `test-grgsm-rssi.py`: Extract and save RSSI data to JSON
- `grgsm-realtime-monitor.py`: Real-time monitoring with statistics

### 9. **Troubleshooting**

If you're not seeing data:
1. Verify grgsm_livemon is running: `ps aux | grep grgsm`
2. Check UDP port is open: `netstat -tulpn | grep 4729`
3. Ensure you have permission to capture on loopback interface
4. Verify the SDR device is connected and working
5. Check the frequency is correct for your area's GSM towers

### 10. **Security Considerations**

- By default, data is only sent to localhost (127.0.0.1)
- Never expose the GSMTAP port to external networks
- Be aware of legal restrictions on GSM monitoring in your jurisdiction
- This tool is for educational and research purposes only