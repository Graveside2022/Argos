#!/usr/bin/env python3

import socketio
import time
import sys

# Create a Socket.IO client
sio = socketio.Client()

# Flag to track connection
connected = False

@sio.event
def connect():
    global connected
    print("Connected to GSM Evil WebSocket")
    connected = True
    # Send the command to enable IMSI sniffer
    sio.emit('imsi_sniffer', 'on')
    print("Sent command to enable IMSI sniffer")

@sio.event
def disconnect():
    print("Disconnected from GSM Evil")

@sio.on('status')
def on_status(data):
    print(f"Status update: {data}")
    if 'imsi_sniffer' in data:
        if data['imsi_sniffer'] == 'on':
            print("[PASS] IMSI sniffer is now ENABLED")
            sio.disconnect()
            sys.exit(0)

try:
    # Connect to GSM Evil WebSocket
    print("Connecting to GSM Evil WebSocket...")
    sio.connect('http://localhost:80', wait_timeout=10)
    
    # Wait for the sniffer to be enabled
    time.sleep(3)
    
    if connected:
        sio.disconnect()
        
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)