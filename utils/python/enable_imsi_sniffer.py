#!/usr/bin/env python3
import socketio
import time

# Create a Socket.IO client
sio = socketio.Client()

@sio.event
def connect():
    print("Connected to GSM Evil server")
    # Enable IMSI sniffer
    sio.emit('imsi_sniffer', 'on')
    print("Sent command to enable IMSI sniffer")
    
    # Request current sniffer status
    time.sleep(1)
    sio.emit('sniffers', 'status')
    
    # Request IMSI data
    time.sleep(1)
    sio.emit('imsi_data', 'get')

@sio.event
def disconnect():
    print("Disconnected from server")

@sio.on('sniffers')
def on_sniffers(data):
    print(f"Sniffer status: {data}")

@sio.on('imsi_data')
def on_imsi_data(data):
    print(f"IMSI data received: {data}")
    if data:
        print(f"Number of IMSIs: {len(data)}")

@sio.on('imsi')
def on_imsi(data):
    print(f"New IMSI detected: {data}")

# Connect to the server
try:
    print("Connecting to GSM Evil at http://localhost...")
    sio.connect('http://localhost')
    
    # Wait for events
    print("Waiting for IMSI data (30 seconds)...")
    time.sleep(30)
    
except Exception as e:
    print(f"Error: {e}")
finally:
    sio.disconnect()