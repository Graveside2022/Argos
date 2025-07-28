#!/usr/bin/env python3
import socketio
import time
from datetime import datetime

# Create a Socket.IO client
sio = socketio.Client()

imsi_count = 0
start_time = time.time()

@sio.event
def connect():
    print(f"Connected to GSM Evil server at {datetime.now()}")
    # Ensure IMSI sniffer is on
    sio.emit('imsi_sniffer', 'on')
    # Request current data
    sio.emit('imsi_data', 'get')

@sio.event
def disconnect():
    print("Disconnected from server")

@sio.on('sniffers')
def on_sniffers(data):
    print(f"Sniffer status: {data}")

@sio.on('imsi_data')
def on_imsi_data(data):
    global imsi_count
    if data:
        print(f"\nHistorical IMSI data: {len(data)} records")
        # Show last 5
        for record in data[-5:]:
            print(f"  IMSI: {record[1]}, TMSI: {record[2]}, Time: {record[7]}")
        imsi_count = len(data)

@sio.on('imsi')
def on_imsi(data):
    global imsi_count
    imsi_count += 1
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] NEW IMSI CAPTURED!")
    print(f"  IMSI: {data.get('imsi', 'N/A')}")
    print(f"  TMSI: {data.get('tmsi', 'N/A')}")
    print(f"  MCC: {data.get('mcc', 'N/A')}, MNC: {data.get('mnc', 'N/A')}")
    print(f"  LAC: {data.get('lac', 'N/A')}, CI: {data.get('ci', 'N/A')}")
    print(f"  Total captured: {imsi_count}")

# Connect to the server
try:
    print("Monitoring GSM Evil IMSI captures...")
    print("Press Ctrl+C to stop\n")
    sio.connect('http://localhost')
    
    # Keep monitoring
    while True:
        elapsed = int(time.time() - start_time)
        print(f"\r[{elapsed}s] Monitoring... Total IMSIs: {imsi_count}", end='', flush=True)
        time.sleep(1)
        
except KeyboardInterrupt:
    print("\n\nStopping monitor...")
except Exception as e:
    print(f"Error: {e}")
finally:
    sio.disconnect()